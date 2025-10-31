'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IssueCard } from '@/components/issues/issue-card'
import { IssueDialog } from '@/components/issues/issue-dialog'
import { IssueBoard } from '@/components/issues/issue-board'
import { IssueTable } from '@/components/issues/issue-table'
import { IssueList } from '@/components/issues/issue-list'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { FilterBar } from '@/components/filters/filter-bar'
import { CommandPalette } from '@/components/shared/command-palette'
import { CreateIssueData, IssueFilters, IssueSort, ViewType, IssueWithRelations } from '@/lib/types'
import { useCommandPalette, useCreateShortcut } from '@/lib/hooks/use-keyboard-shortcuts'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { IssueCardSkeleton, TableSkeleton, BoardSkeleton } from '@/components/ui/skeletons'
import { Spinner } from '@/components/ui/spinner'
import { Plus, AlertTriangle, Filter } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Issue {
  id: string
  title: string
  description?: string
  number: number
  priority: string
  team: { key: string }
  project?: { name: string; key: string } | null
  workflowState: { id: string; name: string; color: string }
  workflowStateId: string
  assignee?: string | null
  creator: string
  labels: Array<{ id: string; label: { id: string; name: string; color: string } }>
  comments: Array<{ id: string }>
  createdAt: string
}

interface Project {
  id: string
  name: string
  key: string
}

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
}

interface Label {
  id: string
  name: string
  color: string
}

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

function clearAllCachedData() {
  cache.clear()
}

function getCachedData(key: string) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() })
}

