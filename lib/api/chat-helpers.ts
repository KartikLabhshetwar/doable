import { TeamContext } from '@/lib/types/chat'

/**
 * Resolves a workflow state by ID or name
 * Returns null if not found (no defaults - caller must validate)
 */
export function resolveWorkflowState(
  teamContext: TeamContext,
  workflowStateIdOrName?: string | null
): string | null {
  if (!workflowStateIdOrName) {
    return null
  }

  const workflowState = teamContext.workflowStates.find(
    (ws) => ws.id === workflowStateIdOrName || ws.name.toLowerCase() === workflowStateIdOrName.toLowerCase()
  )

  return workflowState?.id || null
}

/**
 * Resolves a project by ID, key, or name
 */
export function resolveProject(
  teamContext: TeamContext,
  projectIdOrKeyOrName?: string | null
): { id: string; name: string; key: string } | null {
  if (!projectIdOrKeyOrName) {
    return null
  }

  const project = teamContext.projects.find(
    (p) => 
      p.id === projectIdOrKeyOrName || 
      p.key.toLowerCase() === projectIdOrKeyOrName.toLowerCase() || 
      p.name.toLowerCase() === projectIdOrKeyOrName.toLowerCase()
  )

  return project || null
}

/**
 * Resolves an assignee by user ID or name
 */
export function resolveAssignee(
  teamContext: TeamContext,
  assigneeIdOrName?: string | null
): { userId: string; userName: string } | null {
  if (!assigneeIdOrName) {
    return null
  }

  const member = teamContext.members.find(
    (m) => m.userId === assigneeIdOrName || m.userName.toLowerCase() === assigneeIdOrName.toLowerCase()
  )

  return member ? { userId: member.userId, userName: member.userName } : null
}

/**
 * Resolves label IDs from an array of label IDs or names
 */
export function resolveLabelIds(
  teamContext: TeamContext,
  labelIdsOrNames?: (string | null)[] | null
): string[] {
  if (!labelIdsOrNames || labelIdsOrNames.length === 0) {
    return []
  }

  return labelIdsOrNames
    .filter((id) => id !== null && id !== undefined)
    .map((labelIdOrName) => {
      const label = teamContext.labels.find(
        (l) => l.id === labelIdOrName || l.name.toLowerCase() === (labelIdOrName || '').toLowerCase()
      )
      return label ? label.id : labelIdOrName!
    })
    .filter((id): id is string => id !== null && id !== undefined)
}

/**
 * Validates required fields for issue creation
 */
export function validateIssueFields(data: {
  title?: string | null
  workflowStateId?: string | null
  priority?: string | null
  projectId?: string | null
}): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  if (!data.title || data.title === 'null' || data.title === 'undefined') {
    missingFields.push('title')
  }

  if (!data.workflowStateId || data.workflowStateId === 'null' || data.workflowStateId === 'undefined') {
    missingFields.push('status (workflow state)')
  }

  if (data.priority === null || data.priority === undefined) {
    missingFields.push('priority')
  }

  if (!data.projectId || data.projectId === 'null' || data.projectId === 'undefined') {
    missingFields.push('project')
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Formats validation error message
 */
export function formatValidationError(
  missingFields: string[],
  teamContext: TeamContext,
  itemLabel: string = 'issue'
): string {
  if (missingFields.length === 0) {
    return ''
  }

  const availableProjects = teamContext.projects.length > 0 
    ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
    : 'No projects available'

  // Special message for priority only
  if (missingFields.includes('priority') && missingFields.length === 1) {
    return `To create this ${itemLabel}, I need to know the priority level. Please specify a priority: low, medium, high, urgent, or none.`
  }

  // Special message for project only
  if (missingFields.includes('project') && missingFields.length === 1) {
    return `To create this ${itemLabel}, I need to know which project to add it to. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}. Please specify which project this ${itemLabel} should be added to.` : 'Please create a project first or specify an existing project.'}`
  }

  // Handle combinations with priority
  if (missingFields.includes('priority') && missingFields.includes('project') && missingFields.length === 2) {
    return `To create this ${itemLabel}, I need two things: (1) the priority level (low, medium, high, urgent, or none), and (2) which project to add it to. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}.` : 'Please create a project first or specify an existing project.'}`
  }

  // Handle combinations including other fields
  if (missingFields.includes('priority')) {
    const otherFields = missingFields.filter(f => f !== 'priority')
    return `Missing required information: ${otherFields.join(', ')}, and priority. Please provide ${otherFields.length === 1 ? 'this' : 'these'} along with a priority level (low, medium, high, urgent, or none) to create the ${itemLabel}.`
  }

  if (missingFields.includes('project')) {
    const otherFields = missingFields.filter(f => f !== 'project')
    return `Missing required information: ${otherFields.join(', ')}, and project. Please provide ${otherFields.length === 1 ? 'this' : 'these'} along with a project. ${teamContext.projects.length > 0 ? `Available projects: ${availableProjects}.` : 'Please create a project first or specify an existing project.'}`
  }

  return `Missing required information: ${missingFields.join(', ')}. Please provide ${missingFields.length === 1 ? 'this' : 'these'} to create the ${itemLabel}.`
}

