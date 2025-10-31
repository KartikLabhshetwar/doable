'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Mail, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import IconUsers from '@/components/ui/IconUsers'

interface TeamMember {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: string
  createdAt: string
}

interface CurrentUser {
  userId: string
  role: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  invitedBy: string
  createdAt: string
  expiresAt: string
}

export default function PeoplePage() {
  const params = useParams<{ teamId: string }>()
  const teamId = params.teamId

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('developer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)


  // Use ref to store latest fetchData to avoid stale closure issues
  const fetchDataRef = useRef<((silentRefresh?: boolean) => Promise<void>) | null>(null)

  const fetchData = useCallback(async (silentRefresh = false) => {
    try {
      // Only show loading on initial load, not on silent refreshes
      if (!silentRefresh) {
        setLoading(true)
      }
      
      const [membersRes, invitationsRes, sessionRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/members`, {
          cache: silentRefresh ? 'no-store' : 'default',
        }),
        fetch(`/api/teams/${teamId}/invitations`, {
          cache: silentRefresh ? 'no-store' : 'default',
        }),
        fetch('/api/auth/get-session')
      ])

      if (membersRes.ok) {
        const membersData = await membersRes.json()
        // Force React to re-render by creating new array reference
        setMembers([...membersData])
        
        // Get current user's role from session
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          console.log('Session data:', sessionData)
          
          const currentUserMember = membersData.find((m: TeamMember) => 
            m.userId === sessionData?.user?.id
          )
          
          console.log('Current user member:', currentUserMember)
          
          if (currentUserMember) {
            setCurrentUser({
              userId: currentUserMember.userId,
              role: currentUserMember.role,
            })
          } else {
            // Fallback: if we can't find current user via session, 
            // check if ANY member is admin and assume first admin is current user
            const adminMember = membersData.find((m: TeamMember) => m.role === 'admin')
            if (adminMember) {
              console.log('Setting admin member as current user (fallback):', adminMember)
              setCurrentUser({
                userId: adminMember.userId,
                role: adminMember.role,
              })
            }
          }
        }
      }

      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json()
        // Force React to re-render by creating new array reference
        setInvitations([...invitationsData])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      if (!silentRefresh) {
      }
    } finally {
      if (!silentRefresh) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // Keep ref updated with latest fetchData
  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    fetchData() // fetchData already handles loading state
  }, [fetchData])

  // Add event listener to refresh people when chatbot invites team members
  useEffect(() => {
    const handleRefresh = () => {
      // Fetch immediately - use small delay to ensure backend is ready
      setTimeout(() => {
        if (fetchDataRef.current) {
          fetchDataRef.current(true)
        }
      }, 50)
    }

    window.addEventListener('refresh-people', handleRefresh)
    
    return () => {
      window.removeEventListener('refresh-people', handleRefresh)
    }
  }, [])

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        setInviteEmail('')
        setInviteRole('developer')
        setInviteDialogOpen(false)
        await fetchData()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/invitations/${invitationId}/resend`, {
        method: 'POST',
      })

      if (response.ok) {
      } else {
        throw new Error('Failed to resend invitation')
      }
    } catch (error) {
      console.error('Error resending invitation:', error)
    }
  }

  const handleRemoveInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/invitations/${invitationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchData()
      } else {
        throw new Error('Failed to remove invitation')
      }
    } catch (error) {
      console.error('Error removing invitation:', error)
    }
  }

  const handleRemoveMember = () => {
    if (!memberToRemove) return
    
    const executeRemove = async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}/members?memberId=${memberToRemove.id}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setRemoveDialogOpen(false)
          setMemberToRemove(null)
          await fetchData()
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to remove member')
        }
      } catch (error: any) {
        console.error('Error removing member:', error)
      }
    }
    
    executeRemove()
  }

  const openRemoveDialog = (memberId: string, memberName: string) => {
    setMemberToRemove({ id: memberId, name: memberName })
    setRemoveDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">People</h1>
          <p className="text-muted-foreground text-sm">
            Manage team members and their roles
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} className="font-medium">
          <IconUsers className="h-4 w-4 mr-2" />
          Invite Developer
        </Button>
      </div>

      {/* Invite Dialog */}
      {inviteDialogOpen && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email Address</label>
              <Input
                type="email"
                placeholder="developer@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setInviteDialogOpen(false)
                  setInviteEmail('')
                  setInviteRole('developer')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
            {isSubmitting && (
              <div className="flex items-center justify-center pt-2">
                <Spinner size="sm" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 min-h-[200px]">
              <div className="flex flex-col items-center space-y-4">
                <Spinner size="md" />
                <p className="text-muted-foreground">Loading members...</p>
              </div>
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No team members yet
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <UserAvatar
                      name={member.userName}
                      size="md"
                    />
                    <div>
                      <div className="font-medium">{member.userName}</div>
                      <div className="text-sm text-muted-foreground">{member.userEmail}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span 
                      className={cn(
                        "text-xs px-3 py-1 rounded-full font-medium",
                        member.role === 'admin' 
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : member.role === 'viewer'
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      )}
                    >
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                    {currentUser?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRemoveDialog(member.id, member.userName)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {invitation.role} • Invited {new Date(invitation.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.id)}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveInvitation(invitation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToRemove?.name} from the team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false)
                setMemberToRemove(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
