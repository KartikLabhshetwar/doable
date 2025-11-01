'use client'

import { useState, useMemo } from 'react'
import { WorkflowState } from '@prisma/client'
import { IssueWithRelations, PriorityLevel } from '@/lib/types'
import { AssigneeAvatar } from '@/components/shared/assignee-avatar'
import { PriorityIcon } from '@/components/shared/priority-icon'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus, X, Loader2 } from 'lucide-react'
import { ActionsMenu, issueActions } from '@/components/shared/actions-menu'
import { cn } from '@/lib/utils'

interface IssueListProps {
  issues: IssueWithRelations[]
  workflowStates: WorkflowState[]
  onCreateIssue?: (workflowStateId?: string) => void
  onIssueClick?: (issue: IssueWithRelations) => void
  onIssueCheck?: (issueId: string, checked: boolean) => void
  onStatusChange?: (issueId: string, workflowStateId: string) => void
  onIssueView?: (issue: IssueWithRelations) => void
  onIssueEdit?: (issue: IssueWithRelations) => void
  onIssueAssign?: (issue: IssueWithRelations) => void
  onIssueMove?: (issue: IssueWithRelations) => void
  onIssueDelete?: (issueId: string) => void
}

export function IssueList({
  issues,
  workflowStates,
  onCreateIssue,
  onIssueClick,
  onIssueCheck,
  onStatusChange,
  onIssueView,
  onIssueEdit,
  onIssueAssign,
  onIssueMove,
  onIssueDelete,
}: IssueListProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Group issues by workflow state
  const groupedIssues = useMemo(() => {
    const groups: Record<string, IssueWithRelations[]> = {}
    
    workflowStates.forEach(state => {
      groups[state.id] = []
    })
    
    issues.forEach(issue => {
      if (!groups[issue.workflowStateId]) {
        groups[issue.workflowStateId] = []
      }
      groups[issue.workflowStateId].push(issue)
    })
    
    return groups
  }, [issues, workflowStates])

  // Sort workflow states by position or name
  const sortedWorkflowStates = useMemo(() => {
    return [...workflowStates].sort((a, b) => {
      if ('position' in a && 'position' in b) {
        return (a.position as number) - (b.position as number)
      }
      return a.name.localeCompare(b.name)
    })
  }, [workflowStates])

  const toggleSection = (stateId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(stateId)) {
        next.delete(stateId)
      } else {
        next.add(stateId)
      }
      return next
    })
  }

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return ''
    
    const today = new Date()
    const isThisYear = dateObj.getFullYear() === today.getFullYear()
    
    if (isThisYear) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(dateObj)
    }
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj)
  }

  const getIssueIdentifier = (issue: IssueWithRelations) => {
    return `${issue.project?.key || issue.team.key}-${issue.number}`
  }

  const isCompleted = (stateType: string) => {
    return stateType === 'completed' || stateType === 'canceled'
  }

  return (
    <div className="space-y-1">
      {sortedWorkflowStates.map((state) => {
        const stateIssues = groupedIssues[state.id] || []
        const isCollapsed = collapsedSections.has(state.id)
        const isCanceled = state.type === 'canceled'
        
        if (stateIssues.length === 0 && !onCreateIssue) return null

        return (
          <div key={state.id} className="border-b border-border/50 last:border-b-0">
            {/* Section Header */}
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors group">
              <button
                onClick={() => toggleSection(state.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                
                {isCanceled && (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center flex-shrink-0">
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                )}
                
                <span className="font-medium text-sm text-foreground">
                  {state.name}
                </span>
                
                <span className="text-xs text-muted-foreground">
                  {stateIssues.length}
                </span>
              </button>
              
              {onCreateIssue && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateIssue(state.id)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Section Items */}
            {!isCollapsed && stateIssues.length > 0 && (
              <div className="pb-1">
                {stateIssues.map((issue) => {
                  const identifier = getIssueIdentifier(issue)
                  const isIssueCompleted = isCompleted(state.type)
                  const isOptimistic = (issue as any).isOptimistic || issue.id.startsWith('temp-')
                  
                  return (
                    <div
                      key={issue.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors group/item cursor-pointer",
                        isOptimistic && "opacity-75"
                      )}
                      onClick={() => onIssueClick?.(issue)}
                    >
                      {/* Issue identifier */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isOptimistic && (
                          <Loader2 className="h-3 w-3 text-primary animate-spin" />
                        )}
                        <span className="text-xs font-mono text-muted-foreground">
                          {identifier}
                        </span>
                      </div>

                      {/* Actions menu - appears on hover */}
                      <div 
                        className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionsMenu
                          actions={[
                            issueActions.view(() => onIssueView?.(issue)),
                            issueActions.edit(() => onIssueEdit?.(issue)),
                            issueActions.assign(() => onIssueAssign?.(issue)),
                            issueActions.move(() => onIssueMove?.(issue)),
                            issueActions.delete(() => onIssueDelete?.(issue.id)),
                          ]}
                          trigger={
                            <button
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/70 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                            >
                              <span className="text-xs">⋯</span>
                            </button>
                          }
                        />
                      </div>

                      {/* Title */}
                      <span className="flex-1 text-sm text-foreground truncate">
                        {issue.title}
                      </span>

                      {/* Priority */}
                      <div className="flex-shrink-0">
                        <PriorityIcon 
                          priority={(issue.priority || 'none') as PriorityLevel} 
                          className="opacity-70"
                        />
                      </div>

                      {/* Assignee avatar */}
                      <div className="flex-shrink-0">
                        <AssigneeAvatar 
                          assigneeId={issue.assigneeId}
                          assignee={issue.assignee}
                          size="sm"
                          fallback={
                            <div className="h-5 w-5 rounded-full border border-muted-foreground/20 flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                            </div>
                          }
                        />
                      </div>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(issue.createdAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

