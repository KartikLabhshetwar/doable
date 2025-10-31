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
        throw new Error('Failed to create project')
      }
      return response.json()
    },
    onSuccess: () => {
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
        throw new Error('Failed to update project')
      }
      return response.json()
    },
    onSuccess: () => {
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
        throw new Error('Failed to delete project')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] })
      queryClient.invalidateQueries({ queryKey: ['issues', teamId] })
    },
  })
}

