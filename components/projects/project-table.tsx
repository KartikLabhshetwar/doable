'use client'

import { useState } from 'react'
import { ProjectWithRelations } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { ActionsMenu, projectActions } from '@/components/shared/actions-menu'
import { UserAvatar } from '@/components/shared/user-avatar'

interface ProjectTableProps {
  projects: ProjectWithRelations[]
  onProjectClick?: (project: ProjectWithRelations) => void
  onProjectUpdate?: (projectId: string, updates: Partial<ProjectWithRelations>) => void
  onProjectEdit?: (project: ProjectWithRelations) => void
  onProjectDelete?: (projectId: string) => void
  onProjectDuplicate?: (project: ProjectWithRelations) => void
  onProjectArchive?: (projectId: string) => void
  className?: string
}

export function ProjectTable({ 
  projects, 
  onProjectClick, 
  onProjectUpdate,
  onProjectEdit,
  onProjectDelete,
  onProjectDuplicate,
  onProjectArchive,
  className 
}: ProjectTableProps) {
  const [sortField, setSortField] = useState<'name' | 'status' | 'createdAt' | 'issues'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: 'name' | 'status' | 'createdAt' | 'issues') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

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

  const formatDate = (date: Date | string) => {
    if (!date) return 'N/A'
    
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'N/A'
    }
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj)
  }

  const sortedProjects = [...projects].sort((a, b) => {
    let aValue: any, bValue: any

    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'status':
        aValue = a.status
        bValue = b.status
        break
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
        break
      case 'issues':
        aValue = a._count.issues
        bValue = b._count.issues
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const SortButton = ({ field, children }: { field: 'name' | 'status' | 'createdAt' | 'issues', children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </span>
    </Button>
  )

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium">Projects</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 font-medium text-muted-foreground">
                  <SortButton field="name">Name</SortButton>
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  <SortButton field="status">Status</SortButton>
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  Lead
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  Members
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  <SortButton field="issues">Issues</SortButton>
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  <SortButton field="createdAt">Created</SortButton>
                </th>
                <th className="text-right p-4 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map((project) => (
                <tr 
                  key={project.id}
                  className="border-b border-border/50 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{project.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{project.key}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div 
                      className="text-xs px-2 py-1 rounded text-white font-medium inline-block"
                      style={{ backgroundColor: getStatusColor(project.status) }}
                    >
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </div>
                  </td>
                  <td className="p-4">
                    {project.lead ? (
                      <UserAvatar name={project.lead} size="sm" />
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {(project as any).members && (project as any).members.length > 0 ? (
                      <div className="flex items-center -space-x-1">
                        {(project as any).members.slice(0, 4).map((member: any, idx: number) => (
                          <div
                            key={member.id}
                            className="relative"
                            style={{ zIndex: (project as any).members.length - idx }}
                          >
                            <UserAvatar
                              name={member.userName}
                              size="sm"
                              className="border border-background"
                            />
                          </div>
                        ))}
                        {(project as any).members.length > 4 && (
                          <div className="h-6 w-6 rounded-full bg-muted border border-background flex items-center justify-center text-[10px] text-muted-foreground font-medium ml-1 relative" style={{ zIndex: 0 }}>
                            +{(project as any).members.length - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">
                      {project._count.issues}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(project.createdAt)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <ActionsMenu
                      actions={[
                        projectActions.edit(() => onProjectEdit?.(project)),
                        projectActions.duplicate(() => onProjectDuplicate?.(project)),
                        projectActions.archive(() => onProjectArchive?.(project.id)),
                        projectActions.delete(() => onProjectDelete?.(project.id)),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
