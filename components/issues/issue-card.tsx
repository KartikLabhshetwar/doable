import { cn } from '@/lib/utils'
import { IssueWithRelations } from '@/lib/types'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Card } from '@/components/ui/card'
import { ActionsMenu, issueActions } from '@/components/shared/actions-menu'
import { Circle, X } from 'lucide-react'

interface IssueCardProps {
  issue: IssueWithRelations
  onClick?: () => void
  onView?: (issue: IssueWithRelations) => void
  onEdit?: (issue: IssueWithRelations) => void
  onAssign?: (issue: IssueWithRelations) => void
  onMove?: (issue: IssueWithRelations) => void
  onDelete?: (issueId: string) => void
  className?: string
  isDragging?: boolean
}

export function IssueCard({ 
  issue, 
  onClick, 
  onView,
  onEdit,
  onAssign,
  onMove,
  onDelete,
  className, 
  isDragging 
}: IssueCardProps) {
  // Determine status indicator based on workflow state type
  const getStatusIcon = () => {
    const stateType = issue.workflowState.type.toLowerCase()
    if (stateType === 'canceled' || stateType === 'completed') {
      return <X className="h-3.5 w-3.5 text-muted-foreground" />
    } else if (stateType === 'unstarted') {
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/40 stroke-2" />
    } else {
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/40 stroke-2" />
    }
  }

  const issueId = `${issue.project?.key || issue.team.key}-${issue.number}`
  const assigneeInitials = issue.assignee
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || ''

  return (
    <Card
      className={cn(
        'p-2.5 sm:p-3 cursor-pointer transition-all hover:shadow-sm border-border/40 bg-card/80 backdrop-blur-sm',
        'touch-manipulation active:scale-[0.98]',
        isDragging && 'opacity-50',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2.5">
        {/* Issue ID */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {issueId}
          </span>
          {issue.assignee && (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">
              {assigneeInitials.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Title with status indicator */}
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            {getStatusIcon()}
          </div>
          <h3 className="font-normal text-sm text-foreground leading-snug line-clamp-2 flex-1">
            {issue.title}
          </h3>
        </div>

        {/* Footer with actions menu */}
        <div className="flex items-center justify-end pt-1" onClick={(e) => e.stopPropagation()}>
          <ActionsMenu
            actions={[
              issueActions.view(() => onView?.(issue)),
              issueActions.edit(() => onEdit?.(issue)),
              issueActions.assign(() => onAssign?.(issue)),
              issueActions.move(() => onMove?.(issue)),
              issueActions.delete(() => onDelete?.(issue.id)),
            ]}
            trigger={
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted/70 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
              >
                <span className="text-xs">⋯</span>
              </button>
            }
          />
        </div>
      </div>
    </Card>
  )
}
