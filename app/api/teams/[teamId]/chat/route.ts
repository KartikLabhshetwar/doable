import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from '@/lib/auth-server-helpers'
import { streamText, tool, isToolUIPart, convertToModelMessages } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getTeamContext } from '@/lib/api/chat'
import { updateConversationTitle, saveChatMessages } from '@/lib/api/chat'
import { createIssue } from '@/lib/api/issues'
import { updateIssue } from '@/lib/api/issues'
import { getIssues } from '@/lib/api/issues'
import { getIssueById } from '@/lib/api/issues'
import { deleteIssue } from '@/lib/api/issues'
import { createProject, updateProject } from '@/lib/api/projects'
import { sendInvitationEmail } from '@/lib/email'
import { stepCountIs } from 'ai'

export const maxDuration = 30

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { messages, conversationId, apiKey: clientApiKey } = await request.json()

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

When creating an issue, you MUST collect:
1. Title (required)
2. Status/Workflow State (required)
3. Priority level (required - must ask user: low, medium, high, urgent, or none)
4. Project (required - must ask user which project to add the issue to)

DO NOT create an issue without a priority - always ask the user to specify a priority level first. Do not default to "none" unless the user explicitly says they want none.
DO NOT create an issue without a project - always ask the user which project to add the issue to. Show available projects if available.

