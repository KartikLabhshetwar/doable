'use client'

import { useState, useMemo } from 'react'
import { ProjectWithRelations } from '@/lib/types'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus, MoreVertical, X } from 'lucide-react'

interface ProjectListProps {
  projects: ProjectWithRelations[]
  onCreateProject?: (status?: string) => void
  onProjectClick?: (project: ProjectWithRelations) => void
  onProjectCheck?: (projectId: string, checked: boolean) => void
}

const statusOrder = ['active', 'completed', 'canceled']
const statusLabels = {
  active: 'Active',
  completed: 'Completed',
  canceled: 'Canceled',
}

export function ProjectList({
  projects,
  onCreateProject,
  onProjectClick,
  onProjectCheck,
}: ProjectListProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Group projects by status
  const groupedProjects = useMemo(() => {
    const groups: Record<string, ProjectWithRelations[]> = {
      active: [],
      completed: [],
      canceled: [],
    }
    
    projects.forEach(project => {
      const status = project.status || 'active'
      if (!groups[status]) {
        groups[status] = []
      }
      groups[status].push(project)
    })
    
    return groups
  }, [projects])

  const toggleSection = (status: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const formatDate = (date: Date | string) => {
    if (!date) return ''
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

  const isCompleted = (status: string) => {
    return status === 'completed' || status === 'canceled'
  }

  return (
    <div className="space-y-1">
      {statusOrder.map((status) => {
        const statusProjects = groupedProjects[status] || []
        const isCollapsed = collapsedSections.has(status)
        const isCanceled = status === 'canceled'
        
        if (statusProjects.length === 0 && !onCreateProject) return null

        return (
          <div key={status} className="border-b border-border/50 last:border-b-0">
            {/* Section Header */}
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors group">
              <button
                type="button"
                onClick={() => toggleSection(status)}
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
                  {statusLabels[status as keyof typeof statusLabels]}
                </span>
                
                <span className="text-xs text-muted-foreground">
                  {statusProjects.length}
                </span>
              </button>
              
              {onCreateProject && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 z-10 relative"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onCreateProject(status)
                  }}
                  aria-label={`Create project in ${statusLabels[status as keyof typeof statusLabels]}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Section Items */}
            {!isCollapsed && statusProjects.length > 0 && (
              <div className="pb-1">
                {statusProjects.map((project) => {
                  const isProjectCompleted = isCompleted(project.status)
                  
                  return (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors group/item cursor-pointer"
                      onClick={() => onProjectClick?.(project)}
                    >
                      {/* Left icon/ellipsis */}
                      <div className="flex-shrink-0">
                        <MoreVertical className="h-4 w-4 text-muted-foreground/60" />
                      </div>

                      {/* Project key */}
                      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                        {project.key}
                      </span>

                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onProjectCheck?.(project.id, !isProjectCompleted)
                        }}
                        className="flex-shrink-0"
                      >
                        {isProjectCompleted ? (
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center">
                            <X className="h-2.5 w-2.5 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </button>

                      {/* Project name */}
                      <span className="flex-1 text-sm text-foreground truncate">
                        {project.name}
                      </span>

                      {/* Lead avatar */}
                      <div className="flex-shrink-0">
                        {project.lead ? (
                          <UserAvatar name={project.lead} size="sm" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-muted-foreground/20 flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(project.createdAt)}
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

