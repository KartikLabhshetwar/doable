import { cn } from '@/lib/utils'
import { IssueWithRelations, PriorityLevel } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { PriorityIcon } from '@/components/shared/priority-icon'
import { AssigneeAvatar } from '@/components/shared/assignee-avatar'
import { Loader2 } from 'lucide-react'

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
  const issueId = `${issue.project?.key || issue.team.key}-${issue.number}`
  const isOptimistic = (issue as any).isOptimistic || issue.id.startsWith('temp-')
  
  // Get assignee initials for the custom gradient circle
  const getAssigneeInitials = (name?: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return '??'
  }

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
            <AssigneeAvatar
              assigneeId={issue.assigneeId}
              assignee={issue.assignee}
              size="sm"
              fallback={null}
              className="hidden"
              // Custom render function for board card design
              render={(name) => {
                if (!issue.assigneeId && !name) return null
                const initials = getAssigneeInitials(name)
                return (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium flex-shrink-0">
                    {initials}
                  </div>
                )
              }}
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-normal text-sm text-foreground leading-snug line-clamp-2">
          {issue.title}
        </h3>

      </div>
    </Card>
  )
}
