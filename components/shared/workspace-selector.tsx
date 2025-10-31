'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Building2, Trash2 } from 'lucide-react'
import IconStackPerspective from '../ui/IconStackPerspective'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { ToastContainer } from '@/lib/hooks/use-toast'

interface WorkspaceSelectorProps {
  currentTeamId: string
  currentTeamName: string
}

export function WorkspaceSelector({ currentTeamId, currentTeamName }: WorkspaceSelectorProps) {
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [displayTeamName, setDisplayTeamName] = useState(currentTeamName)
  const { toasts, toast, removeToast } = useToast()

  // Update displayed team name when prop changes
  useEffect(() => {
    setDisplayTeamName(currentTeamName)
  }, [currentTeamName])

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams')
        if (response.ok) {
          const data = await response.json()
          setTeams(data)
          // Update displayed team name from fetched data if current team exists
          const currentTeam = data.find((t: any) => t.id === currentTeamId)
          if (currentTeam) {
            setDisplayTeamName(currentTeam.name)
          }
        }
      } catch (error) {
        console.error('Error fetching teams:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTeams()
  }, [currentTeamId])

  const handleTeamSwitch = (teamId: string) => {
    const selectedTeam = teams.find(t => t.id === teamId)
    if (selectedTeam) {
      setDisplayTeamName(selectedTeam.name)
    }
    router.push(`/dashboard/${teamId}/issues`)
  }

  const handleDeleteClick = (e: React.MouseEvent, team: any) => {
    e.stopPropagation()
    setTeamToDelete(team)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!teamToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/teams/${teamToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Show success toast
        toast.success('Workspace deleted', 'The workspace has been deleted successfully.')
        
        // If the deleted team was the current one, redirect immediately
        if (teamToDelete.id === currentTeamId) {
          // Refresh the teams list first
          const updatedTeams = teams.filter(t => t.id !== teamToDelete.id)
          setTeams(updatedTeams)

          // Redirect immediately before trying to update UI
          if (updatedTeams.length > 0) {
            router.replace(`/dashboard/${updatedTeams[0].id}/issues`)
          } else {
            router.replace('/dashboard')
          }
          
          // Close dialog and reset state immediately
          setDeleteDialogOpen(false)
          setTeamToDelete(null)
          setIsDeleting(false)
          return // Exit early to prevent further processing
        }

        // If not the current team, just update the teams list
        const updatedTeams = teams.filter(t => t.id !== teamToDelete.id)
        setTeams(updatedTeams)
      } else {
        const error = await response.json()
        console.error('Error deleting team:', error)
        toast.error('Failed to delete workspace', error.error || 'Please try again.')
      }
    } catch (error) {
      console.error('Error deleting team:', error)
      toast.error('Failed to delete workspace', 'An unexpected error occurred.')
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setTeamToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setTeamToDelete(null)
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex items-center gap-2 px-2">
        <div className="font-semibold text-lg">doable</div>
      </div>
      <div className="flex-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between px-2 h-auto py-2 hover:bg-secondary/50"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="truncate font-medium">{displayTeamName}</span>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                className={team.id === currentTeamId ? 'bg-primary text-primary-foreground' : ''}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className="flex items-center flex-1 cursor-pointer"
                    onClick={() => handleTeamSwitch(team.id)}
                  >
                    <IconStackPerspective className="mr-2 h-4 w-4" />
                    <span className="truncate">{team.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => handleDeleteClick(e, team)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{teamToDelete?.name}&quot;? This action cannot be undone. 
              All projects, issues, and data in this workspace will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

