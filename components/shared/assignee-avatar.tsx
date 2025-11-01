'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { UserAvatar } from './user-avatar'

interface AssigneeAvatarProps {
  assigneeId?: string | null
  assignee?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  fallback?: React.ReactNode
  render?: (name: string) => React.ReactNode
}

/**
 * Component that displays an assignee avatar, fetching the assignee name
 * from the API if assigneeId exists but assignee name is missing.
 */
export function AssigneeAvatar({ 
  assigneeId, 
  assignee: initialAssignee, 
  size = 'md',
  className,
  fallback,
  render
}: AssigneeAvatarProps) {
  const params = useParams<{ teamId: string }>()
  const teamId = params.teamId as string
  
  // Only fetch members if we need to look up assignee name
  const needsLookup = !!(assigneeId && !initialAssignee && teamId)
  
  const { data: members = [], isLoading } = useQuery<Array<{ userId: string; userName: string }>>({
    queryKey: ['members', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/members`)
      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }
      return response.json()
    },
    enabled: needsLookup, // Only fetch if we actually need to look up the name
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  
  // Get assignee name from members if we need to look it up
  const assigneeName = useMemo(() => {
    if (initialAssignee) {
      return initialAssignee
    }
    if (assigneeId && members.length > 0) {
      const member = members.find((m) => m.userId === assigneeId)
      return member?.userName || ''
    }
    return ''
  }, [assigneeId, initialAssignee, members])
  
  // If render prop is provided, use it (it handles its own loading/empty states)
  if (render) {
    // During loading or when name is not yet available, pass empty string - render function can handle this
    return <>{render(isLoading && needsLookup ? '' : assigneeName)}</>
  }
  
  // Show avatar if we have assigneeId OR assignee name
  const hasAssignee = !!(assigneeId || assigneeName)
  
  if (!hasAssignee) {
    return fallback ? <>{fallback}</> : null
  }
  
  if (isLoading && needsLookup) {
    // Show placeholder while loading
    return (
      <div className={`h-6 w-6 rounded-full bg-muted animate-pulse ${className}`} />
    )
  }
  
  return (
    <UserAvatar 
      name={assigneeName || undefined} 
      size={size} 
      className={className}
    />
  )
}
