import { Issue, Project, WorkflowState, Label, Comment, Team, IssueLabel } from '@prisma/client'

// Extended types with relations
export type IssueWithRelations = Issue & {
  project?: Project | null
  workflowState: WorkflowState
  team: Team
  assignee?: string | null
  creator: string
  labels: (IssueLabel & { label: Label })[]
  comments: Comment[]
}

export type ProjectWithRelations = Project & {
  team: Team
  lead?: string | null
  issues: Issue[]
  _count: {
    issues: number
  }
}

export type WorkflowStateWithCount = WorkflowState & {
  _count: {
    issues: number
  }
}

export type LabelWithCount = Label & {
  _count: {
    issues: number
  }
}

// API Response types
export interface CreateIssueData {
  title: string
  description?: string
  projectId?: string
  workflowStateId: string
  assigneeId?: string
  assignee?: string
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  estimate?: number
  labelIds?: string[]
}

export interface UpdateIssueData {
  title?: string
  description?: string | null
  projectId?: string | null
  workflowStateId?: string
  assigneeId?: string | null
  assignee?: string | null
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  estimate?: number | null
  labelIds?: string[]
  number?: number
}

export interface CreateProjectData {
  name: string
  description?: string
  key: string
  color?: string
  icon?: string
  leadId?: string
  lead?: string
  status?: 'active' | 'completed' | 'canceled'
}

export interface UpdateProjectData {
  name?: string
  description?: string
  key?: string
  color?: string
  icon?: string
  leadId?: string | null
  lead?: string | null
  status?: 'active' | 'completed' | 'canceled'
}

export interface CreateWorkflowStateData {
  name: string
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  color?: string
  position?: number
}

export interface CreateLabelData {
  name: string
  color?: string
}

// Filter types
export interface IssueFilters {
  status?: string[]
  assignee?: string[]
  project?: string[]
  label?: string[]
  priority?: string[]
  search?: string
}

export interface IssueSort {
  field: 'title' | 'createdAt' | 'updatedAt' | 'priority' | 'number'
  direction: 'asc' | 'desc'
}

// View types
export type ViewType = 'list' | 'board' | 'table'

// Priority levels
export const PRIORITY_LEVELS = {
  none: { label: 'None', value: 0, color: '#64748b' },
  low: { label: 'Low', value: 1, color: '#10b981' },
  medium: { label: 'Medium', value: 2, color: '#f59e0b' },
  high: { label: 'High', value: 3, color: '#ef4444' },
  urgent: { label: 'Urgent', value: 4, color: '#dc2626' },
} as const

export type PriorityLevel = keyof typeof PRIORITY_LEVELS

// Workflow state types
export const WORKFLOW_STATE_TYPES = {
  backlog: { label: 'Backlog', color: '#64748b' },
  unstarted: { label: 'Todo', color: '#8b5cf6' },
  started: { label: 'In Progress', color: '#3b82f6' },
  completed: { label: 'Done', color: '#10b981' },
  canceled: { label: 'Canceled', color: '#ef4444' },
} as const

export type WorkflowStateType = keyof typeof WORKFLOW_STATE_TYPES
