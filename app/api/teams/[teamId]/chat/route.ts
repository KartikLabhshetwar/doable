import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from '@/lib/auth-server-helpers'
import { streamText, tool, convertToModelMessages } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getTeamContext } from '@/lib/api/chat'
import { createIssue } from '@/lib/api/issues'
import { updateIssue } from '@/lib/api/issues'
import { getIssues } from '@/lib/api/issues'
import { getIssueById } from '@/lib/api/issues'
import { deleteIssue } from '@/lib/api/issues'
import { createProject, updateProject, deleteProject } from '@/lib/api/projects'
import { sendInvitationEmail } from '@/lib/email'
import { stepCountIs } from 'ai'
import {
  resolveWorkflowState,
  resolveProject,
  resolveAssignee,
  resolveLabelIds,
  validateIssueFields,
  formatValidationError,
} from '@/lib/api/chat-helpers'

export const maxDuration = 30

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { messages, apiKey: clientApiKey } = await request.json()

    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get team context
    const teamContext = await getTeamContext(teamId)

    // Get API key (from client localStorage or environment variable)
    const apiKey = clientApiKey || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No Groq API key configured. Please add your API key.' },
        { status: 400 }
      )
    }

    // Get first workflow state for defaults
    const defaultWorkflowState = teamContext.workflowStates[0]

    // Build system prompt from team context
    const systemPrompt = `You are a helpful AI assistant for a project management system.
Your role is to help users manage their tasks, projects, and team members through natural conversation.

## Current Team Context

Available Projects: ${teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ') || 'None'}
Workflow States: ${teamContext.workflowStates.map(s => s.name).join(', ')}
Available Labels: ${teamContext.labels.map(l => l.name).join(', ')}
Team Members: ${teamContext.members.map(m => m.userName).join(', ') || 'None'}

## Important Rules for Creating Issues

When creating an issue, you MUST collect ALL of these BEFORE calling the createIssue tool:
1. Title (required) - Must have a clear, descriptive title
2. Status/Workflow State (required) - Must be a valid workflow state name from the list above
3. Priority level (required) - MUST ask the user explicitly: "What should be the priority level? (low, medium, high, urgent, or none)"
4. Project (required) - MUST ask the user: "Which project should this issue be added to?" and show available projects

CRITICAL RULES:
- DO NOT call createIssue or createIssues tools if ANY required field is missing (title, status, priority, or project)
- DO NOT guess, infer, or default values - ALWAYS ask the user explicitly
- DO NOT default priority to "none" unless the user explicitly says "none"
- DO NOT use a default workflow state - always ask the user what status they want
- Ask ONE question at a time to avoid overwhelming the user
- If the user says "create an issue" with only a title, respond with: "Sure! To create the issue, I need a few more details. First, what should be the priority level for this issue? (low, medium, high, urgent, or none)"

When user asks to see issues or lists tasks, ALWAYS call the listIssues tool WITHOUT a limit parameter to get ALL issues. 
Display the results as a bullet list with clear formatting.
When user provides minimal information, ask ONE follow-up question at a time.
Always use the provided tools for actions.`

    // Define tools for the AI
    const tools = {
      createIssue: tool({
        description: 'Create a single new issue. For creating multiple issues at once (2+), use createIssues instead. You can use workflow state names (like "Todo", "In Progress", "Done") and they will be automatically matched to IDs. Same for project names, assignee names, and label names. CRITICAL: Do NOT call this tool if ANY required information is missing (title, status/workflow state, priority, or project). Instead, ask the user ONE question at a time for the missing information. Do not default priority to "none" - always ask the user to specify a priority level explicitly. Always ask which project the issue should be added to if not provided. Always ask what status/workflow state the issue should be in if not provided.',
        inputSchema: z.object({
          title: z.string().nullish().describe('The title of the issue (REQUIRED)'),
          description: z.string().nullish().describe('A detailed description of the issue'),
          projectId: z.string().nullish().describe('The project ID, key, or name (e.g., "testing" or project name) this issue belongs to (REQUIRED). Do not call this tool with project missing - always ask the user to specify which project to add the issue to.'),
          workflowStateId: z.string().nullish().describe('The workflow state ID or name (e.g., "Todo", "In Progress", "Done") (REQUIRED)'),
          assigneeId: z.string().nullish().describe('The user ID or name (e.g., "kartik") to assign this issue to'),
          priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish().describe('The priority level (REQUIRED - must be one of: low, medium, high, urgent, or none). Do not call this tool with priority missing or defaulted to "none" - always ask the user to specify a priority first.'),
          estimate: z.number().nullish().describe('Story points or hours estimate'),
          labelIds: z.array(z.string()).nullish().describe('Array of label names or IDs (e.g., ["Bug", "Feature", "Documentation", "Enhancement"])'),
          // Support alias parameters that the AI might use
          status: z.string().nullish().optional().describe('Alias for workflowStateId - do not use, use workflowStateId instead'),
          project: z.string().nullish().optional().describe('Alias for projectId - do not use, use projectId instead'),
        }).passthrough(),
        execute: async (params) => {
          try {
            // Handle alias parameters - map status to workflowStateId and project to projectId
            const {
              title,
              description,
              projectId: paramProjectId,
              workflowStateId: paramWorkflowStateId,
              status,
              project,
              assigneeId,
              priority,
              estimate,
              labelIds,
            } = params

            // Use aliases if main parameters are missing
            const projectId = paramProjectId || project
            const workflowStateId = paramWorkflowStateId || status

            // Check for duplicate title before proceeding
            const existingIssue = await db.issue.findFirst({
              where: {
                teamId,
                title: {
                  equals: title || '',
                  mode: 'insensitive',
                },
              },
              select: {
                id: true,
                number: true,
                title: true,
                project: {
                  select: {
                    name: true,
                    key: true,
                  },
                },
              },
            })

            if (existingIssue) {
              return {
                success: false,
                error: `An issue with the title "${title}" already exists (Issue #${existingIssue.number}${existingIssue.project ? ` in project ${existingIssue.project.name} (${existingIssue.project.key})` : ''}). Please use a different title or update the existing issue.`,
              }
            }

            // Validate required fields FIRST - do not proceed if anything is missing
            const validation = validateIssueFields({ title, workflowStateId, priority, projectId })
            if (!validation.isValid) {
              return {
                success: false,
                error: formatValidationError(validation.missingFields, teamContext),
              }
            }

            // Resolve all entities (synchronous lookups) - NO defaults allowed, we validated above
            const resolvedWorkflowStateId = resolveWorkflowState(teamContext, workflowStateId)
            const resolvedProject = resolveProject(teamContext, projectId)
            const assignee = resolveAssignee(teamContext, assigneeId)
            const resolvedLabelIds = resolveLabelIds(teamContext, labelIds)

            // Validate that required entities were successfully resolved (more strict than just "provided")
            if (!resolvedWorkflowStateId) {
              const availableStates = teamContext.workflowStates.map(ws => ws.name).join(', ')
              return {
                success: false,
                error: `Could not resolve workflow state "${workflowStateId}". Available states: ${availableStates}. Please specify a valid status/state name.`,
              }
            }

            // Validate project was found
            if (!resolvedProject) {
              const availableProjects = teamContext.projects.length > 0 
                ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                : 'No projects available'
              return {
                success: false,
                error: `The project "${projectId}" was not found. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}. Please specify a valid project name, key, or ID.` : 'Please create a project first or specify an existing project.'}`,
              }
            }

            // Create issue with resolved entities
            const issue = await createIssue(
              teamId,
              {
                title: title!,
                description: description ?? undefined,
                projectId: resolvedProject.id,
                workflowStateId: resolvedWorkflowStateId,
                assigneeId: assignee?.userId || undefined,
                priority: priority ?? 'none',
                estimate: estimate || undefined,
                labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
              },
              userId,
              user.name || user.email || 'Unknown'
            )

            if (!issue) {
              return { success: false, error: 'Failed to create issue' }
            }

            return {
              success: true,
              issue: {
                id: issue.id,
                title: issue.title,
                number: issue.number,
                description: issue.description,
                priority: issue.priority,
              },
              message: `Issue #${issue.number} "${issue.title}" has been created successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create issue' }
          }
        },
      }),

      createIssues: tool({
        description: 'Create multiple issues at once. Accepts an array of issue objects. Each issue needs: title, status (workflow state), priority, and project. IMPORTANT: Do NOT call this tool if any issue is missing title, status, priority, or project - instead, ask the user for the missing information first. Use this when the user asks to create multiple issues (e.g., "create 10 issues", "create issues for tasks X, Y, Z").',
        inputSchema: z.object({
          issues: z.array(z.object({
            title: z.string().nullish().describe('The title of the issue (REQUIRED)'),
            description: z.string().nullish(),
            projectId: z.string().nullish().describe('The project ID, key, or name (REQUIRED)'),
            workflowStateId: z.string().nullish().describe('The workflow state ID or name (e.g., "Todo", "In Progress", "Done") (REQUIRED)'),
            assigneeId: z.string().optional().describe('The user ID or name to assign this issue to'),
            priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish().describe('The priority level (REQUIRED)'),
            estimate: z.number().optional().describe('Story points or hours estimate'),
            labelIds: z.array(z.string()).optional().describe('Array of label names or IDs'),
            // Support alias parameters
            status: z.string().nullish().optional().describe('Alias for workflowStateId - do not use, use workflowStateId instead'),
            project: z.string().nullish().optional().describe('Alias for projectId - do not use, use projectId instead'),
          }).passthrough()).min(1).describe('Array of issues to create. Must contain at least 1 issue.'),
        }),
        execute: async ({ issues }) => {
          try {
            if (!issues || issues.length === 0) {
              return { success: false, error: 'At least one issue is required' }
            }

            // Check for duplicate titles across all issues before proceeding
            const titlesToCheck = issues
              .map((issue) => issue.title)
              .filter((title): title is string => !!title && title !== 'null' && title !== 'undefined')

            if (titlesToCheck.length > 0) {
              const existingIssues = await db.issue.findMany({
                where: {
                  teamId,
                  title: {
                    in: titlesToCheck,
                    mode: 'insensitive',
                  },
                },
                select: {
                  title: true,
                  number: true,
                  project: {
                    select: {
                      name: true,
                      key: true,
                    },
                  },
                },
              })

              if (existingIssues.length > 0) {
                const duplicates = existingIssues
                  .map((issue) => {
                    const projectInfo = issue.project
                      ? ` in project ${issue.project.name} (${issue.project.key})`
                      : ''
                    return `"${issue.title}" (Issue #${issue.number}${projectInfo})`
                  })
                  .join(', ')

                return {
                  success: false,
                  error: `The following issue titles already exist: ${duplicates}. Please use different titles or update the existing issues.`,
                }
              }
            }

            // Check for missing required fields across all issues
            const missingFields: string[] = []
            for (let i = 0; i < issues.length; i++) {
              const issueData = issues[i]
              if (!issueData.title || issueData.title === 'null' || issueData.title === 'undefined') {
                missingFields.push(`Issue ${i + 1}: title`)
              }
              if (!issueData.workflowStateId || issueData.workflowStateId === 'null' || issueData.workflowStateId === 'undefined') {
                missingFields.push(`Issue ${i + 1}: status (workflow state)`)
              }
              if (issueData.priority === null || issueData.priority === undefined) {
                missingFields.push(`Issue ${i + 1}: priority`)
              }
              if (!issueData.projectId || issueData.projectId === 'null' || issueData.projectId === 'undefined') {
                missingFields.push(`Issue ${i + 1}: project`)
              }
            }

            if (missingFields.length > 0) {
              const availableProjects = teamContext.projects.length > 0 
                ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                : 'No projects available'
              
              return {
                success: false,
                error: `I need the following information to create the issues: ${missingFields.join(', ')}. Please provide ${missingFields.length === 1 ? 'this' : 'these'} to proceed. ${teamContext.projects.length > 0 && missingFields.some(f => f.includes('project')) ? `Available projects: ${availableProjects}.` : ''}`,
              }
            }

            // Resolve all entities and prepare issue creation tasks in parallel
            const issueCreationTasks = issues.map((issueData) => {
              return (async () => {
                try {
                  // Handle alias parameters
                  const issueProjectId = issueData.projectId || (issueData as any).project
                  const issueWorkflowStateId = issueData.workflowStateId || (issueData as any).status

                  // Resolve all entities (no defaults - validation already checked they exist)
                  const resolvedWorkflowStateId = resolveWorkflowState(
                    teamContext,
                    issueWorkflowStateId
                  )
                  
                  const resolvedProject = resolveProject(teamContext, issueProjectId!)
                  
                  if (!resolvedProject) {
                    const availableProjects = teamContext.projects.length > 0 
                      ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                      : 'No projects available'
                    return {
                      error: { 
                        issue: issueData.title || 'Unknown', 
                        error: `Project "${issueProjectId}" not found. Available projects: ${availableProjects}`
                      },
                    }
                  }

                  const assignee = resolveAssignee(teamContext, issueData.assigneeId)
                  const resolvedLabelIds = resolveLabelIds(teamContext, issueData.labelIds)

                  if (!resolvedWorkflowStateId) {
                    const availableStates = teamContext.workflowStates.map(ws => ws.name).join(', ')
                    return {
                      error: { 
                        issue: issueData.title || 'Unknown', 
                        error: `Could not resolve workflow state "${issueWorkflowStateId}". Available states: ${availableStates}`
                      },
                    }
                  }

                  // Create the issue
                  const issue = await createIssue(
                    teamId,
                    {
                      title: issueData.title!,
                      description: issueData.description ?? undefined,
                      projectId: resolvedProject.id,
                      workflowStateId: resolvedWorkflowStateId,
                      assigneeId: assignee?.userId || undefined,
                      priority: issueData.priority ?? 'none',
                      estimate: issueData.estimate || undefined,
                      labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
                    },
                    userId,
                    user.name || user.email || 'Unknown'
                  )

                  if (issue) {
                    return {
                      success: {
                        id: issue.id,
                        number: issue.number,
                        title: issue.title,
                      },
                    }
                  } else {
                    return {
                      error: { issue: issueData.title || 'Unknown', error: 'Failed to create issue' },
                    }
                  }
                } catch (error: any) {
                  return {
                    error: { issue: issueData.title || 'Unknown', error: error.message || 'Failed to create issue' },
                  }
                }
              })()
            })

            // Execute all issue creations in parallel
            const results = await Promise.all(issueCreationTasks)

            // Separate successes from errors
            const createdIssues = results.filter((r) => r.success).map((r) => r.success!)
            const errors = results.filter((r) => r.error).map((r) => r.error!)

            const successMessage = createdIssues.length > 0
              ? `Successfully created ${createdIssues.length} issue${createdIssues.length !== 1 ? 's' : ''}: ${createdIssues.map(i => `#${i.number} "${i.title}"`).join(', ')}`
              : ''

            const errorMessage = errors.length > 0
              ? `Failed to create ${errors.length} issue${errors.length !== 1 ? 's' : ''}: ${errors.map(e => `"${e.issue}" (${e.error})`).join(', ')}`
              : ''

            return {
              success: createdIssues.length > 0,
              issues: createdIssues,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              createdCount: createdIssues.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create issues' }
          }
        },
      }),

      updateIssue: tool({
        description: 'Update an existing issue by title or ID. Use workflow state names (like "Todo", "Backlog", "In Progress", "Done"), assignee names, and label names.',
        inputSchema: z.object({
          issueId: z.string().optional().describe('The ID of the issue to update'),
          title: z.string().optional().describe('The title of the issue to find (if issueId not provided)'),
          newTitle: z.string().optional(),
          description: z.string().optional(),
          workflowStateId: z.string().optional().describe('The new workflow state ID or name (e.g., "Todo", "Backlog", "In Progress", "Done")'),
          assigneeId: z.string().nullish().describe('The user ID or name to assign this issue to'),
          priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish(),
          estimate: z.number().nullish(),
          labelIds: z.array(z.string()).nullish().describe('Array of label names or IDs (e.g., ["Bug", "Feature", "Documentation"])'),
        }),
        execute: async ({ issueId, title, newTitle, description, workflowStateId, assigneeId, priority, estimate, labelIds }) => {
          try {
            let resolvedIssueId = issueId

            // If title is provided, find the issue by title
            if (title && !issueId) {
              const issues = await getIssues(teamId)
              const matchingIssues = issues.filter(
                (issue) => issue.title.toLowerCase().includes(title.toLowerCase())
              )

              if (matchingIssues.length === 0) {
                return { success: false, error: `No issue found with title "${title}"` }
              }

              if (matchingIssues.length > 1) {
                return {
                  success: false,
                  error: `Multiple issues found matching "${title}": ${matchingIssues.map(i => `#${i.number} "${i.title}"`).join(', ')}. Please be more specific.`,
                }
              }

              resolvedIssueId = matchingIssues[0].id
            }

            if (!resolvedIssueId) {
              return { success: false, error: 'Either issueId or title must be provided' }
            }

            // Resolve entities using helper functions
            const resolvedWorkflowStateId = resolveWorkflowState(teamContext, workflowStateId)
            
            // Resolve assignee and handle unassignment
            let resolvedAssigneeId: string | null = null
            let resolvedAssigneeName: string | null = null
            if (assigneeId && assigneeId !== 'unassigned' && assigneeId !== 'null' && assigneeId !== 'undefined') {
              const assignee = resolveAssignee(teamContext, assigneeId)
              if (assignee) {
                resolvedAssigneeId = assignee.userId
                resolvedAssigneeName = assignee.userName
              }
            } else if (assigneeId === null || assigneeId === 'unassigned' || assigneeId === 'null' || assigneeId === 'undefined') {
              // Explicitly unassign
              resolvedAssigneeId = null
              resolvedAssigneeName = null
            }

            const resolvedLabelIds = resolveLabelIds(teamContext, labelIds)

            const issue = await updateIssue(teamId, resolvedIssueId, {
              ...(newTitle && { title: newTitle }),
              ...(description !== undefined && description !== null && { description }),
              ...(resolvedWorkflowStateId && { workflowStateId: resolvedWorkflowStateId }),
              ...(assigneeId !== undefined && { 
                assigneeId: resolvedAssigneeId ?? null,
                assignee: resolvedAssigneeName
              }),
              ...(priority && { priority }),
              ...(estimate && { estimate }),
              ...(resolvedLabelIds && { labelIds: resolvedLabelIds }),
            })

            if (!issue) {
              return { success: false, error: 'Issue not found' }
            }

            return {
              success: true,
              issue: {
                id: issue.id,
                title: issue.title,
                number: issue.number,
              },
              message: `Issue #${issue.number} "${issue.title}" has been updated successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to update issue' }
          }
        },
      }),

      listIssues: tool({
        description: 'Get a list of ALL issues for the team. Returns all issues by default unless a specific limit is requested. Use this to get a complete overview of all tasks.',
        inputSchema: z.object({
          limit: z.number().nullable().optional().describe('Maximum number of issues to return (omit to get all issues)'),
        }),
        execute: async ({ limit }) => {
          try {
            const issues = await getIssues(teamId)
            const limited = limit ? issues.slice(0, limit) : issues
            
            return {
              success: true,
              issues: limited.map(issue => ({
                id: issue.id,
                number: issue.number,
                title: issue.title,
                description: issue.description,
                priority: issue.priority,
                assignee: issue.assignee,
                project: issue.project,
                workflowState: issue.workflowState.name,
              })),
              count: limited.length,
              total: issues.length,
              message: limited.length === issues.length 
                ? `Found all ${issues.length} issues`
                : `Showing ${limited.length} of ${issues.length} total issues`
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to list issues' }
          }
        },
      }),

      getIssue: tool({
        description: 'Get details of a specific issue by ID',
        inputSchema: z.object({
          issueId: z.string().describe('The ID of the issue'),
        }),
        execute: async ({ issueId }) => {
          try {
            const issue = await getIssueById(teamId, issueId)
            if (!issue) {
              return { success: false, error: 'Issue not found' }
            }

            return {
              success: true,
              issue: {
                id: issue.id,
                number: issue.number,
                title: issue.title,
                description: issue.description,
                priority: issue.priority,
                assignee: issue.assignee,
                project: issue.project,
                workflowState: issue.workflowState.name,
                labels: issue.labels.map(l => l.label.name),
              },
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to get issue' }
          }
        },
      }),

      deleteIssue: tool({
        description: 'Delete an issue by its title or ID. If title is provided, it will search for matching issues.',
        inputSchema: z.object({
          title: z.string().optional().describe('The title of the issue to delete'),
          issueId: z.string().optional().describe('The ID of the issue to delete'),
        }),
        execute: async ({ title, issueId }) => {
          try {
            // If title is provided, search for matching issues
            if (title && !issueId) {
              const issues = await getIssues(teamId)
              const matchingIssues = issues.filter(
                (issue) => issue.title.toLowerCase().includes(title.toLowerCase())
              )

              if (matchingIssues.length === 0) {
                return { success: false, error: `No issue found with title "${title}"` }
              }

              if (matchingIssues.length > 1) {
                return {
                  success: false,
                  error: `Multiple issues found matching "${title}": ${matchingIssues.map(i => `#${i.number} "${i.title}"`).join(', ')}. Please be more specific.`,
                  matches: matchingIssues.map(i => ({ id: i.id, title: i.title, number: i.number })),
                }
              }

              issueId = matchingIssues[0].id
            }

            if (!issueId) {
              return { success: false, error: 'Either title or issueId must be provided' }
            }

            const issue = await getIssueById(teamId, issueId)
            if (!issue) {
              return { success: false, error: 'Issue not found' }
            }

            await deleteIssue(teamId, issueId)

            return {
              success: true,
              message: `Issue #${issue.number} "${issue.title}" has been deleted successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to delete issue' }
          }
        },
      }),

      updateIssues: tool({
        description: 'Update multiple issues at once. Accepts an array of updates. Use this when the user asks to update multiple issues (e.g., "change status of issues #1, #2, #3 to Done", "assign all issues in project X to John").',
        inputSchema: z.object({
          updates: z.array(z.object({
            issueId: z.string().optional().describe('The ID of the issue to update'),
            title: z.string().optional().describe('The title of the issue to find (if issueId not provided)'),
            newTitle: z.string().optional(),
            description: z.string().nullish(),
            workflowStateId: z.string().optional().describe('The new workflow state ID or name'),
            assigneeId: z.string().nullish().describe('The user ID or name to assign this issue to'),
            priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
            estimate: z.number().nullish(),
            labelIds: z.array(z.string()).optional().describe('Array of label names or IDs'),
          })).min(1).describe('Array of issue updates. Must contain at least 1 update.'),
        }),
        execute: async ({ updates }) => {
          try {
            if (!updates || updates.length === 0) {
              return { success: false, error: 'At least one issue update is required' }
            }

            const updatedIssues = []
            const errors = []

            for (const updateData of updates) {
              try {
                let resolvedIssueId = updateData.issueId

                // If title is provided, find the issue
                if (updateData.title && !updateData.issueId) {
                  const issues = await getIssues(teamId)
                  const matchingIssues = issues.filter(
                    (issue: any) => issue.title.toLowerCase().includes((updateData.title || '').toLowerCase())
                  )

                  if (matchingIssues.length === 0) {
                    errors.push({ issue: updateData.title, error: 'Issue not found' })
                    continue
                  }

                  if (matchingIssues.length > 1) {
                    errors.push({ issue: updateData.title, error: `Multiple issues found matching "${updateData.title}"` })
                    continue
                  }

                  resolvedIssueId = matchingIssues[0].id
                }

                if (!resolvedIssueId) {
                  errors.push({ issue: updateData.title || 'unknown', error: 'Either issueId or title must be provided' })
                  continue
                }

                // Resolve entities using helper functions
                const resolvedWorkflowStateId = updateData.workflowStateId
                  ? resolveWorkflowState(teamContext, updateData.workflowStateId)
                  : undefined

                // Resolve assignee if provided
                let resolvedAssigneeId = updateData.assigneeId
                if (updateData.assigneeId) {
                  const assignee = resolveAssignee(teamContext, updateData.assigneeId)
                  if (assignee) {
                    resolvedAssigneeId = assignee.userId
                  }
                }

                // Resolve labels if provided
                const resolvedLabelIds = updateData.labelIds
                  ? resolveLabelIds(teamContext, updateData.labelIds)
                  : undefined

                const issue = await updateIssue(teamId, resolvedIssueId, {
                  ...(updateData.newTitle && { title: updateData.newTitle }),
                  ...(updateData.description !== undefined && updateData.description !== null && { description: updateData.description }),
                  ...(resolvedWorkflowStateId && { workflowStateId: resolvedWorkflowStateId }),
                  ...(resolvedAssigneeId !== undefined && { assigneeId: resolvedAssigneeId || null }),
                  ...(updateData.priority && { priority: updateData.priority }),
                  ...(updateData.estimate !== undefined && { estimate: updateData.estimate || null }),
                  ...(resolvedLabelIds && { labelIds: resolvedLabelIds }),
                })

                if (!issue) {
                  errors.push({ issue: updateData.title || updateData.issueId || 'unknown', error: 'Failed to update issue' })
                  continue
                }

                updatedIssues.push({
                  id: issue.id,
                  number: issue.number,
                  title: issue.title,
                })
              } catch (error: any) {
                errors.push({ issue: updateData.title || updateData.issueId || 'unknown', error: error.message || 'Failed to update issue' })
              }
            }

            const successMessage = updatedIssues.length > 0
              ? `Successfully updated ${updatedIssues.length} issue${updatedIssues.length !== 1 ? 's' : ''}: ${updatedIssues.map(i => `#${i.number} "${i.title}"`).join(', ')}`
              : ''

            const errorMessage = errors.length > 0
              ? `Failed to update ${errors.length} issue${errors.length !== 1 ? 's' : ''}: ${errors.map(e => `"${e.issue}" (${e.error})`).join(', ')}`
              : ''

            return {
              success: updatedIssues.length > 0,
              issues: updatedIssues,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              updatedCount: updatedIssues.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to update issues' }
          }
        },
      }),

      deleteIssues: tool({
        description: 'Delete multiple issues at once. Accepts an array of issue IDs or titles. Use this when the user asks to delete multiple issues (e.g., "delete issues #1, #2, #3", "delete all issues in project X").',
        inputSchema: z.object({
          issues: z.array(z.object({
            issueId: z.string().optional().describe('The ID of the issue to delete'),
            title: z.string().optional().describe('The title of the issue to find and delete (if issueId not provided)'),
          })).min(1).describe('Array of issues to delete. Must contain at least 1 issue.'),
        }),
        execute: async ({ issues }) => {
          try {
            if (!issues || issues.length === 0) {
              return { success: false, error: 'At least one issue is required' }
            }

            const deletedIssues = []
            const errors = []

            for (const issueData of issues) {
              try {
                let resolvedIssueId = issueData.issueId

                // If title is provided, find the issue
                if (issueData.title && !issueData.issueId) {
                  const allIssues = await getIssues(teamId)
                  const matchingIssues = allIssues.filter(
                    (issue: any) => issue.title.toLowerCase().includes((issueData.title || '').toLowerCase())
                  )

                  if (matchingIssues.length === 0) {
                    errors.push({ issue: issueData.title, error: 'Issue not found' })
                    continue
                  }

                  if (matchingIssues.length > 1) {
                    errors.push({ issue: issueData.title, error: `Multiple issues found matching "${issueData.title}"` })
                    continue
                  }

                  resolvedIssueId = matchingIssues[0].id
                }

                if (!resolvedIssueId) {
                  errors.push({ issue: issueData.title || 'unknown', error: 'Either issueId or title must be provided' })
                  continue
                }

                const issue = await getIssueById(teamId, resolvedIssueId)
                if (!issue) {
                  errors.push({ issue: resolvedIssueId, error: 'Issue not found' })
                  continue
                }

                await deleteIssue(teamId, resolvedIssueId)

                deletedIssues.push({
                  id: issue.id,
                  number: issue.number,
                  title: issue.title,
                })
              } catch (error: any) {
                errors.push({ issue: issueData.title || issueData.issueId || 'unknown', error: error.message || 'Failed to delete issue' })
              }
            }

            const successMessage = deletedIssues.length > 0
              ? `Successfully deleted ${deletedIssues.length} issue${deletedIssues.length !== 1 ? 's' : ''}: ${deletedIssues.map(i => `#${i.number} "${i.title}"`).join(', ')}`
              : ''

            const errorMessage = errors.length > 0
              ? `Failed to delete ${errors.length} issue${errors.length !== 1 ? 's' : ''}: ${errors.map(e => `"${e.issue}" (${e.error})`).join(', ')}`
              : ''

            return {
              success: deletedIssues.length > 0,
              issues: deletedIssues,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              deletedCount: deletedIssues.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to delete issues' }
          }
        },
      }),

      createProject: tool({
        description: 'Create a single new project. For creating multiple projects at once (2+), use createProjects instead. The name and key are REQUIRED. If any required information is missing (name or key), ask the user for it. The color parameter is optional and defaults to #6366f1 if not provided. The status parameter is optional and defaults to "active" if not provided.',
        inputSchema: z.object({
          name: z.string().nullish().describe('The name of the project (REQUIRED). Do not call this tool with name missing - always ask the user to specify the project name first.'),
          description: z.string().optional(),
          key: z.string().nullish().describe('A 3-letter project identifier (REQUIRED). Do not call this tool with key missing - always ask the user to specify a 3-letter project key first.'),
          color: z.string().optional(),
          icon: z.string().optional(),
          leadId: z.string().optional(),
          status: z.enum(['active', 'completed', 'canceled']).optional().describe('The status of the project (active, completed, or canceled)'),
        }),
        execute: async ({ name, description, key, color, icon, leadId, status }) => {
          try {
            // Check for missing required fields and ask user for them
            const missingFields = []
            
            if (!name || name === 'null' || name === 'undefined') {
              missingFields.push('name')
            }
            
            if (!key || key === 'null' || key === 'undefined') {
              missingFields.push('key (3-letter project identifier)')
            }
            
            if (missingFields.length > 0) {
              // Special message for key
              if (missingFields.includes('key (3-letter project identifier)') && missingFields.length === 1) {
                return {
                  success: false,
                  error: 'To create a project, I need a 3-letter project identifier (key). Please provide a short 3-letter code for this project (e.g., "WEB", "API", "MOB").',
                }
              }
              
              // Special message for name
              if (missingFields.includes('name') && missingFields.length === 1) {
                return {
                  success: false,
                  error: 'To create a project, I need the project name. Please specify what you would like to name this project.',
                }
              }
              
              // Combined message
              return {
                success: false,
                error: `To create a project, I need both: (1) the project name, and (2) a 3-letter project identifier (key). Please provide ${missingFields.length === 1 ? 'this' : 'these'} to proceed.`,
              }
            }

            // Validate key length if provided
            if (key && key.length !== 3) {
              return {
                success: false,
                error: `The project key must be exactly 3 letters. You provided "${key}" which is ${key.length} character${key.length !== 1 ? 's' : ''}. Please provide a 3-letter key (e.g., "WEB", "API", "MOB").`,
              }
            }
            
            // Default color if not provided
            const projectColor = color || '#6366f1'
            // Default status if not provided
            const projectStatus = status || 'active'
            
            const project = await createProject(teamId, {
              name: name!,
              description,
              key: key!,
              color: projectColor,
              icon,
              leadId,
              status: projectStatus,
              lead: leadId ? teamContext.members.find(m => m.userId === leadId)?.userName : undefined,
            })

            return {
              success: true,
              project: {
                id: project.id,
                name: project.name,
                key: project.key,
                description: project.description,
              },
              message: `Project "${project.name}" has been created successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create project' }
          }
        },
      }),

      createProjects: tool({
        description: 'Create multiple projects at once. Accepts an array of project objects. Each project needs: name and key (3-letter identifier). Use this when the user asks to create multiple projects (e.g., "create 5 projects", "create projects for frontend, backend, and API").',
        inputSchema: z.object({
          projects: z.array(z.object({
            name: z.string().nullish().describe('The name of the project (REQUIRED)'),
            description: z.string().nullish(),
            key: z.string().nullish().describe('A 3-letter project identifier (REQUIRED)'),
            color: z.string().optional(),
            icon: z.string().optional(),
            leadId: z.string().optional(),
            status: z.enum(['active', 'completed', 'canceled']).nullish().describe('The status of the project (optional, defaults to active)'),
          })).min(1).describe('Array of projects to create. Must contain at least 1 project.'),
        }),
        execute: async ({ projects }) => {
          try {
            if (!projects || projects.length === 0) {
              return { success: false, error: 'At least one project is required' }
            }

            // Check for missing required fields across all projects
            const missingFields: string[] = []
            for (let i = 0; i < projects.length; i++) {
              const projectData = projects[i]
              if (!projectData.name || projectData.name === 'null' || projectData.name === 'undefined') {
                missingFields.push(`Project ${i + 1}: name`)
              }
              if (!projectData.key || projectData.key === 'null' || projectData.key === 'undefined') {
                missingFields.push(`Project ${i + 1}: key (3-letter identifier)`)
              }
            }

            if (missingFields.length > 0) {
              return {
                success: false,
                error: `I need the following information to create the projects: ${missingFields.join(', ')}. Please provide ${missingFields.length === 1 ? 'this' : 'these'} to proceed.`,
              }
            }

            const createdProjects = []
            const errors = []

            for (const projectData of projects) {
              try {
                // Validate key length
                const projectKey = projectData.key! // Safe after validation
                if (projectKey.length !== 3) {
                  errors.push({ project: projectData.name || 'Unknown', error: `Key "${projectKey}" must be exactly 3 letters` })
                  continue
                }

                // Check if key already exists
                const existingProject = teamContext.projects.find(p => p.key.toLowerCase() === projectKey.toLowerCase())
                if (existingProject) {
                  errors.push({ project: projectData.name || 'Unknown', error: `Project key "${projectKey}" already exists` })
                  continue
                }

                const project = await createProject(teamId, {
                  name: projectData.name!,
                  description: projectData.description ?? undefined,
                  key: projectData.key!,
                  color: projectData.color || '#6366f1',
                  icon: projectData.icon,
                  leadId: projectData.leadId,
                  status: projectData.status || 'active',
                  lead: projectData.leadId ? teamContext.members.find(m => m.userId === projectData.leadId)?.userName : undefined,
                })

                createdProjects.push({
                  id: project.id,
                  name: project.name,
                  key: project.key,
                })
              } catch (error: any) {
                errors.push({ project: projectData.name, error: error.message || 'Failed to create project' })
              }
            }

            const successMessage = createdProjects.length > 0
              ? `Successfully created ${createdProjects.length} project${createdProjects.length !== 1 ? 's' : ''}: ${createdProjects.map(p => `"${p.name}" (${p.key})`).join(', ')}`
              : ''

            const errorMessage = errors.length > 0
              ? `Failed to create ${errors.length} project${errors.length !== 1 ? 's' : ''}: ${errors.map(e => `"${e.project}" (${e.error})`).join(', ')}`
              : ''

            return {
              success: createdProjects.length > 0,
              projects: createdProjects,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              createdCount: createdProjects.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create projects' }
          }
        },
      }),

      listProjects: tool({
        description: 'Get all projects for the team',
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          try {
            const projects = teamContext.projects
            return {
              success: true,
              projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                key: p.key,
                description: p.description,
                status: p.status,
                issueCount: p._count.issues,
              })),
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to list projects' }
          }
        },
      }),

      updateProject: tool({
        description: 'Update an existing project by name or ID. You can update properties like status, name, description, color, icon, or lead.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project to update'),
          name: z.string().optional().describe('The name of the project to find (if projectId not provided)'),
          newName: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(['active', 'completed', 'canceled']).optional().describe('The new status of the project (active, completed, or canceled)'),
          color: z.string().optional(),
          icon: z.string().optional(),
          leadId: z.string().optional(),
        }),
        execute: async ({ projectId, name, newName, description, status, color, icon, leadId }) => {
          try {
            let resolvedProjectId = projectId

            // If name is provided, find the project by name
            if (name && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(name.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: `No project found with name "${name}"` }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: `Multiple projects found matching "${name}": ${matchingProjects.map(p => `${p.name} (${p.key})`).join(', ')}. Please be more specific.`,
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: 'Either projectId or name must be provided' }
            }

            const project = await updateProject(teamId, resolvedProjectId, {
              ...(newName && { name: newName }),
              ...(description !== undefined && { description }),
              ...(status && { status }),
              ...(color && { color }),
              ...(icon && { icon }),
              ...(leadId !== undefined && { 
                leadId,
                lead: leadId ? teamContext.members.find(m => m.userId === leadId)?.userName : undefined,
              }),
            })

            if (!project) {
              return { success: false, error: 'Project not found' }
            }

            return {
              success: true,
              project: {
                id: project.id,
                name: project.name,
                key: project.key,
                status: project.status,
              },
              message: `Project "${project.name}" has been updated successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to update project' }
          }
        },
      }),

      inviteTeamMember: tool({
        description: 'Invite a single new team member via email. For inviting multiple team members at once (2+), use inviteTeamMembers instead.',
        inputSchema: z.object({
          email: z.string().min(5).describe('The email address to invite'),
          role: z.string().optional().default('developer').describe('The role for the member (developer, admin, viewer)'),
        }),
        execute: async ({ email, role }) => {
          try {
            // Check if invitation already exists
            const existingInvitation = await db.invitation.findUnique({
              where: {
                teamId_email: { teamId, email },
              },
            })

            if (existingInvitation?.status === 'pending') {
              return { success: false, error: 'Invitation already sent to this email' }
            }

            // Create invitation
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 7)

            const invitation = await db.invitation.create({
              data: {
                teamId,
                email,
                role,
                invitedBy: userId,
                status: 'pending',
                expiresAt,
              },
            })

            // Send email
            const team = await db.team.findUnique({ where: { id: teamId } })
            const inviterName = user.name || user.email || 'Someone'

            if (process.env.RESEND_API_KEY) {
              try {
                await sendInvitationEmail({
                  email,
                  teamName: team?.name || 'the team',
                  inviterName,
                  role: role || 'developer',
                  inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL}/invite/${invitation.id}`,
                })
              } catch (emailError) {
                console.error('Error sending invitation email:', emailError)
              }
            }

            return {
              success: true,
              message: `Invitation sent to ${email}`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to invite team member' }
          }
        },
      }),

      inviteTeamMembers: tool({
        description: 'Invite multiple team members at once. Accepts an array of email addresses with optional roles. Use this when the user asks to invite multiple people (e.g., "invite 10 team members", "invite john@example.com, jane@example.com, and bob@example.com").',
        inputSchema: z.object({
          invitations: z.array(z.object({
            email: z.string().min(5).describe('The email address to invite (REQUIRED). Must be a valid email format.'),
            role: z.string().optional().default('developer').describe('The role for the member (developer, admin, viewer)'),
          })).min(1).describe('Array of invitations to send. Must contain at least 1 invitation.'),
        }),
        execute: async ({ invitations }) => {
          try {
            if (!invitations || invitations.length === 0) {
              return { success: false, error: 'At least one invitation is required' }
            }

            const sentInvitations = []
            const errors = []
            const team = await db.team.findUnique({ where: { id: teamId } })
            const inviterName = user.name || user.email || 'Someone'

            for (const invitationData of invitations) {
              try {
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (!emailRegex.test(invitationData.email)) {
                  errors.push({ email: invitationData.email, error: 'Invalid email format' })
                  continue
                }

                // Check if invitation already exists
                const existingInvitation = await db.invitation.findUnique({
                  where: {
                    teamId_email: { teamId, email: invitationData.email },
                  },
                })

                if (existingInvitation?.status === 'pending') {
                  errors.push({ email: invitationData.email, error: 'Invitation already sent to this email' })
                  continue
                }

                // Create invitation
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 7)

                const invitation = await db.invitation.create({
                  data: {
                    teamId,
                    email: invitationData.email,
                    role: invitationData.role || 'developer',
                    invitedBy: userId,
                    status: 'pending',
                    expiresAt,
                  },
                })

                // Send email
                if (process.env.RESEND_API_KEY) {
                  try {
                    await sendInvitationEmail({
                      email: invitationData.email,
                      teamName: team?.name || 'the team',
                      inviterName,
                      role: invitationData.role || 'developer',
                      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL}/invite/${invitation.id}`,
                    })
                  } catch (emailError) {
                    console.error(`Error sending invitation email to ${invitationData.email}:`, emailError)
                    // Don't fail the invitation if email fails
                  }
                }

                sentInvitations.push({
                  email: invitationData.email,
                  role: invitationData.role || 'developer',
                })
              } catch (error: any) {
                errors.push({ email: invitationData.email, error: error.message || 'Failed to send invitation' })
              }
            }

            const successMessage = sentInvitations.length > 0
              ? `Successfully sent ${sentInvitations.length} invitation${sentInvitations.length !== 1 ? 's' : ''} to: ${sentInvitations.map(i => i.email).join(', ')}`
              : ''

            const errorMessage = errors.length > 0
              ? `Failed to send ${errors.length} invitation${errors.length !== 1 ? 's' : ''}: ${errors.map(e => `${e.email} (${e.error})`).join(', ')}`
              : ''

            return {
              success: sentInvitations.length > 0,
              invitations: sentInvitations,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              sentCount: sentInvitations.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to send invitations' }
          }
        },
      }),

      listTeamMembers: tool({
        description: 'Get all team members',
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          try {
            return {
              success: true,
              members: teamContext.members.map(m => ({
                userId: m.userId,
                name: m.userName,
                email: m.userEmail,
                role: m.role,
              })),
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to list team members' }
          }
        },
      }),

      getTeamStats: tool({
        description: 'Get team statistics and summary',
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          try {
            const [issueCount, projectCount, memberCount] = await Promise.all([
              db.issue.count({ where: { teamId } }),
              db.project.count({ where: { teamId } }),
              db.teamMember.count({ where: { teamId } }),
            ])

            return {
              success: true,
              stats: {
                issues: issueCount,
                projects: projectCount,
                members: memberCount,
              },
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to get team stats' }
          }
        },
      }),

      deleteProject: tool({
        description: 'Delete a project by name or ID. This will permanently remove the project and all associated issues.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project to delete'),
          name: z.string().optional().describe('The name of the project to find and delete (if projectId not provided)'),
        }),
        execute: async ({ projectId, name }) => {
          try {
            let resolvedProjectId = projectId

            // If name is provided, find the project by name
            if (name && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(name.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: `No project found with name "${name}"` }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: `Multiple projects found matching "${name}": ${matchingProjects.map(p => `${p.name} (${p.key})`).join(', ')}. Please be more specific with the project name or use the project ID.`,
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: 'Either projectId or name must be provided' }
            }

            // Get project details before deleting
            const project = await db.project.findUnique({
              where: { id: resolvedProjectId, teamId },
            })

            if (!project) {
              return { success: false, error: 'Project not found' }
            }

            // Delete the project
            await deleteProject(teamId, resolvedProjectId)

            return {
              success: true,
              message: `Project "${project.name}" has been deleted successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to delete project' }
          }
        },
      }),

      revokeInvitation: tool({
        description: 'Revoke or cancel a pending team invitation by email or invitation ID',
        inputSchema: z.object({
          invitationId: z.string().optional().describe('The ID of the invitation to revoke'),
          email: z.string().optional().describe('The email address of the pending invitation to revoke (if invitationId not provided)'),
        }),
        execute: async ({ invitationId, email }) => {
          try {
            let resolvedInvitationId = invitationId

            // If email is provided, find the invitation by email
            if (email && !invitationId) {
              const invitation = await db.invitation.findUnique({
                where: {
                  teamId_email: { teamId, email },
                },
              })

              if (!invitation) {
                return { success: false, error: `No pending invitation found for email "${email}"` }
              }

              if (invitation.status !== 'pending') {
                return { success: false, error: `Invitation for "${email}" is not pending (status: ${invitation.status})` }
              }

              resolvedInvitationId = invitation.id
            }

            if (!resolvedInvitationId) {
              return { success: false, error: 'Either invitationId or email must be provided' }
            }

            // Get invitation details before deleting
            const invitation = await db.invitation.findUnique({
              where: { id: resolvedInvitationId, teamId },
            })

            if (!invitation) {
              return { success: false, error: 'Invitation not found' }
            }

            // Delete the invitation
            await db.invitation.delete({
              where: { id: resolvedInvitationId, teamId },
            })

            return {
              success: true,
              message: `Invitation for "${invitation.email}" has been revoked successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to revoke invitation' }
          }
        },
      }),

      removeTeamMember: tool({
        description: 'Remove a team member from the workspace by user ID, email, or name. Only admins can remove team members.',
        inputSchema: z.object({
          memberId: z.string().optional().describe('The team member ID to remove'),
          userId: z.string().optional().describe('The user ID of the member to remove (if memberId not provided)'),
          email: z.string().optional().describe('The email address of the member to remove (if memberId or userId not provided)'),
          name: z.string().optional().describe('The name of the member to remove (if memberId, userId, or email not provided)'),
        }),
        execute: async ({ memberId, userId, email, name }) => {
          try {
            let resolvedMemberId = memberId

            // If user identifier is provided, find the member
            if (!memberId && (userId || email || name)) {
              const members = await db.teamMember.findMany({
                where: { teamId },
              })

              let matchingMember
              if (userId) {
                matchingMember = members.find(m => m.userId === userId)
              } else if (email) {
                matchingMember = members.find(m => m.userEmail?.toLowerCase() === email.toLowerCase())
              } else if (name) {
                matchingMember = members.find(m => 
                  m.userName?.toLowerCase().includes(name.toLowerCase())
                )
              }

              if (!matchingMember) {
                return { success: false, error: 'Team member not found' }
              }

              resolvedMemberId = matchingMember.id
            }

            if (!resolvedMemberId) {
              return { success: false, error: 'Either memberId, userId, email, or name must be provided' }
            }

            // Check if current user is an admin
            const currentMember = await db.teamMember.findFirst({
              where: {
                teamId,
                userId,
              },
            })

            if (!currentMember || currentMember.role !== 'admin') {
              return { success: false, error: 'Only admins can remove team members' }
            }

            // Get member details before deleting
            const member = await db.teamMember.findUnique({
              where: { id: resolvedMemberId },
            })

            if (!member || member.teamId !== teamId) {
              return { success: false, error: 'Team member not found' }
            }

            // Check if trying to remove yourself
            if (member.userId === userId) {
              return { success: false, error: 'Cannot remove yourself from the team' }
            }

            // Delete the member
            await db.teamMember.delete({
              where: { id: resolvedMemberId },
            })

            return {
              success: true,
              message: `Team member "${member.userName || member.userEmail}" has been removed successfully.`,
            }
          } catch (error: any) {
            return { success: false, error: error.message || 'Failed to remove team member' }
          }
        },
      }),
    }

    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages(messages)

    // Create Groq provider with API key
    const groq = createGroq({
      apiKey: apiKey,
    })

    // Stream the response
    const result = streamText({
      model: groq('openai/gpt-oss-20b'),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(5), // Allow multi-step tool calls
    })

    const response = result.toUIMessageStreamResponse()
    return response
  } catch (error) {
    console.error('Error in chat route:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
