import { useQuery } from '@tanstack/react-query'

export function useWorkflowStates(teamId: string) {
  return useQuery({
    queryKey: ['workflow-states', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/workflow-states`)
      if (!response.ok) {
        throw new Error('Failed to fetch workflow states')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - workflow states don't change often
  })
}

export function useLabels(teamId: string) {
  return useQuery({
    queryKey: ['labels', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/labels`)
      if (!response.ok) {
        throw new Error('Failed to fetch labels')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - labels don't change often
  })
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['members', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/members`)
      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }
      return response.json()
    },
  })
}

export function useTeamInvitations(teamId: string) {
  return useQuery({
    queryKey: ['invitations', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/invitations`)
      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }
      return response.json()
    },
  })
}

export function useTeamStats(teamId: string) {
  return useQuery({
    queryKey: ['stats', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds - stats can be slightly stale
  })
}

