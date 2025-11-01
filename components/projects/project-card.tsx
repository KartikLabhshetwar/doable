import { cn } from '@/lib/utils'
import { ProjectWithRelations } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { ActionsMenu, projectActions } from '@/components/shared/actions-menu'
import { UserAvatar } from '@/components/shared/user-avatar'

interface ProjectCardProps {
  project: ProjectWithRelations
  onClick?: () => void
  onEdit?: (project: ProjectWithRelations) => void
  onDelete?: (projectId: string) => void
  onDuplicate?: (project: ProjectWithRelations) => void
  onArchive?: (projectId: string) => void
  className?: string
  isDragging?: boolean
}

export function ProjectCard({ 
  project, 
  onClick, 
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  className, 
  isDragging 
}: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981'
      case 'completed':
        return '#3b82f6'
      case 'canceled':
        return '#ef4444'
      default:
        return '#64748b'
    }
  }

  return (
    <Card
      className={cn(
        'p-3 sm:p-4 transition-all hover:bg-muted/50 border-border/50 touch-manipulation active:scale-[0.98]',
        isDragging && 'opacity-50',
        className
      )}
    >
      <div className="space-y-3">
        {/* Header with ID and Status */}
        <div className="flex items-start justify-between">
          <span className="font-mono text-sm text-muted-foreground">
            {project.key}
          </span>
          
          {/* Status Badge */}
          <div 
            className="text-xs px-2 py-1 rounded text-white font-medium"
            style={{ backgroundColor: getStatusColor(project.status) }}
          >
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-foreground text-sm leading-tight line-clamp-2">
          {project.name}
        </h3>

        {/* Footer with issues count, lead, and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {project.lead && (
              <UserAvatar name={project.lead} size="sm" />
            )}
            <span className="text-xs text-muted-foreground">
              {project._count.issues} issues
            </span>
          </div>
          
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <ActionsMenu
              actions={[
                projectActions.edit(() => onEdit?.(project)),
                projectActions.duplicate(() => onDuplicate?.(project)),
                projectActions.archive(() => onArchive?.(project.id)),
                projectActions.delete(() => onDelete?.(project.id)),
              ]}
              trigger={
                <button
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs text-muted-foreground">⋯</span>
                </button>
              }
            />
          </div>
        </div>
      </div>
    </Card>
  )
}