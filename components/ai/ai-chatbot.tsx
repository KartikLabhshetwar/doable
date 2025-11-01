'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Loader2 } from 'lucide-react'
import { ChatInput } from './chat-input'
import IconMsgs from '../ui/IconMsgs'
import IconUser from '../ui/IconUser'
import { useActiveConversation } from '@/lib/hooks/use-chat-conversation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
} from '@/components/ai-elements/message'
import { Response } from '@/components/ai-elements/response'
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion'
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning'
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'

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
  const isStreaming = status === 'streaming'

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

  // Helper function to extract content and metadata from messages
  const extractMessageData = (message: any) => {
    let textContent = ''
    let reasoning: string | null = null
    let chainOfThought: any = null
    
    if (message.content && typeof message.content === 'string') {
      textContent = message.content
    } else if (message.parts && Array.isArray(message.parts)) {
      textContent = message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text || '')
        .join('')
      
      // Check for reasoning or chain-of-thought in parts
      const reasoningPart = message.parts.find((part: any) => 
        part.type === 'reasoning' || part.reasoning
      )
      if (reasoningPart) {
        reasoning = reasoningPart.reasoning || reasoningPart.text || ''
      }
      
      const cotPart = message.parts.find((part: any) => 
        part.type === 'chain-of-thought' || part.chainOfThought
      )
      if (cotPart) {
        chainOfThought = cotPart.chainOfThought || cotPart
      }
    } else if (message.text) {
      textContent = message.text
    }
    
    // Try to parse reasoning/chain-of-thought from text content if marked
    // Check for common markers like [reasoning] or [chain-of-thought]
    const reasoningMatch = textContent.match(/\[reasoning\]([\s\S]*?)\[\/reasoning\]/i)
    if (reasoningMatch && !reasoning) {
      reasoning = reasoningMatch[1].trim()
      textContent = textContent.replace(/\[reasoning\][\s\S]*?\[\/reasoning\]/i, '').trim()
    }
    
    return { textContent, reasoning, chainOfThought }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-2">
            <IconMsgs className="h-5 w-5 text-primary" />
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
      <Conversation className="flex-1">
        <ConversationContent>
          {isLoadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <ConversationEmptyState
              icon={<IconMsgs className="h-12 w-12" />}
              title="Start a conversation"
              description="I can help you create issues, manage projects, invite team members, and more. Just ask me anything!"
            >
              <div className="w-full max-w-2xl mt-6">
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
            </ConversationEmptyState>
          ) : (
            <>
              {messages.map((message, index) => {
                const { textContent, reasoning, chainOfThought } = extractMessageData(message)
                const isUser = message.role === 'user'
                const isAssistant = message.role === 'assistant'
                const isLastMessage = index === messages.length - 1
                
                return (
                  <Message key={message.id || index} from={message.role}>
                    {isUser ? (
                      <div className="size-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center shrink-0">
                        <IconUser className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="size-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center shrink-0">
                        <IconMsgs className="h-4 w-4" />
                      </div>
                    )}
                    <MessageContent variant="flat">
                      {isAssistant && reasoning && (
                        <Reasoning
                          isStreaming={isLastMessage && isStreaming}
                          defaultOpen={true}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{reasoning}</ReasoningContent>
                        </Reasoning>
                      )}
                      
                      {isAssistant && chainOfThought && (
                        <ChainOfThought defaultOpen={false}>
                          <ChainOfThoughtHeader>
                            Chain of Thought
                          </ChainOfThoughtHeader>
                          <ChainOfThoughtContent>
                            {Array.isArray(chainOfThought) ? (
                              chainOfThought.map((step: any, stepIndex: number) => (
                                <ChainOfThoughtStep
                                  key={stepIndex}
                                  label={step.label || `Step ${stepIndex + 1}`}
                                  description={step.description}
                                  status={step.status || 'complete'}
                                >
                                  {step.content && (
                                    <Response>{step.content}</Response>
                                  )}
                                </ChainOfThoughtStep>
                              ))
                            ) : (
                              <ChainOfThoughtStep
                                label="Thinking process"
                                status="complete"
                              >
                                <Response>{typeof chainOfThought === 'string' ? chainOfThought : JSON.stringify(chainOfThought)}</Response>
                              </ChainOfThoughtStep>
                            )}
                          </ChainOfThoughtContent>
                        </ChainOfThought>
                      )}
                      
                      {textContent && (
                        <Response>{textContent}</Response>
                      )}
                    </MessageContent>
                  </Message>
                )
              })}

              {error && (
                <div className="p-4 text-sm text-destructive">
                  Error: {error.message}
                </div>
              )}

              {isLoading && (
                <Message from="assistant">
                  <div className="size-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center shrink-0">
                    <IconMsgs className="h-4 w-4" />
                  </div>
                  <MessageContent variant="flat">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
                  </MessageContent>
                </Message>
              )}

              {/* Show suggestions after messages when ready */}
              {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                <div className="px-4 pb-4">
                  <Suggestions>
                    {promptSuggestions.slice(0, 5).map((suggestion, index) => (
                      <Suggestion
                        key={index}
                        suggestion={suggestion}
                        onClick={handlePromptClick}
                      />
                    ))}
                  </Suggestions>
                </div>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} suggestedPrompt={suggestedPrompt} />
    </div>
  )
}

