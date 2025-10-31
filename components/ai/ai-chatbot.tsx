'use client'

import { useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Loader2 } from 'lucide-react'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import IconPaperPlane from '../ui/IconPaperPlane'

interface AIChatbotProps {
  teamId: string
}

export function AIChatbot({ teamId }: AIChatbotProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const processedMessageIdsRef = useRef<Set<string>>(new Set())
  const previousStatusRef = useRef<string>('ready')

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/teams/${teamId}/chat`,
      async prepareSendMessagesRequest({ messages }) {
        // Get API key from localStorage if available
        const apiKey = typeof window !== 'undefined' ? localStorage.getItem('groq_api_key') : null
        
        return {
          body: {
            messages,
            ...(apiKey && { apiKey }),
          },
        }
      },
    }),
  })

  const isLoading = status !== 'ready' && status !== 'error'

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (message: string) => {
    sendMessage({
      text: message,
    })
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
        }, 700)
      }
    }

    previousStatusRef.current = status || 'ready'
  }, [messages, status])

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
            }, 500)
          }
        }
      }
    }
  }, [messages, status])

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
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <IconPaperPlane className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              I can help you create issues, manage projects, invite team members, and more. 
              Just ask me anything!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Extract text content from message parts
              const textContent = message.parts
                ?.filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('') || ''
              
              return (
                <ChatMessage 
                  key={message.id || index} 
                  message={{
                    role: message.role,
                    content: textContent,
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
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}
