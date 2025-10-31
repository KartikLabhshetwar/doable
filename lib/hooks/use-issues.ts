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
        const error = await response.json().catch(() => ({ error: 'Failed to create issue' }))
        throw new Error(error.error || 'Failed to create issue')
      }
      return response.json() as Promise<IssueWithRelations>
    },
    // Optimistic update: immediately add issue to cache
    onMutate: async (newIssue) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['issues', teamId] })
      
      // Snapshot the previous values
      const previousIssues = queryClient.getQueryData<IssueWithRelations[]>(['issues', teamId])
      const workflowStates = queryClient.getQueryData<any[]>(['workflow-states', teamId])
      const projects = queryClient.getQueryData<any[]>(['projects', teamId])
      const team = queryClient.getQueryData<any>(['team', teamId])
      
      // Find workflow state and project from cache for realistic optimistic issue
      const workflowState = workflowStates?.find((ws: any) => ws.id === newIssue.workflowStateId)
      const project = newIssue.projectId ? projects?.find((p: any) => p.id === newIssue.projectId) : null
      
      // Create optimistic issue with temporary ID
      const optimisticIssue: IssueWithRelations = {
        id: `temp-${Date.now()}-${Math.random()}`,
        title: newIssue.title,
        description: newIssue.description || null,
        number: 0, // Will be updated from server
        priority: newIssue.priority || 'none',
        estimate: newIssue.estimate || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        teamId,
        projectId: newIssue.projectId || null,
        workflowStateId: newIssue.workflowStateId,
        assigneeId: newIssue.assigneeId || null,
        assignee: newIssue.assignee || null,
        creatorId: '',
        creator: '',
        project: project ? {
          id: project.id,
          name: project.name || '',
          key: project.key || '',
          color: project.color,
          description: project.description,
          icon: project.icon,
          status: project.status || 'active' as const,
          createdAt: project.createdAt || new Date(),
          updatedAt: project.updatedAt || new Date(),
          teamId,
          leadId: project.leadId,
          lead: project.lead,
        } : null,
        workflowState: workflowState ? {
          id: workflowState.id,
          name: workflowState.name || '',
          type: workflowState.type || 'unstarted' as const,
          color: workflowState.color || '',
          position: workflowState.position || 0,
          createdAt: workflowState.createdAt || new Date(),
          updatedAt: workflowState.updatedAt || new Date(),
          teamId,
        } : {
          id: newIssue.workflowStateId,
          name: '',
          type: 'unstarted' as const,
          color: '',
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          teamId,
        },
        team: team ? {
          id: team.id,
          name: team.name || '',
          key: team.key || '',
          groqApiKey: team.groqApiKey,
          createdAt: team.createdAt || new Date(),
          updatedAt: team.updatedAt || new Date(),
        } : {
          id: teamId,
          name: '',
          key: '',
          groqApiKey: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        labels: [],
        comments: [],
      }
      
      // Optimistically update all issue queries for this team
      queryClient.setQueriesData<IssueWithRelations[]>(
        { queryKey: ['issues', teamId] },
        (old = []) => [optimisticIssue, ...old]
      )
      
      // Return context for rollback
      return { previousIssues }
    },
    // On success: replace optimistic issue with real one
    onSuccess: (data, variables, context) => {
      // Replace optimistic issue with real one in all queries
      queryClient.setQueriesData<IssueWithRelations[]>(
        { queryKey: ['issues', teamId] },
        (old = []) => {
          const filtered = old.filter(issue => !issue.id.startsWith('temp-'))
          return [data, ...filtered]
        }
      )
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
    // On error: rollback optimistic update
    onError: (error, variables, context) => {
      // Rollback to previous state
      if (context?.previousIssues) {
        queryClient.setQueriesData(
          { queryKey: ['issues', teamId] },
          context.previousIssues
        )
      }
      // Still invalidate to refresh
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
        const error = await response.json().catch(() => ({ error: 'Failed to update issue' }))
        throw new Error(error.error || 'Failed to update issue')
      }
      return response.json() as Promise<IssueWithRelations>
    },
    // Optimistic update: immediately update issue in cache
    onMutate: async ({ issueId, data: updateData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['issues', teamId] })
      
      // Snapshot the previous values
      const previousIssues = queryClient.getQueryData<IssueWithRelations[]>(['issues', teamId])
      
      // Optimistically update all issue queries
      queryClient.setQueriesData<IssueWithRelations[]>(
        { queryKey: ['issues', teamId] },
        (old = []) => old.map(issue => 
          issue.id === issueId 
            ? { ...issue, ...updateData, updatedAt: new Date() }
            : issue
        )
      )
      
      return { previousIssues }
    },
    // On success: ensure data is consistent
    onSuccess: (data, variables) => {
      // Update with real data
      queryClient.setQueriesData<IssueWithRelations[]>(
        { queryKey: ['issues', teamId] },
        (old = []) => old.map(issue => 
          issue.id === variables.issueId ? data : issue
        )
      )
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
    // On error: rollback
    onError: (error, variables, context) => {
      if (context?.previousIssues) {
        queryClient.setQueriesData(
          { queryKey: ['issues', teamId] },
          context.previousIssues
        )
      }
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
        const error = await response.json().catch(() => ({ error: 'Failed to delete issue' }))
        throw new Error(error.error || 'Failed to delete issue')
      }
      return { issueId }
    },
    // Optimistic update: immediately remove issue from cache
    onMutate: async (issueId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['issues', teamId] })
      
      // Snapshot the previous values
      const previousIssues = queryClient.getQueryData<IssueWithRelations[]>(['issues', teamId])
      
      // Store the deleted issue for potential rollback
      const deletedIssue = previousIssues?.find(issue => issue.id === issueId)
      
      // Optimistically remove issue from all queries
      queryClient.setQueriesData<IssueWithRelations[]>(
        { queryKey: ['issues', teamId] },
        (old = []) => old.filter(issue => issue.id !== issueId)
      )
      
      return { previousIssues, deletedIssue }
    },
    // On success: ensure data is consistent
    onSuccess: () => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
    // On error: rollback by restoring the deleted issue
    onError: (error, issueId, context) => {
      if (context?.previousIssues) {
        queryClient.setQueriesData(
          { queryKey: ['issues', teamId] },
          context.previousIssues
        )
      }
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
      queryClient.invalidateQueries({ queryKey: ['stats', teamId] })
    },
  })
}

