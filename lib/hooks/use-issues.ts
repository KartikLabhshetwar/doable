import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IssueFilters, IssueSort, IssueWithRelations } from '@/lib/types'

export function useIssues(
  teamId: string,
  filters: IssueFilters = {},
  sort: IssueSort = { field: 'createdAt', direction: 'desc' }
) {
  return useQuery({
    queryKey: ['issues', teamId, filters, sort],
    queryFn: async () => {
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

      const response = await fetch(`/api/teams/${teamId}/issues?${searchParams}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issues')
      }
      return response.json() as Promise<IssueWithRelations[]>
    },
  })
}

export function useCreateIssue(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/teams/${teamId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to create issue')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
  })
}

export function useUpdateIssue(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ issueId, data }: { issueId: string; data: any }) => {
      const response = await fetch(`/api/teams/${teamId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to update issue')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
  })
}

export function useDeleteIssue(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (issueId: string) => {
      const response = await fetch(`/api/teams/${teamId}/issues/${issueId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete issue')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
  })
}

