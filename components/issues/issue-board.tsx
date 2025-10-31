'use client'

import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
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

  const getIssuesByStatus = (statusId: string) => {
    return issues.filter(issue => issue.workflowStateId === statusId)
  }

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false)
    
    const { destination, source, draggableId } = result

    // If dropped outside a droppable area
    if (!destination) {
      return
    }

    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const issueId = draggableId
    const newWorkflowStateId = destination.droppableId

    try {
      // Find the new workflow state object
      const newWorkflowState = workflowStates.find(state => state.id === newWorkflowStateId)
      
      // Optimistically update the UI with both workflowStateId and workflowState
      onIssueUpdate?.(issueId, { 
        workflowStateId: newWorkflowStateId,
        workflowState: newWorkflowState
      })

      // Update the issue in the database
      const response = await fetch(`/api/teams/${teamId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowStateId: newWorkflowStateId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update issue: ${response.status} ${response.statusText}`)
      }

    } catch (error) {
      console.error('Error updating issue:', error)
      
      // Revert the optimistic update on error
      const originalWorkflowStateId = source.droppableId
      const originalWorkflowState = workflowStates.find(state => state.id === originalWorkflowStateId)
      onIssueUpdate?.(issueId, { 
        workflowStateId: originalWorkflowStateId,
        workflowState: originalWorkflowState
      })
    }
  }

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const boardGap = sidebarCollapsed ? 'gap-6' : 'gap-5'
  const columnWidth = sidebarCollapsed ? 'w-[320px]' : 'w-[280px]'
  
  return (
    <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className={cn('flex', boardGap, 'overflow-x-auto pb-4 h-full bg-muted/30', className)}>
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
            <div key={state.id} className={cn('flex-shrink-0 flex flex-col', columnWidth)}>
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2.5">
                  {getStatusIcon()}
                  <h3 className="font-medium text-sm text-foreground">{state.name}</h3>
                  <span className="text-xs text-muted-foreground font-normal">{stateIssues.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-muted/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Column settings</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-muted/70"
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
                            className="w-full h-10 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 border-dashed border border-muted-foreground/20 rounded-md flex items-center justify-center"
                            onClick={() => onCreateIssue?.(state.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add issue
                          </Button>
                        </div>
                      ) : (
                        <>
                          {stateIssues.map((issue, index) => (
                            <Draggable
                              key={issue.id}
                              draggableId={issue.id}
                              index={index}
                              isDragDisabled={isDragging}
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
                                    onView={onIssueView}
                                    onEdit={onIssueEdit}
                                    onAssign={onIssueAssign}
                                    onMove={onIssueMove}
                                    onDelete={onIssueDelete}
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
