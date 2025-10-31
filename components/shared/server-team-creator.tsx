'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'

interface ServerTeamCreatorProps {
  onTeamCreated?: (team: any) => void
  inDialog?: boolean
}

export function ServerTeamCreator({ onTeamCreated, inDialog = false }: ServerTeamCreatorProps) {
  const [teamName, setTeamName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { data: session } = authClient.useSession()
  const user = session?.user || null

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return

    setIsCreating(true)
    try {
      const response = await fetch('/api/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: teamName.trim(),
        }),
      })

      if (response.ok) {
        const team = await response.json()
        setTeamName('')
        onTeamCreated?.(team)
        
        // Redirect to the new team's dashboard
        if (team?.id) {
          window.location.href = `/dashboard/${team.id}/issues`
        }
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create team')
      }
    } catch (error) {
      console.error('Error creating team:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const formContent = (
    <form onSubmit={handleCreateTeam} className="space-y-4">
      <div>
        <Label htmlFor="teamName">Team Name</Label>
        <Input
          id="teamName"
          placeholder="Enter team name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          disabled={isCreating}
          required
        />
      </div>
      <Button 
        type="submit" 
        className="w-full" 
        disabled={isCreating || !teamName.trim()}
      >
        {isCreating ? (
          <div className="flex items-center justify-center">
            <span className="mr-2">Creating Team...</span>
          </div>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </>
        )}
      </Button>
      {isCreating && (
        <div className="flex items-center justify-center pt-2">
          <Spinner size="sm" />
        </div>
      )}
    </form>
  )

  if (inDialog) {
    return (
      <div className="space-y-4">
        <div className="text-center flex items-center justify-center gap-2">
          <Plus className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Create New Team</h2>
        </div>
        {formContent}
      </div>
    )
  }

  return (
    <Card className="max-w-md w-full">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Team
        </CardTitle>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  )
}
