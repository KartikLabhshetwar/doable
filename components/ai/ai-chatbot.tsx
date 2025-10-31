'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Loader2 } from 'lucide-react'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import IconPaperPlane from '../ui/IconPaperPlane'
import { useActiveConversation } from '@/lib/hooks/use-chat-conversation'
import { useQueryClient } from '@tanstack/react-query'

interface AIChatbotProps {
  teamId: string
}

const promptSuggestions = [
  'Create a new issue for fixing the login bug',
  'Show me all high-priority issues',
  'What projects do we have?',
  'Create a new project called "Web App"',
  'List all issues in progress',
  'Update the checkout page issue to In Progress',
  'Add Sarah to the Web Project',
  'Invite john@example.com to the team',
  'Show me team statistics',
  'What issues are assigned to me?',
]

export function AIChatbot({ teamId }: AIChatbotProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const processedMessageIdsRef = useRef<Set<string>>(new Set())
  const previousStatusRef = useRef<string>('ready')
  const queryClient = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const hasInitializedMessages = useRef(false)

  // Load active conversation using TanStack Query
  const { data: conversation, isLoading: isLoadingConversation } = useActiveConversation(teamId)

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/teams/${teamId}/chat`,
      async prepareSendMessagesRequest({ messages }) {
        // Get API key from localStorage if available
        const apiKey = typeof window !== 'undefined' ? localStorage.getItem('groq_api_key') : null
        
        // Ensure messages is an array and properly formatted
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          console.error('Invalid messages in prepareSendMessagesRequest:', messages)
          throw new Error('Messages are required')
        }
        
        // Convert messages to format expected by API
        const formattedMessages = messages.map((msg: any) => {
          // Extract content from different possible formats
          let content = ''
          if (typeof msg.content === 'string') {
            content = msg.content
          } else if (msg.parts && Array.isArray(msg.parts)) {
            content = msg.parts
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text || '')
              .join('')
          } else if (msg.text) {
            content = msg.text
          }
          
          return {
            role: msg.role,
            content: content || '',
            ...(msg.toolCalls && { toolCalls: msg.toolCalls }),
          }
        })
        
        return {
          body: {
            messages: formattedMessages,
            ...(apiKey && { apiKey }),
            ...(conversationId && { conversationId }),
          },
        }
      },
      fetch: async (url, options) => {
        const response = await fetch(url, options)
        // Extract conversationId from response headers
        const newConversationId = response.headers.get('X-Conversation-Id')
        if (newConversationId && newConversationId !== conversationId) {
          setConversationId(newConversationId)
          // Invalidate conversation query to refresh after new message
          queryClient.invalidateQueries({ queryKey: ['chat-conversation', 'active', teamId] })
        }
        return response
      },
    }),
  })

  // Load messages from conversation when it's available
  useEffect(() => {
    if (!conversation || !conversation.id) {
      return
    }

    // Track conversation ID to detect changes
    if (conversationId !== conversation.id) {
      setConversationId(conversation.id)
    }

    // Only initialize if we don't have messages yet and conversation has messages
    if (messages.length === 0 && conversation.messages && conversation.messages.length > 0) {
      // Convert database messages to AI SDK format
      // The AI SDK expects messages in UIMessage format with text or content
      const initialMessages = conversation.messages.map((msg: any) => {
        // Ensure the message format matches what AI SDK expects
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content || '',
          // Remove any parts structure if present - we want simple content
        }
      })
      
      if (initialMessages.length > 0) {
        // Use requestAnimationFrame to ensure setMessages is called after hook is fully initialized
        requestAnimationFrame(() => {
          setMessages(initialMessages)
        })
      }
    }
  }, [conversation, setMessages, messages.length, conversationId])

  const isLoading = status !== 'ready' && status !== 'error'

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const [suggestedPrompt, setSuggestedPrompt] = useState<string | undefined>()

  const handleSend = (message: string) => {
    sendMessage({
      text: message,
    })
    setSuggestedPrompt(undefined) // Clear suggestion after sending
  }

  const handlePromptClick = (prompt: string) => {
    setSuggestedPrompt(prompt)
  }

  // Listen for tool executions and trigger refresh
  useEffect(() => {
    const wasLoading = previousStatusRef.current !== 'ready'
    const isReady = status === 'ready'

    // When status changes from loading to ready, check for tool executions
    if (isReady && wasLoading && messages.length > 0) {
      let foundAnyTool = false
      
      // Check all unprocessed messages
      messages.forEach((message) => {
        if (!message.id || processedMessageIdsRef.current.has(message.id)) {
          return
        }

        let toolNames: string[] = []
        
        // Check message parts for tool calls
        if (message.parts && Array.isArray(message.parts)) {
          message.parts.forEach((part: any) => {
            if (part.type === 'tool-call' && part.toolName) {
              toolNames.push(part.toolName)
            }
            if (part.toolName && !toolNames.includes(part.toolName)) {
              toolNames.push(part.toolName)
            }
          })

          // Check text content for success indicators
          const textParts = message.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text || '')
            .join(' ')
            .toLowerCase()
          
          // Comprehensive detection patterns
          if (textParts.length > 0) {
            // Issue operations
            if ((textParts.includes('issue') || textParts.includes('#') || textParts.includes('✔')) && 
                (textParts.includes('created') || textParts.includes('has been created'))) {
              if (!toolNames.includes('createIssue') && !toolNames.includes('createIssues')) {
                toolNames.push('createIssue')
                toolNames.push('createIssues') // Also trigger refresh for bulk operations
              }
            }
            if (textParts.includes('issue') && textParts.includes('updated')) {
              if (!toolNames.includes('updateIssue') && !toolNames.includes('updateIssues')) {
                toolNames.push('updateIssue')
                toolNames.push('updateIssues') // Also trigger refresh for bulk operations
              }
            }
            if (textParts.includes('issue') && textParts.includes('deleted')) {
              if (!toolNames.includes('deleteIssue') && !toolNames.includes('deleteIssues')) {
                toolNames.push('deleteIssue')
                toolNames.push('deleteIssues') // Also trigger refresh for bulk operations
              }
            }
            
            // Project operations - catch any mention of project creation
            if (textParts.includes('project')) {
              if (textParts.includes('created') || textParts.includes('has been created') || 
                  textParts.includes('successfully') || textParts.includes('created successfully') ||
                  textParts.includes('✔')) {
                if (!toolNames.includes('createProject') && !toolNames.includes('createProjects')) {
                  toolNames.push('createProject')
                  toolNames.push('createProjects') // Also trigger refresh for bulk operations
                }
              }
              if (textParts.includes('updated')) {
                if (!toolNames.includes('updateProject')) toolNames.push('updateProject')
              }
              if (textParts.includes('deleted') || textParts.includes('removed')) {
                if (!toolNames.includes('deleteProject')) toolNames.push('deleteProject')
              }
              // Project member operations
              if (textParts.includes('member') || textParts.includes('added') || textParts.includes('removed')) {
                if (textParts.includes('added') || textParts.includes('add')) {
                  if (!toolNames.includes('addProjectMember')) toolNames.push('addProjectMember')
                }
                if (textParts.includes('removed') || textParts.includes('remove') || textParts.includes('delete')) {
                  if (!toolNames.includes('removeProjectMember')) toolNames.push('removeProjectMember')
                }
                if (textParts.includes('list') || textParts.includes('show') || textParts.includes('members')) {
                  if (!toolNames.includes('listProjectMembers')) toolNames.push('listProjectMembers')
                }
              }
            }
            
            // People operations
            if (textParts.includes('invited') || textParts.includes('invitation') || 
                textParts.includes('team member')) {
              if (!toolNames.includes('inviteTeamMember') && !toolNames.includes('inviteTeamMembers')) {
                toolNames.push('inviteTeamMember')
                toolNames.push('inviteTeamMembers') // Also trigger refresh for bulk operations
              }
            }
            if (textParts.includes('invitation') && (textParts.includes('revoked') || 
                textParts.includes('cancelled') || textParts.includes('removed') || textParts.includes('deleted'))) {
              if (!toolNames.includes('revokeInvitation')) toolNames.push('revokeInvitation')
            }
            if (textParts.includes('team member') && (textParts.includes('removed') || 
                textParts.includes('deleted'))) {
              if (!toolNames.includes('removeTeamMember')) toolNames.push('removeTeamMember')
            }
          }
        }
        
        // Mark as processed
        if (message.id) {
          processedMessageIdsRef.current.add(message.id)
        }
        
        // Dispatch refresh if we found tool indicators
        if (toolNames.length > 0) {
          foundAnyTool = true
          const uniqueTools = [...new Set(toolNames)]
          const toolString = uniqueTools.join(' ')
          
          // Dispatch specific refresh events (including bulk operations)
          setTimeout(() => {
            if (toolString.includes('createIssue') || toolString.includes('createIssues') || 
                toolString.includes('updateIssue') || toolString.includes('updateIssues') || 
                toolString.includes('deleteIssue') || toolString.includes('deleteIssues')) {
              window.dispatchEvent(new Event('refresh-issues'))
            }
            if (toolString.includes('createProject') || toolString.includes('createProjects') || 
                toolString.includes('updateProject') || toolString.includes('deleteProject')) {
              window.dispatchEvent(new Event('refresh-projects'))
            }
            if (toolString.includes('inviteTeamMember') || toolString.includes('inviteTeamMembers') || 
                toolString.includes('revokeInvitation') || toolString.includes('removeTeamMember')) {
              window.dispatchEvent(new Event('refresh-people'))
            }
          }, 400)
        }
      })
      
      // Fallback: Always refresh all resources when status becomes ready after loading
      // This ensures UI updates even if tool detection fails
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant') {
        setTimeout(() => {
          // Always refresh all resources to ensure updates appear
          window.dispatchEvent(new Event('refresh-issues'))
          window.dispatchEvent(new Event('refresh-projects'))
          window.dispatchEvent(new Event('refresh-people'))
          // Refresh conversation to get latest messages from DB
          queryClient.invalidateQueries({ queryKey: ['chat-conversation', 'active', teamId] })
        }, 700)
      }
    }

    previousStatusRef.current = status || 'ready'
  }, [messages, status, queryClient, teamId])

  // Additional check: when messages change while ready, check for tool executions
  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      
      // If we have a new assistant message that hasn't been processed, check it
      if (lastMessage && lastMessage.role === 'assistant' && 
          lastMessage.id && !processedMessageIdsRef.current.has(lastMessage.id)) {
        
        // Mark as processed first to avoid duplicate checks
        processedMessageIdsRef.current.add(lastMessage.id)
        
        // Check text for any success indicators
        if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
          const textParts = lastMessage.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text || '')
            .join(' ')
            .toLowerCase()
          
          // If message contains success indicators, refresh all resources
          if (textParts.includes('created') || textParts.includes('successfully') || 
              textParts.includes('updated') || textParts.includes('deleted') || 
              textParts.includes('removed') || textParts.includes('revoked') || 
              textParts.includes('cancelled') || textParts.includes('✔')) {
            setTimeout(() => {
              window.dispatchEvent(new Event('refresh-issues'))
              window.dispatchEvent(new Event('refresh-projects'))
              window.dispatchEvent(new Event('refresh-people'))
              // Refresh conversation to get latest messages from DB
              queryClient.invalidateQueries({ queryKey: ['chat-conversation', 'active', teamId] })
            }, 500)
          }
        }
      }
    }
  }, [messages, status, queryClient, teamId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-2">
            <IconPaperPlane className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Doable AI</h2>
            <p className="text-xs text-muted-foreground">
              Ask me anything about your team
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <IconPaperPlane className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6 text-center">
              I can help you create issues, manage projects, invite team members, and more. 
              Just ask me anything!
            </p>
            
            {/* Prompt Suggestions */}
            <div className="w-full max-w-2xl space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
                Try asking:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {promptSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptClick(suggestion)}
                    className="text-left p-3 rounded-lg border border-border bg-card hover:bg-primary/10 hover:border-primary transition-all text-sm text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Extract text content - handle both formats:
              // 1. Messages from DB: have content directly (set via setMessages)
              // 2. Messages from AI SDK: have parts structure
              let textContent = ''
              
              const msg = message as any
              
              if (msg.content && typeof msg.content === 'string') {
                // Direct content (from DB or simple messages)
                textContent = msg.content
              } else if (message.parts && Array.isArray(message.parts)) {
                // Parts structure (from AI SDK streaming)
                textContent = message.parts
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text || '')
                  .join('')
              } else if (msg.text) {
                // Fallback for text property
                textContent = msg.text
              }
              
              return (
                <ChatMessage 
                  key={message.id || index} 
                  message={{
                    role: message.role,
                    content: textContent || '',
                    id: message.id,
                  }} 
                />
              )
            })}

            {error && (
              <div className="p-4 text-sm text-destructive">
                Error: {error.message}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} suggestedPrompt={suggestedPrompt} />
    </div>
  )
}

