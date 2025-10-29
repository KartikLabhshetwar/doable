'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectTable } from '@/components/projects/project-table'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { CreateProjectData, UpdateProjectData, ProjectWithRelations } from '@/lib/types'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ProjectCardSkeleton } from '@/components/ui/skeletons'
import { useToast } from '@/lib/hooks/use-toast'
import { ToastContainer } from '@/lib/hooks/use-toast'
import { Plus, Search, Filter, AlertTriangle, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

  const [projects, setProjects] = useState<ProjectWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<ProjectWithRelations | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'list' | 'table'>('list')
  const [filters, setFilters] = useState<ProjectFilters>({
    status: [],
    lead: [],
    search: ''
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Toast notifications
  const { toasts, toast, removeToast } = useToast()

  // Use ref to store latest fetchProjects to avoid stale closure issues
  const fetchProjectsRef = useRef<((silentRefresh?: boolean) => Promise<void>) | null>(null)

  const fetchProjects = useCallback(async (silentRefresh = false) => {
    try {
      // Only show loading on initial load, not on silent refreshes
      if (!silentRefresh) {
        setLoading(true)
      }
      setError(null)
      const response = await fetch(`/api/teams/${teamId}/projects`, {
        cache: silentRefresh ? 'no-store' : 'default',
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      
      const data = await response.json()
      // Force React to re-render by creating new array reference
      setProjects([...data])
    } catch (error) {
      console.error('Error fetching projects:', error)
      if (!silentRefresh) {
        setError('Failed to load projects. Please try again.')
      }
    } finally {
      if (!silentRefresh) {
        setLoading(false)
      }
    }
  }, [teamId])

  // Keep ref updated with latest fetchProjects
  useEffect(() => {
    fetchProjectsRef.current = fetchProjects
  }, [fetchProjects])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Add event listener to refresh projects when chatbot creates/updates projects
  useEffect(() => {
    const handleRefresh = () => {
      // Fetch immediately - use small delay to ensure backend is ready
      setTimeout(() => {
        if (fetchProjectsRef.current) {
          fetchProjectsRef.current(true)
        }
      }, 50)
    }

    window.addEventListener('refresh-projects', handleRefresh)
    
    return () => {
      window.removeEventListener('refresh-projects', handleRefresh)
    }
  }, [])

  const handleProjectEdit = (project: ProjectWithRelations) => {
    setCurrentProject(project)
    setEditDialogOpen(true)
  }

  const handleProjectDelete = async (projectId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
        toast.success('Project deleted', 'The project has been deleted successfully.')
      } else {
        throw new Error('Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project', 'Please try again.')
    }
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
      
      const response = await fetch(`/api/teams/${teamId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateData),
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects(prev => [newProject, ...prev])
        toast.success('Project duplicated', 'The project has been duplicated successfully.')
      } else {
        throw new Error('Failed to duplicate project')
      }
    } catch (error) {
      console.error('Error duplicating project:', error)
      toast.error('Failed to duplicate project', 'Please try again.')
    }
  }

  const handleProjectUpdate = async (data: CreateProjectData | UpdateProjectData) => {
    if (!currentProject) return

    try {
      const response = await fetch(`/api/teams/${teamId}/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const updatedProject = await response.json()
        setProjects(prev => prev.map(p => p.id === currentProject.id ? updatedProject : p))
        toast.success('Project updated', 'The project has been updated successfully.')
      } else {
        throw new Error('Failed to update project')
      }
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project', 'Please try again.')
      throw error
    }
  }

  const handleProjectArchive = async (projectId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'canceled' }),
      })

      if (response.ok) {
        setProjects(prev => 
          prev.map(p => 
            p.id === projectId 
              ? { ...p, status: 'canceled' }
              : p
          )
        )
        toast.success('Project archived', 'The project has been archived successfully.')
      } else {
        throw new Error('Failed to archive project')
      }
    } catch (error) {
      console.error('Error archiving project:', error)
      toast.error('Failed to archive project', 'Please try again.')
    }
  }

  const handleCreateProject = async (data: CreateProjectData | UpdateProjectData) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects(prev => [newProject, ...prev])
        toast.success('Project created', 'Your project has been created successfully.')
      } else {
        throw new Error('Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project', 'Please try again.')
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
    setSearchQuery('')
  }

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => 
      Array.isArray(value) ? value.length > 0 : value !== '' && value !== undefined
    ).length
  }

  const hasActiveFilters = getActiveFilterCount() > 0

  // Get unique leads from projects
  const uniqueLeads = Array.from(new Set(projects.map(p => p.lead).filter(Boolean))) as string[]

  // Filter projects based on current filters
  const filteredProjects = projects.filter(project => {
    // Search filter
    const searchMatch = !filters.search || 
      project.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      project.key.toLowerCase().includes(filters.search.toLowerCase()) ||
      project.description?.toLowerCase().includes(filters.search.toLowerCase())

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
              onClick={() => window.location.reload()}
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
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground text-sm">Manage your team&apos;s projects</p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-medium">Search & Filter</CardTitle>
            <ViewSwitcher
              currentView={currentView}
              onViewChange={(view) => setCurrentView(view as 'list' | 'table')}
              views={['list', 'table']}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={filters.search || ''}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="font-medium">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
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
            </div>

            {/* Active filter badges */}
            {hasActiveFilters && (
              <>
                <div className="flex items-center gap-1 flex-wrap flex-1">
                  {filters.status?.map((status) => (
                    <Badge key={status} variant="secondary" className="text-xs">
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        onClick={() => clearFilter('status')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  
                  {filters.lead?.map((lead) => (
                    <Badge key={lead} variant="secondary" className="text-xs">
                      {lead}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        onClick={() => clearFilter('lead')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>

                {/* Clear Filters Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      <div className="space-y-6">
        {filteredProjects.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-16">
              <div className="text-muted-foreground">
                {hasActiveFilters || filters.search ? (
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
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {paginatedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onEdit={handleProjectEdit}
                        onDelete={handleProjectDelete}
                        onDuplicate={handleProjectDuplicate}
                        onArchive={handleProjectArchive}
                      />
                    ))}
                  </div>
                )}

                {currentView === 'table' && (
                  <ProjectTable
                    projects={paginatedProjects}
                    onProjectUpdate={(projectId, updates) => {
                      setProjects(prev => 
                        prev.map(project => 
                          project.id === projectId 
                            ? { ...project, ...updates }
                            : project
                        )
                      )
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

        {/* Pagination */}
        {filteredProjects.length > itemsPerPage && (
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
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ErrorBoundary>
  )
}
