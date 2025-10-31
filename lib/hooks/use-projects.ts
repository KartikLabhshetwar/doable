import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProjectWithRelations } from '@/lib/types'

export function useProjects(teamId: string) {
  return useQuery({
    queryKey: ['projects', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/projects`)
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      return response.json() as Promise<ProjectWithRelations[]>
    },
  })
}

export function useCreateProject(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/teams/${teamId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create project' }))
        throw new Error(error.error || 'Failed to create project')
      }
      return response.json() as Promise<ProjectWithRelations>
    },
    // Optimistic update: immediately add project to cache
    onMutate: async (newProject) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['projects', teamId] })
      
      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData<ProjectWithRelations[]>(['projects', teamId])
      const team = queryClient.getQueryData<any>(['team', teamId])
      
      // Create optimistic project with temporary ID
      const optimisticProject: ProjectWithRelations = {
        id: `temp-${Date.now()}-${Math.random()}`,
        name: newProject.name,
        description: newProject.description || null,
        key: newProject.key,
        color: newProject.color || '#6366f1',
        icon: newProject.icon || null,
        status: newProject.status || 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        teamId,
        leadId: newProject.leadId || null,
        lead: newProject.lead || null,
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
        issues: [],
        members: [],
        _count: {
          issues: 0,
        },
      }
      
      // Optimistically update projects query
      queryClient.setQueriesData<ProjectWithRelations[]>(
        { queryKey: ['projects', teamId] },
        (old = []) => [...old, optimisticProject]
      )
      
      // Return context for rollback
      return { previousProjects }
    },
    // On success: replace optimistic project with real one
    onSuccess: (data, variables, context) => {
      // Replace optimistic project with real one
      queryClient.setQueriesData<ProjectWithRelations[]>(
        { queryKey: ['projects', teamId] },
        (old = []) => {
          const filtered = old.filter(project => !project.id.startsWith('temp-'))
          return [...filtered, data]
        }
      )
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
    },
    // On error: rollback optimistic update
    onError: (error, variables, context) => {
      // Rollback to previous state
      if (context?.previousProjects) {
        queryClient.setQueriesData(
          { queryKey: ['projects', teamId] },
          context.previousProjects
        )
      }
      // Still invalidate to refresh
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
    },
  })
}

export function useUpdateProject(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: any }) => {
      const response = await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update project' }))
        throw new Error(error.error || 'Failed to update project')
      }
      return response.json() as Promise<ProjectWithRelations>
    },
    // Optimistic update: immediately update project in cache
    onMutate: async ({ projectId, data: updateData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['projects', teamId] })
      
      // Snapshot the previous values
      const previousProjects = queryClient.getQueryData<ProjectWithRelations[]>(['projects', teamId])
      
      // Optimistically update projects query
      queryClient.setQueriesData<ProjectWithRelations[]>(
        { queryKey: ['projects', teamId] },
        (old = []) => old.map(project => 
          project.id === projectId 
            ? { ...project, ...updateData, updatedAt: new Date() }
            : project
        )
      )
      
      return { previousProjects }
    },
    // On success: ensure data is consistent
    onSuccess: (data, variables) => {
      // Update with real data
      queryClient.setQueriesData<ProjectWithRelations[]>(
        { queryKey: ['projects', teamId] },
        (old = []) => old.map(project => 
          project.id === variables.projectId ? data : project
        )
      )
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
    },
    // On error: rollback
    onError: (error, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueriesData(
          { queryKey: ['projects', teamId] },
          context.previousProjects
        )
      }
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
    },
  })
}

export function useDeleteProject(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete project' }))
        throw new Error(error.error || 'Failed to delete project')
      }
      return { projectId }
    },
    // Optimistic update: immediately remove project from cache
    onMutate: async (projectId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['projects', teamId] })
      
      // Snapshot the previous values
      const previousProjects = queryClient.getQueryData<ProjectWithRelations[]>(['projects', teamId])
      
      // Store the deleted project for potential rollback
      const deletedProject = previousProjects?.find(project => project.id === projectId)
      
      // Optimistically remove project from query
      queryClient.setQueriesData<ProjectWithRelations[]>(
        { queryKey: ['projects', teamId] },
        (old = []) => old.filter(project => project.id !== projectId)
      )
      
      return { previousProjects, deletedProject }
    },
    // On success: ensure data is consistent
    onSuccess: () => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
    },
    // On error: rollback by restoring the deleted project
    onError: (error, projectId, context) => {
      if (context?.previousProjects) {
        queryClient.setQueriesData(
          { queryKey: ['projects', teamId] },
          context.previousProjects
        )
      }
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
    },
  })
}

