'use client'

import { IssueWithRelations } from '@/lib/types'
import { WorkflowState, Project, Label } from '@prisma/client'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityIcon } from '@/components/shared/priority-icon'
import { LabelBadge } from '@/components/shared/label-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IssueTableProps {
  issues: IssueWithRelations[]
  workflowStates: WorkflowState[]
  projects: Project[]
  onIssueClick?: (issue: IssueWithRelations) => void
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  className?: string
}

export function IssueTable({
  issues,
  workflowStates,
  projects,
  onIssueClick,
  onSort,
  sortField,
  sortDirection,
  className
}: IssueTableProps) {
  const formatDate = (date: Date | string) => {
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj)
  }

  const getProjectInfo = (issue: any) => {
    // First try to get from the project relation (if included in the query)
    if (issue.project) {
      return issue.project
    }
    // Fallback to looking up by ID in the projects list
    if (issue.projectId) {
      return projects.find(p => p.id === issue.projectId)
    }
    return null
  }

  const getWorkflowState = (stateId: string) => {
    return workflowStates.find(s => s.id === stateId)
  }

  const handleSort = (field: string) => {
    if (!onSort) return
    
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(field, newDirection)
  }

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => {
    if (!onSort) return <>{children}</>
    
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 font-medium hover:bg-transparent"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown className="h-3 w-3" />
        </div>
      </Button>
    )
  }

  return (
    <div className={`rounded-md border ${className}`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton field="title">Title</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="number">ID</SortButton>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>
              <SortButton field="createdAt">Created</SortButton>
            </TableHead>
            <TableHead>Comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No issues found
              </TableCell>
            </TableRow>
          ) : (
            issues.map((issue) => {
              const workflowState = getWorkflowState(issue.workflowStateId)
              const project = getProjectInfo(issue)
              const isOptimistic = (issue as any).isOptimistic || issue.id.startsWith('temp-')
              
              return (
                <TableRow
                  key={issue.id}
                  className={cn(
                    "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800",
                    isOptimistic && "opacity-75"
                  )}
                  onClick={() => onIssueClick?.(issue)}
                >
                  <TableCell className="font-medium">
                    <div className="max-w-xs">
                      <div className="flex items-center gap-2 truncate">
                        {isOptimistic && (
                          <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />
                        )}
                        <span className="truncate">{issue.title}</span>
                      </div>
                      {issue.description && (
                        <div className="text-sm text-gray-500 truncate mt-1">
                          {issue.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {issue.project?.key || issue.team.key}-{issue.number}
                  </TableCell>
                  <TableCell>
                    {workflowState && (
                      <StatusBadge status={workflowState} />
                    )}
                  </TableCell>
                  <TableCell>
                    <PriorityIcon priority={issue.priority as any} showLabel={true} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {project ? (
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ 
                        backgroundColor: `${project.color || '#6366f1'}20`,
                        color: project.color || '#6366f1'
                      }}>
                        {project.key}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {issue.assignee ? (
                      <UserAvatar name={issue.assignee} size="sm" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.slice(0, 2).map((issueLabel) => (
                        <LabelBadge key={issueLabel.id} label={issueLabel.label} />
                      ))}
                      {issue.labels.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{issue.labels.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(issue.createdAt)}
                  </TableCell>
                  <TableCell>
                    {issue.comments.length > 0 ? (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MessageSquare className="h-3 w-3" />
                        {issue.comments.length}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
