'use client'

import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useQueryClient } from '@tanstack/react-query'
import { IssueWithRelations } from '@/lib/types'
import { WorkflowState } from '@prisma/client'
import { IssueCard } from '@/components/issues/issue-card'
import { Plus, MoreHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface IssueBoardProps {
  issues: IssueWithRelations[]
  workflowStates: WorkflowState[]
  onIssueClick?: (issue: IssueWithRelations) => void
  onIssueUpdate?: (issueId: string, updates: Partial<IssueWithRelations>) => void
  onIssueView?: (issue: IssueWithRelations) => void
  onIssueEdit?: (issue: IssueWithRelations) => void
  onIssueAssign?: (issue: IssueWithRelations) => void
  onIssueMove?: (issue: IssueWithRelations) => void
  onIssueDelete?: (issueId: string) => void
  onCreateIssue?: (workflowStateId: string) => void
  teamId: string
  className?: string
  sidebarCollapsed?: boolean
}

export function IssueBoard({ 
  issues, 
  workflowStates, 
  onIssueClick, 
  onIssueUpdate,
  onIssueView,
  onIssueEdit,
  onIssueAssign,
  onIssueMove,
  onIssueDelete,
  onCreateIssue,
  teamId,
  className,
  sidebarCollapsed = false
}: IssueBoardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const queryClient = useQueryClient()

  const getIssuesByStatus = (statusId: string) => {
    return issues.filter(issue => issue.workflowStateId === statusId)
  }

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false)
    
    const { destination, source, draggableId } = result

    // If dropped outside a droppable area, do nothing
    if (!destination) {
      return
    }

    // If dropped in the same position, do nothing
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const issueId = draggableId
    const newWorkflowStateId = destination.droppableId

    // Handle same-column reordering (within the same workflow state)
    if (destination.droppableId === source.droppableId) {
      // Reorder issues optimistically in all query caches
      queryClient.getQueryCache().getAll().forEach(query => {
        if (query.queryKey[0] === 'issues' && query.queryKey[1] === teamId) {
          queryClient.setQueryData<IssueWithRelations[]>(
            query.queryKey,
            (old = []) => {
              // Get all issues in this workflow state
              const sameStateIssues = old.filter(
                issue => issue.workflowStateId === source.droppableId
              )
              
              // Find the dragged issue
              const draggedIssue = sameStateIssues.find(issue => issue.id === issueId)
              if (!draggedIssue) return old
              
              // Find current index of dragged issue within same state issues
              const currentIndexInState = sameStateIssues.findIndex(issue => issue.id === issueId)
              
              // If already at destination, no change needed
              if (currentIndexInState === destination.index) return old
              
              // Remove dragged issue from its current position
              const withoutDragged = sameStateIssues.filter(issue => issue.id !== issueId)
              
              // Insert at new position
              const reorderedStateIssues = [...withoutDragged]
              reorderedStateIssues.splice(destination.index, 0, draggedIssue)
              
              // Create a map of issue IDs to their new order within the state
              const newOrderMap = new Map<string, number>()
              reorderedStateIssues.forEach((issue, newIndex) => {
                newOrderMap.set(issue.id, newIndex)
              })
              
              // Build new array: keep issues from other states in their original positions,
              // replace same-state issues with reordered ones at their original positions
              return old.map(issue => {
                if (issue.workflowStateId === source.droppableId) {
                  // Find this issue's new position in the reordered array
                  const newIndexInState = newOrderMap.get(issue.id)
                  if (newIndexInState !== undefined) {
                    // Return the issue from the reordered array
                    return reorderedStateIssues[newIndexInState]
                  }
                }
                return issue
              })
            }
          )
        }
      })
      return
    }

    // Handle cross-column move (workflow state change)
    const newWorkflowState = workflowStates.find(state => state.id === newWorkflowStateId)
    
    if (newWorkflowState) {
      // Use onIssueUpdate which will handle the mutation and optimistic updates
      // The mutation system will handle the API call and state management
      onIssueUpdate?.(issueId, { 
        workflowStateId: newWorkflowStateId,
        workflowState: newWorkflowState
      })
    }
  }

  const handleDragStart = () => {
    setIsDragging(true)
  }

  // Mobile-responsive: smaller gaps and columns on mobile
  const boardGap = sidebarCollapsed 
    ? 'gap-4 sm:gap-8' 
    : 'gap-3 sm:gap-6'
  
  // Always use flex-1 so columns expand equally to fill available space
  // Smaller minimum width on mobile for better fit
  const columnWidth = sidebarCollapsed 
    ? 'min-w-[260px] sm:min-w-[300px] flex-1' 
    : 'min-w-[240px] sm:min-w-[280px] flex-1'
  
  return (
    <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className={cn(
        'flex', 
        boardGap, 
        'pb-4 h-full bg-muted/30 px-2 sm:px-4 py-4',
        // Fill full width - columns will expand equally with flex-1
        // Enable horizontal scroll on mobile
        'w-full min-w-0 overflow-x-auto',
        className
      )}>
        {workflowStates.map((state) => {
          const stateIssues = getIssuesByStatus(state.id)
          const getStatusIcon = () => {
            const stateType = state.type.toLowerCase()
            if (stateType === 'canceled') {
              return <X className="h-3.5 w-3.5 text-muted-foreground/60" />
            }
            return null
          }
          
          return (
            <div key={state.id} className={cn('flex flex-col', columnWidth)}>
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  {getStatusIcon()}
                  <h3 className="font-medium text-xs sm:text-sm text-foreground">{state.name}</h3>
                  <span className="text-xs text-muted-foreground font-normal">{stateIssues.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 sm:h-6 sm:w-6 p-0 hover:bg-muted/70 touch-manipulation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Hide column</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-6 sm:w-6 p-0 hover:bg-muted/70 touch-manipulation"
                    onClick={() => onCreateIssue?.(state.id)}
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </Button>
                </div>
              </div>

              {/* Column Content */}
              <Droppable droppableId={state.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 min-h-0 overflow-y-auto transition-colors duration-200 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent',
                      snapshot.isDraggingOver 
                        ? 'bg-primary/5 rounded-lg' 
                        : ''
                    )}
                  >
                    <div className="space-y-2.5 pr-1">
                      {stateIssues.length === 0 ? (
                        <div className="pt-2">
                          <Button
                            variant="ghost"
                            className="w-full h-10 sm:h-10 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 border-dashed border border-muted-foreground/20 rounded-md flex items-center justify-center touch-manipulation text-sm"
                            onClick={() => onCreateIssue?.(state.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            <span className="text-xs sm:text-sm">Add issue</span>
                          </Button>
                        </div>
                      ) : (
                        <>
                          {stateIssues.map((issue, index) => (
                            <Draggable
                              key={issue.id}
                              draggableId={issue.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    'transition-transform duration-200',
                                    snapshot.isDragging ? 'rotate-1 scale-105' : ''
                                  )}
                                >
                                  <IssueCard
                                    issue={issue}
                                    onClick={() => onIssueClick?.(issue)}
                                    isDragging={snapshot.isDragging}
                                    className={cn(
                                      'cursor-pointer',
                                      snapshot.isDragging ? 'shadow-lg' : ''
                                    )}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          <div className="pt-1">
                            <Button
                              variant="ghost"
                              className="w-full h-8 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 rounded-md flex items-center justify-center"
                              onClick={() => onCreateIssue?.(state.id)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