export default function IssuesPage() {
  const params = useParams<{ teamId: string }>()
  const teamId = params.teamId

  const [issues, setIssues] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [workflowStates, setWorkflowStates] = useState<any[]>([])
  const [labels, setLabels] = useState<any[]>([])
  const [teamKey, setTeamKey] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [issuesLoading, setIssuesLoading] = useState(false)
  
  // Use ref to store latest fetchIssues to avoid stale closure issues
  const fetchIssuesRef = useRef<((forceRefresh?: boolean, silentRefresh?: boolean) => Promise<void>) | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editDialogOpenForAssign, setEditDialogOpenForAssign] = useState(false)
  const [editDialogOpenForMove, setEditDialogOpenForMove] = useState(false)
  const [currentIssue, setCurrentIssue] = useState<IssueWithRelations | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('list')
  const [filters, setFilters] = useState<IssueFilters>({})
  const [sort, setSort] = useState<IssueSort>({ field: 'createdAt', direction: 'desc' })
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)


  // Listen for sidebar collapse state changes
  useEffect(() => {
    const checkSidebarState = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sidebar-collapsed')
        setSidebarCollapsed(saved === 'true')
      }
    }

    checkSidebarState()
    
    const interval = setInterval(checkSidebarState, 100)
    return () => clearInterval(interval)
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check cache first
      const cachedProjects = getCachedData(cacheKeys.projects)
      const cachedWorkflowStates = getCachedData(cacheKeys.workflowStates)
      const cachedLabels = getCachedData(cacheKeys.labels)

      if (cachedProjects && cachedWorkflowStates && cachedLabels) {
        setProjects(cachedProjects)
        setWorkflowStates(cachedWorkflowStates)
        setLabels(cachedLabels)
        setLoading(false)
        return
      }

      // Fetch data in parallel
      const [projectsRes, workflowStatesRes, labelsRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/projects`),
        fetch(`/api/teams/${teamId}/workflow-states`),
        fetch(`/api/teams/${teamId}/labels`),
      ])

      if (!projectsRes.ok || !workflowStatesRes.ok || !labelsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const [projectsData, workflowStatesData, labelsData] = await Promise.all([
        projectsRes.json(),
        workflowStatesRes.json(),
        labelsRes.json(),
      ])

      // Cache the data
      setCachedData(cacheKeys.projects, projectsData)
      setCachedData(cacheKeys.workflowStates, workflowStatesData)
      setCachedData(cacheKeys.labels, labelsData)

      setProjects(projectsData as any)
      setWorkflowStates(workflowStatesData as any)
      setLabels(labelsData as any)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchIssues = useCallback(async (forceRefresh = false, silentRefresh = false) => {
    // Create cache key dynamically
    const issuesCacheKey = `issues-${teamId}-${JSON.stringify(filters)}-${JSON.stringify(sort)}`
    try {
      // Only show loading skeleton on initial load, not on silent refreshes
      if (!silentRefresh) {
        setIssuesLoading(true)
      }
      
      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedIssues = getCachedData(issuesCacheKey)
        if (cachedIssues) {
          setIssues(cachedIssues)
          if (!silentRefresh) {
            setIssuesLoading(false)
          }
          return
        }
      }

      const searchParams = new URLSearchParams()
      
      // Add filters to search params
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          value.forEach(v => searchParams.append(key, v))
        } else if (value) {
          searchParams.append(key, value as string)
        }
      })
      
      // Add sort to search params
      searchParams.append('sortField', sort.field)
      searchParams.append('sortDirection', sort.direction)

      const response = await fetch(`/api/teams/${teamId}/issues?${searchParams}`, {
        cache: forceRefresh ? 'no-store' : 'default',
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch issues')
      }
      
      const data = await response.json()
      
      // Cache the issues
      setCachedData(issuesCacheKey, data)
      // Force React to re-render by creating new array reference
      setIssues([...data])
      
      // Extract team key from first issue if available
      if (data.length > 0 && data[0].team?.key && !teamKey) {
        setTeamKey(data[0].team.key)
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
      if (!silentRefresh) {
      }
    } finally {
      if (!silentRefresh) {
        setIssuesLoading(false)
      }
    }
  }, [teamId, filters, sort])
  
  // Keep ref updated with latest fetchIssues
  useEffect(() => {
    fetchIssuesRef.current = fetchIssues
  }, [fetchIssues])

  // Memoized cache keys
  const cacheKeys = useMemo(() => ({
    projects: `projects-${teamId}`,
    workflowStates: `workflowStates-${teamId}`,
    labels: `labels-${teamId}`,
    issues: `issues-${teamId}-${JSON.stringify(filters)}-${JSON.stringify(sort)}`
  }), [teamId, filters, sort])

  // Keyboard shortcuts
  useCommandPalette(() => setCommandPaletteOpen(true))
  useCreateShortcut(() => setCreateDialogOpen(true))

  useEffect(() => {
    fetchInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  useEffect(() => {
    fetchIssues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, filters, sort])

  // Add event listener to refresh issues when chatbot creates/updates issues
  useEffect(() => {
    const handleRefresh = () => {
      // Clear all cache to force fresh fetch
      clearAllCachedData()
      
      // Fetch immediately - use small delay to ensure backend is ready
      setTimeout(() => {
        if (fetchIssuesRef.current) {
          fetchIssuesRef.current(true, true)
        }
      }, 50)
    }

    window.addEventListener('refresh-issues', handleRefresh)
    
    return () => {
      window.removeEventListener('refresh-issues', handleRefresh)
    }
  }, [])

  const handleIssueView = (issue: IssueWithRelations) => {
    // For now, just open the edit dialog to view details
    setCurrentIssue(issue)
    setEditDialogOpen(true)
  }

  const handleIssueEdit = (issue: IssueWithRelations) => {
    setCurrentIssue(issue)
    setEditDialogOpen(true)
  }

  const handleIssueAssign = (issue: IssueWithRelations) => {
    setCurrentIssue(issue)
    setEditDialogOpenForAssign(true)
  }

  const handleIssueMove = (issue: IssueWithRelations) => {
    setCurrentIssue(issue)
    setEditDialogOpenForMove(true)
  }

  const handleIssueDelete = async (issueId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/issues/${issueId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setIssues(prev => prev.filter(i => i.id !== issueId))
      } else {
        throw new Error('Failed to delete issue')
      }
    } catch (error) {
      console.error('Error deleting issue:', error)
    }
  }

  const handleIssueUpdate = async (data: any) => {
    if (!currentIssue) return

    try {
      const response = await fetch(`/api/teams/${teamId}/issues/${currentIssue.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const updatedIssue = await response.json()
        setIssues(prev => prev.map(i => i.id === currentIssue.id ? updatedIssue : i))
        
        // Clear issues cache to force refresh
        cache.delete(cacheKeys.issues)
        
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to update issue')
      }
    } catch (error) {
      console.error('Error updating issue:', error)
      throw error
    }
  }

  const handleCreateIssue = async (data: CreateIssueData) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const newIssue = await response.json()
        setIssues(prev => [newIssue, ...prev])
        
        // Clear issues cache to force refresh
        cache.delete(cacheKeys.issues)
        
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to create issue')
      }
    } catch (error) {
      console.error('Error creating issue:', error)
      throw error
    }
  }

  const handleFiltersChange = (newFilters: IssueFilters) => {
    setFilters(newFilters)
  }

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSort({ field: field as any, direction })
  }

  // Filtered issues (already filtered by API via filters)
  const filteredIssues = issues

  // Pagination logic
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedIssues = filteredIssues.slice(startIndex, endIndex)

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
    // Reset to page 1 when filters or search change
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
      <div className={`space-y-6 ${currentView === 'board' ? 'h-full' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Issues</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Manage and track your team&apos;s issues</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            projects={projects}
            workflowStates={workflowStates}
            labels={labels}
          />
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="font-medium"
            disabled={loading}
            size="sm"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Create Issue</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center justify-between sm:justify-end">
        <span className="text-sm text-muted-foreground sm:hidden">Views</span>
        <ViewSwitcher
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      </div>

        {/* Issues Display */}
        <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 min-h-[400px]">
            <div className="flex flex-col items-center space-y-4">
              <Spinner size="md" />
              <span className="text-muted-foreground">Loading dashboard...</span>
            </div>
          </div>
        ) : filteredIssues.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-16">
              <div className="text-muted-foreground">
                {Object.values(filters).some(value => 
                  Array.isArray(value) ? value.length > 0 : value !== '' && value !== undefined
                ) ? (
                  <>
                    <p className="text-xl font-medium text-foreground mb-2">No issues found</p>
                    <p className="text-body-medium mb-4">Try adjusting your search terms or filters</p>
                    <Button 
                      variant="outline"
                      className="font-medium" 
                      onClick={() => {
                        setFilters({})
                      }}
                    >
                      Clear all filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-medium text-foreground mb-2">No issues yet</p>
                    <p className="text-body-medium mb-6">Create your first issue to get started</p>
                    <Button 
                      className="font-medium" 
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Issue
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {issuesLoading ? (
              <>
                {currentView === 'list' && (
                  <div className="grid gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <IssueCardSkeleton key={i} />
                    ))}
                  </div>
                )}
                {currentView === 'board' && <BoardSkeleton />}
                {currentView === 'table' && <TableSkeleton />}
              </>
            ) : (
              <>
                {currentView === 'list' && (
                  <Card className="border-border/50">
                    <CardContent className="p-0 overflow-x-auto">
                      <IssueList
                        issues={filteredIssues as any}
                        workflowStates={workflowStates}
                        onCreateIssue={(workflowStateId) => {
                          setCurrentIssue(null)
                          setCreateDialogOpen(true)
                        }}
                        onIssueClick={(issue) => {
                          handleIssueView(issue)
                        }}
                        onIssueCheck={async (issueId, checked) => {
                          const issue = issues.find(i => i.id === issueId)
                          if (!issue) return
                          
                          // Find the appropriate workflow state
                          const targetState = workflowStates.find(
                            state => state.type === (checked ? 'completed' : 'unstarted')
                          )
                          
                          if (targetState) {
                            try {
                              // Set current issue for the update handler
                              setCurrentIssue(issue)
                              
                              const response = await fetch(`/api/teams/${teamId}/issues/${issueId}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  workflowStateId: targetState.id
                                }),
                              })

                              if (response.ok) {
                                const updatedIssue = await response.json()
                                setIssues(prev => prev.map(i => i.id === issueId ? updatedIssue : i))
                                cache.delete(cacheKeys.issues)
                              }
                            } catch (error) {
                              console.error('Error updating issue:', error)
                            } finally {
                              setCurrentIssue(null)
                            }
                          }
                        }}
                        onStatusChange={async (issueId, workflowStateId) => {
                          const issue = issues.find(i => i.id === issueId)
                          if (!issue) return
                          
                          try {
                            const response = await fetch(`/api/teams/${teamId}/issues/${issueId}`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                workflowStateId
                              }),
                            })

                            if (response.ok) {
                              const updatedIssue = await response.json()
                              setIssues(prev => prev.map(i => i.id === issueId ? updatedIssue : i))
                              cache.delete(cacheKeys.issues)
                            } else {
                              throw new Error('Failed to update issue')
                            }
                          } catch (error) {
                            console.error('Error updating issue status:', error)
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {currentView === 'board' && (
                  <div className="h-[calc(100vh-200px)] sm:h-[calc(100vh-280px)] overflow-hidden relative -mx-6 px-2 sm:px-6">
                    <IssueBoard
                      issues={filteredIssues as any}
                      workflowStates={workflowStates}
                      teamId={teamId}
                      onIssueClick={(issue) => {
                        handleIssueView(issue)
                      }}
                      onIssueUpdate={(issueId, updates) => {
                        setIssues(prev => 
                          prev.map(issue =>
                            issue.id === issueId 
                              ? { ...issue, ...updates } as any
                              : issue
                          )
                        )
                      }}
                      onIssueView={handleIssueView}
                      onIssueEdit={handleIssueEdit}
                      onIssueAssign={handleIssueAssign}
                      onIssueMove={handleIssueMove}
                      onIssueDelete={handleIssueDelete}
                      onCreateIssue={(workflowStateId) => {
                        setCurrentIssue(null)
                        // Set the workflow state in the dialog
                        setCreateDialogOpen(true)
                        // Store the workflow state ID to use in the dialog
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('createIssueWorkflowStateId', workflowStateId)
                        }
                      }}
                      className="h-full"
                      sidebarCollapsed={sidebarCollapsed}
                    />
                  </div>
                )}

                {currentView === 'table' && (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <IssueTable
                      issues={paginatedIssues as any}
                      workflowStates={workflowStates}
                      projects={projects}
                      onIssueClick={(issue) => {
                        handleIssueView(issue)
                      }}
                      onSort={handleSort}
                      sortField={sort.field}
                      sortDirection={sort.direction}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Pagination - Only show for non-list views */}
        {currentView !== 'list' && filteredIssues.length > itemsPerPage && (
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

      {/* Create Issue Dialog */}
      <IssueDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={async (data: any) => {
          await handleCreateIssue(data)
        }}
        projects={projects}
        workflowStates={workflowStates}
        labels={labels}
        title="Create Issue"
        description="Create a new issue for your team."
        teamId={teamId}
      />

      {/* Edit Issue Dialog */}
      <IssueDialog
        open={editDialogOpen && !!currentIssue}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setCurrentIssue(null)
        }}
        onSubmit={async (data: any) => {
          await handleIssueUpdate(data)
        }}
        projects={projects}
        workflowStates={workflowStates}
        labels={labels}
        initialData={currentIssue ? {
          title: currentIssue.title,
          description: currentIssue.description ?? undefined,
          projectId: currentIssue.project?.id,
          workflowStateId: currentIssue.workflowStateId,
          assigneeId: currentIssue.assignee || '',
          priority: currentIssue.priority as any,
          estimate: (currentIssue as any).estimate,
          labelIds: currentIssue.labels.map(l => l.label.id),
        } : undefined}
        title="Edit Issue"
        description="Update the issue details."
        teamId={teamId}
      />

      {/* Assign Issue Dialog */}
      <IssueDialog
        open={editDialogOpenForAssign && !!currentIssue}
        onOpenChange={(open) => {
          setEditDialogOpenForAssign(open)
          if (!open) setCurrentIssue(null)
        }}
        onSubmit={async (data: any) => {
          await handleIssueUpdate(data)
        }}
        projects={projects}
        workflowStates={workflowStates}
        labels={labels}
        teamId={teamId}
        initialData={currentIssue ? {
          title: currentIssue.title,
          description: currentIssue.description ?? undefined,
          projectId: currentIssue.project?.id,
          workflowStateId: currentIssue.workflowStateId,
          assigneeId: currentIssue.assignee || '',
          priority: currentIssue.priority as any,
          estimate: (currentIssue as any).estimate,
          labelIds: currentIssue.labels.map(l => l.label.id),
        } : undefined}
        title="Assign Issue"
        description="Assign the issue to a team member."
      />

      {/* Move Issue Dialog */}
      <IssueDialog
        open={editDialogOpenForMove && !!currentIssue}
        onOpenChange={(open) => {
          setEditDialogOpenForMove(open)
          if (!open) setCurrentIssue(null)
        }}
        onSubmit={async (data: any) => {
          await handleIssueUpdate(data)
        }}
        projects={projects}
        workflowStates={workflowStates}
        labels={labels}
        teamId={teamId}
        initialData={currentIssue ? {
          title: currentIssue.title,
          description: currentIssue.description ?? undefined,
          projectId: currentIssue.project?.id,
          workflowStateId: currentIssue.workflowStateId,
          assigneeId: currentIssue.assignee || '',
          priority: currentIssue.priority as any,
          estimate: (currentIssue as any).estimate,
          labelIds: currentIssue.labels.map(l => l.label.id),
        } : undefined}
        title="Move Issue"
        description="Move the issue to a different project or status."
      />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        teamId={teamId}
        onCreateIssue={() => setCreateDialogOpen(true)}
        onCreateProject={() => {
          window.location.href = `/dashboard/${teamId}/projects`
        }}
      />

      </div>
    </ErrorBoundary>
  )
}