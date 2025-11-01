'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from '@/components/ui/prompt-input'
import { ArrowUp } from 'lucide-react'
interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  suggestedPrompt?: string
}

export function ChatInput({ onSend, disabled, suggestedPrompt }: ChatInputProps) {
  const [input, setInput] = useState('')

  // Update input when a prompt is suggested
  useEffect(() => {
    if (suggestedPrompt) {
      setInput(suggestedPrompt)
    }
  }, [suggestedPrompt])

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input)
      setInput('')
    }
  }

  return (
    <div className="border-t border-border p-4 bg-background">
      <PromptInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        disabled={disabled}
        maxHeight={150}
      >
        <PromptInputActions>
          <PromptInputTextarea
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1"
          />
          <Button
            type="button"
            size="icon"
            disabled={disabled || !input.trim()}
            onClick={handleSubmit}
            className="h-9 w-9 rounded-full shrink-0"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}