When user asks to see issues or lists tasks, ALWAYS call the listIssues tool WITHOUT a limit parameter to get ALL issues. 
Display the results as a bullet list with clear formatting.
When user provides minimal information, ask ONE follow-up question at a time.
Always use the provided tools for actions.`

    // Load conversation from DB if conversationId provided
    const conversationMessages = []
    if (conversationId) {
      const conversation = await db.chatConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })

      if (conversation?.messages) {
        conversationMessages.push(...conversation.messages.map(m => ({
          role: m.role,
          content: m.content,
        })))
      }

      // Auto-generate title from first user message if not set
      if (!conversation?.title && messages[0]?.content) {
        const title = messages[0].content.slice(0, 50)
        await updateConversationTitle(conversationId, title)
      }
    }

    // Define tools for the AI
    const tools = {
      createIssue: tool({
        description: 'Create a new issue. You can use workflow state names (like "Todo", "In Progress", "Done") and they will be automatically matched to IDs. Same for project names, assignee names, and label names. If any required information is missing (title, status, priority, or project), ask the user for it. Do not default priority to "none" - always ask the user to specify a priority level. Always ask which project the issue should be added to if not provided.',
        inputSchema: z.object({
          title: z.string().nullish().describe('The title of the issue (REQUIRED)'),
          description: z.string().nullish().describe('A detailed description of the issue'),
          projectId: z.string().nullish().describe('The project ID, key, or name (e.g., "testing" or project name) this issue belongs to (REQUIRED). Do not call this tool with project missing - always ask the user to specify which project to add the issue to.'),
          workflowStateId: z.string().nullish().describe('The workflow state ID or name (e.g., "Todo", "In Progress", "Done") (REQUIRED)'),
          assigneeId: z.string().nullish().describe('The user ID or name (e.g., "kartik") to assign this issue to'),
          priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish().describe('The priority level (REQUIRED - must be one of: low, medium, high, urgent, or none). Do not call this tool with priority missing or defaulted to "none" - always ask the user to specify a priority first.'),
          estimate: z.number().nullish().describe('Story points or hours estimate'),
          labelIds: z.array(z.string()).nullish().describe('Array of label names or IDs (e.g., ["Bug", "Feature", "Documentation", "Enhancement"])'),
        }),
        execute: async ({ title, description, projectId, workflowStateId, assigneeId, priority, estimate, labelIds }) => {
          try {
            // Check for missing required fields and ask user for them
            const missingFields = []
            
            if (!title || title === 'null' || title === 'undefined') {
              missingFields.push('title')
            }
            
            if (!workflowStateId || workflowStateId === 'null' || workflowStateId === 'undefined') {
              missingFields.push('status (workflow state)')
            }
            
            // Check if priority is missing - only null/undefined means missing, 'none' is a valid value if explicitly provided
            if (priority === null || priority === undefined) {
              missingFields.push('priority')
            }
            
            // Check if project is missing
            if (projectId === null || projectId === undefined || !projectId || projectId === 'null' || projectId === 'undefined') {
              missingFields.push('project')
            }
            
            if (missingFields.length > 0) {
              // Special message for priority to make it clearer
              if (missingFields.includes('priority') && missingFields.length === 1) {
                return {
                  success: false,
                  error: `To create this issue, I need to know the priority level. Please specify a priority: low, medium, high, urgent, or none.`,
                }
              }
              
              // Special message for project to make it clearer
              if (missingFields.includes('project') && missingFields.length === 1) {
                const availableProjects = teamContext.projects.length > 0 
                  ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                  : 'No projects available'
                return {
                  success: false,
                  error: `To create this issue, I need to know which project to add it to. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}. Please specify which project this issue should be added to.` : 'Please create a project first or specify an existing project.'}`,
                }
              }
              
              // Handle combinations with priority
              if (missingFields.includes('priority') && missingFields.includes('project') && missingFields.length === 2) {
                const availableProjects = teamContext.projects.length > 0 
                  ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                  : 'No projects available'
                return {
                  success: false,
                  error: `To create this issue, I need two things: (1) the priority level (low, medium, high, urgent, or none), and (2) which project to add it to. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}.` : 'Please create a project first or specify an existing project.'}`,
                }
              }
              
              // Handle combinations including other fields
              if (missingFields.includes('priority')) {
                const otherFields = missingFields.filter(f => f !== 'priority')
                return {
                  success: false,
                  error: `Missing required information: ${otherFields.join(', ')}, and priority. Please provide ${otherFields.length === 1 ? 'this' : 'these'} along with a priority level (low, medium, high, urgent, or none) to create the issue.`,
                }
              }
              
              if (missingFields.includes('project')) {
                const otherFields = missingFields.filter(f => f !== 'project')
                const availableProjects = teamContext.projects.length > 0 
                  ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                  : 'No projects available'
                return {
                  success: false,
                  error: `Missing required information: ${otherFields.join(', ')}, and project. Please provide ${otherFields.length === 1 ? 'this' : 'these'} along with a project. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}.` : 'Please create a project first or specify an existing project.'}`,
                }
              }
              
              return {
                success: false,
                error: `Missing required information: ${missingFields.join(', ')}. Please provide ${missingFields.length === 1 ? 'this' : 'these'} to create the issue.`,
              }
            }

            // Resolve workflow state by name or ID
            let resolvedWorkflowStateId = workflowStateId || defaultWorkflowState?.id || teamContext.workflowStates[0]?.id
            const workflowState = teamContext.workflowStates.find(
              (ws) => ws.id === resolvedWorkflowStateId || ws.name.toLowerCase() === resolvedWorkflowStateId?.toLowerCase()
            )
            if (workflowState) {
              resolvedWorkflowStateId = workflowState.id
            }

            // Resolve project by key, name, or ID
            let resolvedProjectId = projectId
            if (projectId) {
              const project = teamContext.projects.find(
                (p) => p.id === projectId || p.key.toLowerCase() === projectId.toLowerCase() || p.name.toLowerCase() === projectId.toLowerCase()
              )
              if (project) {
                resolvedProjectId = project.id
              } else {
                // Project was provided but not found
                const availableProjects = teamContext.projects.length > 0 
                  ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                  : 'No projects available'
                return {
                  success: false,
                  error: `The project "${projectId}" was not found. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}. Please specify a valid project name, key, or ID.` : 'Please create a project first or specify an existing project.'}`,
                }
              }
            }

            // Resolve assignee by name or ID
            let resolvedAssigneeId = assigneeId
            if (assigneeId) {
              const member = teamContext.members.find(
                (m) => m.userId === assigneeId || m.userName.toLowerCase() === assigneeId.toLowerCase()
              )
              if (member) {
                resolvedAssigneeId = member.userId
              }
            }

            // Resolve labels by name or ID
            let resolvedLabelIds = labelIds
            if (labelIds && labelIds.length > 0) {
              resolvedLabelIds = labelIds.map(labelIdOrName => {
                const label = teamContext.labels.find(
                  (l) => l.id === labelIdOrName || l.name.toLowerCase() === labelIdOrName.toLowerCase()
                )
                return label ? label.id : labelIdOrName
              })
            }

            // Type assertion is safe here because we already validated title, workflowStateId, priority, and projectId exist
            const issueTitle = title || ''
            const issueWorkflowStateId = workflowStateId || defaultWorkflowState?.id || teamContext.workflowStates[0]?.id || ''
            // Priority is validated above, so we know it's provided (not null/undefined)
            // If it's explicitly 'none', that's a valid choice from the user
            const issuePriority = priority ?? 'none'
            // Project is validated and resolved above, so we know it exists
            const issueProjectId = resolvedProjectId!
            
            const issue = await createIssue(
              teamId,
              {
                title: issueTitle,
                description: description || undefined,
                projectId: issueProjectId,
                workflowStateId: resolvedWorkflowStateId!,
                assigneeId: resolvedAssigneeId || undefined,
                priority: issuePriority,
                estimate: estimate || undefined,
                labelIds: resolvedLabelIds || undefined,
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

            // Resolve workflow state by name or ID
            let resolvedWorkflowStateId = workflowStateId
            if (workflowStateId) {
              const workflowState = teamContext.workflowStates.find(
                (ws) => ws.id === workflowStateId || ws.name.toLowerCase() === workflowStateId.toLowerCase()
              )
              if (workflowState) {
                resolvedWorkflowStateId = workflowState.id
              }
            }

            // Resolve assignee by name or ID and get the assignee name
            let resolvedAssigneeId = assigneeId
            let resolvedAssigneeName: string | null = null
            if (assigneeId && assigneeId !== 'unassigned' && assigneeId !== 'null' && assigneeId !== 'undefined') {
              const member = teamContext.members.find(
                (m) => m.userId === assigneeId || m.userName.toLowerCase() === assigneeId.toLowerCase()
              )
              if (member) {
                resolvedAssigneeId = member.userId
                resolvedAssigneeName = member.userName
              }
            } else if (assigneeId === null || assigneeId === 'unassigned' || assigneeId === 'null' || assigneeId === 'undefined') {
              // Explicitly unassign
              resolvedAssigneeId = null
              resolvedAssigneeName = null
            }

            // Resolve labels by name or ID
            let resolvedLabelIds = labelIds
            if (labelIds && labelIds.length > 0) {
              resolvedLabelIds = labelIds.map(labelIdOrName => {
                const label = teamContext.labels.find(
                  (l) => l.id === labelIdOrName || l.name.toLowerCase() === labelIdOrName.toLowerCase()
                )
                return label ? label.id : labelIdOrName
              })
            }

            const issue = await updateIssue(teamId, resolvedIssueId, {
              ...(newTitle && { title: newTitle }),
              ...(description !== undefined && { description }),
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

      createProject: tool({
        description: 'Create a new project. The color parameter is optional and defaults to #6366f1 if not provided. The status parameter is optional and defaults to "active" if not provided.',
        inputSchema: z.object({
          name: z.string().describe('The name of the project'),
          description: z.string().optional(),
          key: z.string().describe('A 3-letter project identifier'),
          color: z.string().optional(),
          icon: z.string().optional(),
          leadId: z.string().optional(),
          status: z.enum(['active', 'completed', 'canceled']).optional().describe('The status of the project (active, completed, or canceled)'),
        }),
        execute: async ({ name, description, key, color, icon, leadId, status }) => {
          try {
            // Default color if not provided
            const projectColor = color || '#6366f1'
            // Default status if not provided
            const projectStatus = status || 'active'
            
            const project = await createProject(teamId, {
              name,
              description,
              key,
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
        description: 'Invite a new team member via email',
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
    }

    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages([...conversationMessages, ...messages])

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

    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finalMessages }) => {
        // Save messages to database
        if (conversationId && finalMessages) {
          try {
            // Verify conversation exists before trying to save messages
            const conversation = await db.chatConversation.findUnique({
              where: { id: conversationId },
            })

            if (conversation) {
              await saveChatMessages({
                conversationId,
                messages: finalMessages.map(msg => {
                  // Extract text content from parts array
                  const textContent = msg.parts
                    .filter(part => part.type === 'text')
                    .map(part => part.text)
                    .join(' ')
                  
                  // Extract tool calls from parts
                  const toolCalls = msg.parts
                    .filter(part => isToolUIPart(part))
                    .map(part => part)
                  
                  return {
                    role: msg.role,
                    content: textContent || '',
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                  }
                }),
              })
            }
          } catch (error) {
            console.error('Error saving chat messages:', error)
            // Don't throw - we don't want to fail the response
          }
        }
      },
    })
  } catch (error) {
    console.error('Error in chat route:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
