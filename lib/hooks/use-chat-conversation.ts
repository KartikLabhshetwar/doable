import { useQuery } from '@tanstack/react-query'

export function useActiveConversation(teamId: string) {
  return useQuery({
    queryKey: ['chat-conversation', 'active', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/chat/active`)
      if (!response.ok) {
        throw new Error('Failed to fetch active conversation')
      }
      const data = await response.json()
      return data || null
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

