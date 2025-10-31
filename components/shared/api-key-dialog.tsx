'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/hooks/use-toast'
import { Key, Eye, EyeOff } from 'lucide-react'
import IconKey from '@/components/ui/IconKey'

const apiKeySchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
})

type ApiKeyFormData = z.infer<typeof apiKeySchema>

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId?: string
  onSuccess?: () => void
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
}: ApiKeyDialogProps) {
  const [showKey, setShowKey] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null)
  const { toast } = useToast()

  // Load API key from localStorage when dialog opens
  useEffect(() => {
    if (open) {
      const savedKey = localStorage.getItem('groq_api_key')
      setCurrentApiKey(savedKey)
      form.reset({ apiKey: savedKey || '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: '',
    },
  })

  // Reset form when dialog opens/closes
  const resetForm = () => {
    form.reset({
      apiKey: '',
    })
    setShowKey(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  const handleTest = async (apiKey: string) => {
    setIsTesting(true)
    try {
      // Test the API key by making a simple request
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (response.ok) {
        toast.success('API key is valid', 'Your Groq API key works correctly.')
        return true
      } else {
        toast.error('Invalid API key', 'Please check your key and try again.')
        return false
      }
    } catch (error) {
      toast.error('Connection failed', 'Could not test the API key.')
      return false
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (data: ApiKeyFormData) => {
    setIsSubmitting(true)
    try {
      // Test the API key first
      const isValid = await handleTest(data.apiKey)
      if (!isValid) {
        setIsSubmitting(false)
        return
      }

      // Save to localStorage
      localStorage.setItem('groq_api_key', data.apiKey)
      setCurrentApiKey(data.apiKey)

      toast.success('API key saved', 'Your Groq API key has been saved locally.')
      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error('Error saving API key:', error)
      const errorMessage = error instanceof Error ? error.message : 'Could not save your API key.'
      toast.error('Failed to save', errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async () => {
    setIsSubmitting(true)
    try {
      // Remove from localStorage
      localStorage.removeItem('groq_api_key')
      setCurrentApiKey(null)

      toast.success('API key removed', 'Your API key has been removed from local storage.')
      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error('Error removing API key:', error)
      toast.error('Failed to remove', 'Could not remove your API key.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconKey className="h-5 w-5" />
            Manage Groq API Key
          </DialogTitle>
          <DialogDescription>
            Bring your own Groq API key to use the AI chatbot feature. Get your free key from{' '}
            <a
              href="https://console.groq.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.groq.com
            </a>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Groq API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                placeholder="gsk_..."
                {...form.register('apiKey')}
                className="pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.apiKey && (
              <p className="text-sm text-destructive">
                {form.formState.errors.apiKey.message}
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {currentApiKey && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={isSubmitting || isTesting}
                className="w-full sm:w-auto order-last sm:order-first"
              >
                Remove Key
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting || isTesting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isTesting}
            >
              {isSubmitting ? 'Saving...' : isTesting ? 'Testing...' : 'Save & Test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

