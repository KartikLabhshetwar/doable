import { cn } from '@/lib/utils'
import { IssueWithRelations, PriorityLevel } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { PriorityIcon } from '@/components/shared/priority-icon'
import { Circle, X, Loader2 } from 'lucide-react'

interface IssueCardProps {
  issue: IssueWithRelations
  onClick?: () => void
  className?: string
  isDragging?: boolean
}

export function IssueCard({ 
  issue, 
  onClick,
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
  
  const isOptimistic = (issue as any).isOptimistic || issue.id.startsWith('temp-')

  return (
    <Card
      className={cn(
        'p-2.5 sm:p-3 cursor-pointer transition-all hover:shadow-sm border-border/40 bg-card/80 backdrop-blur-sm',
        'touch-manipulation active:scale-[0.98]',
        isDragging && 'opacity-50',
        isOptimistic && 'opacity-75 animate-pulse border-primary/30',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2.5">
        {/* Issue ID */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOptimistic && (
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
            )}
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {issueId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Priority */}
            <PriorityIcon 
              priority={(issue.priority || 'none') as PriorityLevel} 
              className="opacity-70"
            />
            {/* Assignee */}
            {issue.assignee && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">
                {assigneeInitials.slice(0, 2)}
              </div>
            )}
          </div>
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

      </div>
    </Card>
  )
}
