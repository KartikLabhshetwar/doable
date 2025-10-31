'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectTable } from '@/components/projects/project-table'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { ProjectList } from '@/components/projects/project-list'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { CreateProjectData, UpdateProjectData, ProjectWithRelations } from '@/lib/types'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useTransition } from 'react'
import { ProjectCardSkeleton } from '@/components/ui/skeletons'
import { Plus, Filter, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/lib/hooks/use-projects'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

interface ProjectFilters {
  status?: string[]
  lead?: string[]
  search?: string
}

export default function ProjectsPage() {
  const params = useParams<{ teamId: string }>()
  const teamId = params.teamId
  const queryClient = useQueryClient()

  // Use TanStack Query hooks
  const { data: projects = [], isLoading: loading, error: queryError } = useProjects(teamId)
  const createProject = useCreateProject(teamId)
  const updateProject = useUpdateProject(teamId)
  const deleteProject = useDeleteProject(teamId)

  const [teamKey, setTeamKey] = useState<string>('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<ProjectWithRelations | null>(null)
  const [currentView, setCurrentView] = useState<'list' | 'table'>('list')
  const [filters, setFilters] = useState<ProjectFilters>({
    status: [],
    lead: [],
    search: ''
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  const [isPending, startTransition] = useTransition()

  // Extract team key from projects
  useEffect(() => {
    if (projects.length > 0 && projects[0].team?.key && !teamKey) {
      setTeamKey(projects[0].team.key)
    }
  }, [projects, teamKey])

  // Add event listener to refresh projects when chatbot creates/updates projects
  useEffect(() => {
    const handleRefresh = () => {
      // Invalidate queries to refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
      }, 50)
    }

    window.addEventListener('refresh-projects', handleRefresh)
    
    return () => {
      window.removeEventListener('refresh-projects', handleRefresh)
    }
  }, [teamId, queryClient])

  const handleProjectEdit = (project: ProjectWithRelations) => {
    setCurrentProject(project)
    setEditDialogOpen(true)
  }

  const handleProjectDelete = async (projectId: string) => {
    startTransition(async () => {
      try {
        await deleteProject.mutateAsync(projectId)
        toast.success('Project deleted successfully')
      } catch (error: any) {
        console.error('Error deleting project:', error)
        toast.error('Failed to delete project', {
          description: error.message || 'Please try again',
        })
      }
    })
  }

  const handleProjectDuplicate = async (project: ProjectWithRelations) => {
    try {
      const duplicateData: CreateProjectData = {
        name: `${project.name} (Copy)`,
        description: project.description ?? undefined,
        key: `${project.key}-COPY`,
        color: project.color,
        icon: project.icon ?? undefined,
        leadId: project.leadId ?? undefined,
      }
      
      startTransition(async () => {
        try {
          await createProject.mutateAsync(duplicateData)
          toast.success('Project duplicated successfully')
        } catch (error: any) {
          console.error('Error duplicating project:', error)
          toast.error('Failed to duplicate project', {
            description: error.message || 'Please try again',
          })
        }
      })
    } catch (error: any) {
      console.error('Error duplicating project:', error)
      toast.error('Failed to duplicate project', {
        description: error.message || 'Please try again',
      })
    }
  }

  const handleProjectUpdate = async (data: CreateProjectData | UpdateProjectData) => {
    if (!currentProject) return

    try {
      await updateProject.mutateAsync({ projectId: currentProject.id, data })
      toast.success('Project updated successfully')
    } catch (error: any) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project', {
        description: error.message || 'Please try again',
      })
      throw error
    }
  }

  const handleProjectArchive = async (projectId: string) => {
    startTransition(async () => {
      try {
        await updateProject.mutateAsync({ projectId, data: { status: 'canceled' } })
        toast.success('Project archived successfully')
      } catch (error: any) {
        console.error('Error archiving project:', error)
        toast.error('Failed to archive project', {
          description: error.message || 'Please try again',
        })
      }
    })
  }

  const handleCreateProject = async (data: CreateProjectData | UpdateProjectData) => {
    try {
      await createProject.mutateAsync(data as CreateProjectData)
      toast.success('Project created successfully', {
        description: `Project "${data.name}" has been created`,
      })
    } catch (error: any) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project', {
        description: error.message || 'Please try again',
      })
      throw error
    }
  }

  // Filter functions
  const updateFilter = (key: keyof ProjectFilters, value: string[] | string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilter = (key: keyof ProjectFilters) => {
    setFilters(prev => ({
      ...prev,
      [key]: key === 'search' ? '' : []
    }))
  }

  const clearAllFilters = () => {
    setFilters({
      status: [],
      lead: [],
      search: ''
    })
  }

  const getActiveFilterCount = () => {
    return Object.entries(filters).filter(([key, value]) => 
      key !== 'search' && (Array.isArray(value) ? value.length > 0 : value !== '' && value !== undefined)
    ).length
  }

  const hasActiveFilters = getActiveFilterCount() > 0

  // Get unique leads from projects
  const uniqueLeads = Array.from(new Set(projects.map(p => p.lead).filter(Boolean))) as string[]

  // Filter projects based on current filters
  const filteredProjects = projects.filter(project => {
    // Search filter removed
    const searchMatch = true

    // Status filter
    const statusMatch = !filters.status || filters.status.length === 0 || 
      filters.status.includes(project.status)

    // Lead filter
    const leadMatch = !filters.lead || filters.lead.length === 0 || 
      (project.lead && filters.lead.includes(project.lead))

    return searchMatch && statusMatch && leadMatch
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex)

  // Calculate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push('ellipsis')
      }
      
      // Show current page and neighbors
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1)
  }, [filters])

  const error = queryError ? 'Failed to load projects. Please try again.' : null

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-border/50">
          <CardContent className="text-center py-12">
            <div className="mb-6">
              <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-3">Something went wrong</h3>
            <p className="text-body-medium text-muted-foreground mb-6">{error}</p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['projects', teamId] })}
              className="font-medium"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Manage your team&apos;s projects</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="font-medium" size="sm">
                <Filter className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 sm:ml-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              {['active', 'completed', 'canceled'].map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filters.status?.includes(status) || false}
                  onCheckedChange={(checked) => {
                    const currentStatuses = filters.status || []
                    const newStatuses = checked
                      ? [...currentStatuses, status]
                      : currentStatuses.filter(s => s !== status)
                    updateFilter('status', newStatuses)
                  }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Lead</DropdownMenuLabel>
              {uniqueLeads.map((lead) => (
                <DropdownMenuCheckboxItem
                  key={lead}
                  checked={filters.lead?.includes(lead) || false}
                  onCheckedChange={(checked) => {
                    const currentLeads = filters.lead || []
                    const newLeads = checked
                      ? [...currentLeads, lead]
                      : currentLeads.filter(l => l !== lead)
                    updateFilter('lead', newLeads)
                  }}
                >
                  {lead}
                </DropdownMenuCheckboxItem>
              ))}

              {hasActiveFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={clearAllFilters}
                    className="text-red-600 focus:text-red-600"
                  >
                    Clear all filters
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="font-medium"
            size="sm"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Create Project</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center justify-between sm:justify-end">
        <span className="text-sm text-muted-foreground sm:hidden">Views</span>
        <ViewSwitcher
          currentView={currentView}
          onViewChange={(view) => setCurrentView(view as 'list' | 'table')}
          views={['list', 'table']}
        />
      </div>

      {/* Projects Grid */}
      <div className="space-y-6">
        {filteredProjects.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-16">
              <div className="text-muted-foreground">
                {hasActiveFilters ? (
                  <>
                    <p className="text-xl font-medium text-foreground mb-2">No projects found</p>
                    <p className="text-body-medium mb-4">Try adjusting your search terms or filters</p>
                    <Button 
                      variant="outline"
                      className="font-medium" 
                      onClick={clearAllFilters}
                    >
                      Clear all filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-medium text-foreground mb-2">No projects yet</p>
                    <p className="text-body-medium mb-6">Create your first project to get started</p>
                    <Button 
                      className="font-medium" 
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProjectCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <>
                {currentView === 'list' && (
                  <Card className="border-border/50">
                    <CardContent className="p-0">
                      <ProjectList
                        projects={filteredProjects}
                        onCreateProject={(status) => {
                          setCurrentProject(null)
                          setCreateDialogOpen(true)
                        }}
                        onProjectClick={(project) => {
                          handleProjectEdit(project)
                        }}
                        onProjectCheck={async (projectId, checked) => {
                          startTransition(async () => {
                            try {
                              await updateProject.mutateAsync({ 
                                projectId, 
                                data: { status: checked ? 'completed' : 'active' } 
                              })
                            } catch (error: any) {
                              console.error('Error updating project:', error)
                              toast.error('Failed to update project status', {
                                description: error.message || 'Please try again',
                              })
                            }
                          })
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {currentView === 'table' && (
                  <ProjectTable
                    projects={paginatedProjects}
                    onProjectUpdate={async (projectId, updates) => {
                      try {
                        await updateProject.mutateAsync({ projectId, data: updates })
                      } catch (error: any) {
                        console.error('Error updating project:', error)
                        toast.error('Failed to update project', {
                          description: error.message || 'Please try again',
                        })
                      }
                    }}
                    onProjectEdit={handleProjectEdit}
                    onProjectDelete={handleProjectDelete}
                    onProjectDuplicate={handleProjectDuplicate}
                    onProjectArchive={handleProjectArchive}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Pagination - Only show for table view */}
        {currentView === 'table' && filteredProjects.length > itemsPerPage && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {getPageNumbers().map((page, index) => (
                <PaginationItem key={`${page}-${index}`}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(page as number)
                      }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* Create Project Dialog */}
      <ProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateProject}
        title="Create Project"
        description="Create a new project for your team."
        teamId={teamId}
      />

      {/* Edit Project Dialog */}
      <ProjectDialog
        open={editDialogOpen && !!currentProject}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setCurrentProject(null)
        }}
        onSubmit={async (data) => {
          await handleProjectUpdate(data)
        }}
        initialData={currentProject ? {
          name: currentProject.name,
          description: currentProject.description ?? undefined,
          key: currentProject.key,
          color: currentProject.color,
          icon: currentProject.icon ?? undefined,
          leadId: currentProject.leadId ?? undefined,
          status: currentProject.status as any,
        } : undefined}
        title="Edit Project"
        description="Update the project details."
        teamId={teamId}
        projectId={currentProject?.id}
      />

      </div>
    </ErrorBoundary>
  )
}
