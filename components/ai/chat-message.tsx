'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import IconUser from '../ui/IconUser'
import IconPaperPlane from '../ui/IconPaperPlane'

interface ChatMessageProps {
  message: {
    role: string
    content: string
    id?: string
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div className={cn(
      'flex gap-3 p-4',
      isUser && 'bg-muted/20'
    )}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback>
          {isUser ? (
            <IconUser className="h-4 w-4" />
          ) : (
            <IconPaperPlane className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {isUser ? 'You' : 'Doable AI'}
          </span>
        </div>

        <div className="text-sm">
          {isAssistant ? (
            <Markdown content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  )
}
