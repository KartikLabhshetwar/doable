'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Plus } from 'lucide-react'
import { ServerTeamCreator } from './server-team-creator'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface TeamSelectorProps {
  onCreateTeam?: () => void
}

export function TeamSelector({ onCreateTeam }: TeamSelectorProps) {
  const { data: session } = authClient.useSession()
  const user = session?.user || null
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [showTeamCreator, setShowTeamCreator] = useState(false)

  const fetchTeams = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data)
      } else {
        console.error('Failed to fetch teams:', response.statusText)
        setTeams([])
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
      setTeams([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const handleCreateTeam = async () => {
    if (!onCreateTeam) return
    
    setIsCreatingTeam(true)
    try {
      await onCreateTeam()
    } catch (error) {
      console.error('Error creating team:', error)
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const handleSelectTeam = (teamId: string) => {
    router.push(`/dashboard/${teamId}/issues`)
  }

  const handleTeamCreated = async (team: any) => {
    // Close the dialog if it was open
    setShowTeamCreator(false)
    
    // Refresh the teams list to show the new team
    await fetchTeams()
    
    // If redirect didn't happen in ServerTeamCreator, navigate manually
    if (team?.id) {
      // Small delay to ensure state updates
      setTimeout(() => {
        router.push(`/dashboard/${team.id}/issues`)
      }, 100)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Spinner size="md" />
              <p className="text-center text-muted-foreground">Loading teams...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        {showTeamCreator ? (
          <ServerTeamCreator onTeamCreated={handleTeamCreated} />
        ) : (
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <Users className="h-5 w-5" />
                No Teams Found
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">
                You don&apos;t have access to any teams yet.
              </p>
              
              <Button 
                onClick={() => setShowTeamCreator(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-center h-screen w-screen">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Select Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Choose a team to get started
            </p>
            
            <div className="space-y-2">
              {teams.map((team) => (
                <Button
                  key={team.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleSelectTeam(team.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {team.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{team.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Team members
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            <Button 
              onClick={() => setShowTeamCreator(true)}
              variant="ghost"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Team
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={showTeamCreator} onOpenChange={setShowTeamCreator}>
        <DialogContent className="sm:max-w-md">
          <ServerTeamCreator onTeamCreated={handleTeamCreated} inDialog={true} />
        </DialogContent>
      </Dialog>
    </>
  )
}
