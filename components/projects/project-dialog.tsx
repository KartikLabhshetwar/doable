'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateProjectData, UpdateProjectData } from '@/lib/types'
import { UserSelector } from '@/components/shared/user-selector'
import { UserAvatar } from '@/components/shared/user-avatar'
import { 
  User, 
  X, 
  MoreHorizontal, 
  Settings, 
  Tag, 
  MoreVertical,
  ChevronRight,
  Calendar,
  ArrowRight,
  Target,
  Users,
  Gem,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().optional(),
  key: z.string().min(1, 'Key is required').max(10, 'Key is too long').regex(/^[A-Z0-9]+$/, 'Key must be uppercase letters and numbers only'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  icon: z.string().optional(),
  leadId: z.string().optional(),
  status: z.enum(['active', 'completed', 'canceled']),
})

type ProjectFormData = z.infer<typeof projectSchema>

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateProjectData | UpdateProjectData) => Promise<void>
  initialData?: Partial<ProjectFormData>
  title?: string
  description?: string
  teamId?: string
}

export function ProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = 'New project',
  description = 'Create a new project for your team.',
  teamId,
}: ProjectDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [targetDateOpen, setTargetDateOpen] = useState(false)
  
  // Milestone state
  const [milestones, setMilestones] = useState<Array<{ name: string; description: string; targetDate: Date | null }>>([])
  const [milestoneName, setMilestoneName] = useState('')
  const [milestoneDescription, setMilestoneDescription] = useState('')
  const [milestoneTargetDate, setMilestoneTargetDate] = useState<Date | null>(null)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  
  // Get lead name
  const [leadName, setLeadName] = useState<string>('')

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      key: initialData?.key || '',
      color: initialData?.color || '#6366f1',
      icon: initialData?.icon || '',
      leadId: initialData?.leadId || '',
      status: initialData?.status || 'active',
    },
  })

  const currentLeadId = form.watch('leadId')
  const projectName = form.watch('name')

  useEffect(() => {
    if (open && initialData) {
      form.reset(initialData)
    } else if (open) {
      form.reset({
        name: '',
        description: '',
        key: '',
        color: '#6366f1',
        icon: '',
        leadId: '',
        status: 'active',
      })
      setMilestones([])
      setShowMilestoneForm(false)
    }
  }, [open, initialData, form])

  useEffect(() => {
    if (currentLeadId && teamId) {
      fetch(`/api/teams/${teamId}/members`)
        .then(res => res.json())
        .then(members => {
          const member = members.find((m: any) => m.userId === currentLeadId)
          setLeadName(member?.userName || '')
        })
        .catch(() => setLeadName(''))
    } else {
      setLeadName('')
    }
  }, [currentLeadId, teamId])

  // Close calendar when clicking outside
  useEffect(() => {
    if (calendarOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.calendar-container') && !target.closest('.date-input')) {
          setCalendarOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [calendarOpen])

  const generateProjectKey = (name: string): string => {
    if (!name) return ''
    // Take first 3 uppercase letters/numbers from the name
    const cleaned = name.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    return cleaned.substring(0, 3) || 'PRO'
  }

  const handleSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true)
    try {
      // Auto-generate key if not provided for new projects
      const projectKey = data.key || generateProjectKey(data.name)
      
      await onSubmit({
        ...data,
        key: projectKey,
        leadId: data.leadId || undefined,
        icon: data.icon || undefined,
      })
      form.reset()
      setMilestones([])
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddMilestone = () => {
    if (milestoneName.trim()) {
      setMilestones([...milestones, {
        name: milestoneName,
        description: milestoneDescription,
        targetDate: milestoneTargetDate
      }])
      setMilestoneName('')
      setMilestoneDescription('')
      setMilestoneTargetDate(null)
      setShowMilestoneForm(false)
    }
  }

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  // Calendar helpers
  const today = new Date()
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    // JavaScript getDay() returns 0-6 (Sunday-Saturday)
    // We want Monday=0, so adjust: (day + 6) % 7
    const day = new Date(year, month, 1).getDay()
    return (day + 6) % 7 // Convert Sunday=0 to Monday=0
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth)
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth)
    const days = []
    
    // Previous month days
    const prevMonthDays = getDaysInMonth(calendarYear, calendarMonth - 1)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: prevMonthDays - i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      })
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(calendarYear, calendarMonth, i)
      const isToday = date.toDateString() === today.toDateString()
      const isSelected = milestoneTargetDate && 
        date.toDateString() === milestoneTargetDate.toDateString()
      days.push({
        date: i,
        isCurrentMonth: true,
        isToday,
        isSelected
      })
    }
    
    // Next month days to fill the grid
    const totalCells = Math.ceil(days.length / 7) * 7
    const remainingCells = totalCells - days.length
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      })
    }
    
    return days
  }

  const handleDateSelect = (day: number) => {
    const date = new Date(calendarYear, calendarMonth, day)
    setMilestoneTargetDate(date)
    setCalendarOpen(false)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 [&>button]:hidden max-h-[90vh] overflow-y-auto">
        {/* Custom Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {initialData ? 'Edit project' : 'New project'}
            </span>
            
            {/* Close Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col">
            <div className="flex-1 px-6 py-6 space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Project name</h2>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Add a short summary..." 
                          className="text-base border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-2 bg-transparent w-full"
                          {...field}
                          autoFocus={!initialData}
                          value={field.value || ''}
                          onChange={(e) => {
                            field.onChange(e)
                          }}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Project Key */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Project key</h3>
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => {
                    const autoGeneratedKey = projectName ? generateProjectKey(projectName) || 'PRO' : 'PRO'
                    return (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder={autoGeneratedKey}
                            className="text-sm font-mono border border-input bg-background px-3 py-2 h-9 rounded-md focus-visible:ring-1 focus-visible:ring-ring max-w-[120px]"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              // Convert to uppercase and filter invalid characters
                              const upperValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
                              field.onChange(upperValue)
                            }}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to auto-generate from project name. Max 10 uppercase letters/numbers.
                        </p>
                      </FormItem>
                    )
                  }}
                />
              </div>

              {/* Property Buttons Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <div className="h-4 w-4 rounded-full border-2 border-dashed flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      </div>
                      <span>
                        {form.watch('status') === 'active' ? 'Active' : 
                         form.watch('status') === 'completed' ? 'Completed' : 
                         form.watch('status') === 'canceled' ? 'Canceled' : 'Backlog'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem 
                      onClick={() => form.setValue('status', 'active')}
                      className="flex items-center justify-between"
                    >
                      <span>Active</span>
                      {form.watch('status') === 'active' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => form.setValue('status', 'completed')}
                      className="flex items-center justify-between"
                    >
                      <span>Completed</span>
                      {form.watch('status') === 'completed' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => form.setValue('status', 'canceled')}
                      className="flex items-center justify-between"
                    >
                      <span>Canceled</span>
                      {form.watch('status') === 'canceled' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Lead Button */}
                <DropdownMenu open={leadOpen} onOpenChange={setLeadOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <User className="h-4 w-4" />
                      <span>{leadName || 'Lead'}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <FormField
                      control={form.control}
                      name="leadId"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <UserSelector
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value === 'unassigned' ? '' : value)
                                setLeadOpen(false)
                              }}
                              placeholder="Select lead"
                              teamId={teamId}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Members Button */}
                <DropdownMenu open={membersOpen} onOpenChange={setMembersOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <Users className="h-4 w-4" />
                      <span>Members</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      Member assignment coming soon
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Start Date Button */}
                <DropdownMenu open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Start</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      Start date selection coming soon
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Target Date Button */}
                <DropdownMenu open={targetDateOpen} onOpenChange={setTargetDateOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <Target className="h-4 w-4" />
                      <span>Target</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      Target date selection coming soon
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Labels Button */}
                <DropdownMenu open={labelsOpen} onOpenChange={setLabelsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      Labels coming soon
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Write a description, a project brief, or collect ideas..."
                        className="border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[150px] text-muted-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


              {/* Milestones Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Create milestone</h3>
                </div>

                {milestones.length > 0 && (
                  <div className="space-y-2">
                    {milestones.map((milestone, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                        <Gem className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{milestone.name}</div>
                          {milestone.description && (
                            <div className="text-xs text-muted-foreground">{milestone.description}</div>
                          )}
                          {milestone.targetDate && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Target: {formatDate(milestone.targetDate)}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleRemoveMilestone(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {showMilestoneForm ? (
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30 relative">
                    <div className="flex items-center gap-3">
                      <Gem className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Milestone name"
                        value={milestoneName}
                        onChange={(e) => setMilestoneName(e.target.value)}
                        className="flex-1"
                      />
                    </div>

                    <Textarea
                      placeholder="Add a description..."
                      value={milestoneDescription}
                      onChange={(e) => setMilestoneDescription(e.target.value)}
                      className="resize-none min-h-[80px]"
                    />

                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Target date"
                          value={formatDate(milestoneTargetDate)}
                          readOnly
                          onClick={() => setCalendarOpen(!calendarOpen)}
                          className="cursor-pointer date-input"
                        />
                        {calendarOpen && (
                          <div 
                            className="calendar-container absolute z-50 top-full left-0 mt-1 bg-popover border rounded-md shadow-lg p-4 w-64"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  if (calendarMonth === 0) {
                                    setCalendarYear(calendarYear - 1)
                                    setCalendarMonth(11)
                                  } else {
                                    setCalendarMonth(calendarMonth - 1)
                                  }
                                }}
                              >
                                <ChevronRight className="h-4 w-4 rotate-180" />
                              </Button>
                              <span className="font-medium text-sm">
                                {monthNames[calendarMonth]} {calendarYear}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  if (calendarMonth === 11) {
                                    setCalendarYear(calendarYear + 1)
                                    setCalendarMonth(0)
                                  } else {
                                    setCalendarMonth(calendarMonth + 1)
                                  }
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                              {dayNames.map((day) => (
                                <div key={day} className="text-xs text-muted-foreground text-center py-1">
                                  {day}
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {renderCalendar().map((day, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => day.isCurrentMonth && handleDateSelect(day.date)}
                                  className={cn(
                                    "h-8 w-8 rounded text-xs hover:bg-muted transition-colors",
                                    !day.isCurrentMonth && "text-muted-foreground/40",
                                    day.isToday && "bg-primary/10 text-primary font-medium",
                                    day.isSelected && "bg-primary text-primary-foreground"
                                  )}
                                  disabled={!day.isCurrentMonth}
                                >
                                  {day.date}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowMilestoneForm(false)
                            setMilestoneName('')
                            setMilestoneDescription('')
                            setMilestoneTargetDate(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddMilestone}
                          disabled={!milestoneName.trim()}
                        >
                          Add milestone
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowMilestoneForm(true)}
                  >
                    <Gem className="h-4 w-4 mr-2" />
                    Add milestone
                  </Button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t space-y-3">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    onOpenChange(false)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting 
                    ? (initialData ? 'Updating...' : 'Creating...')
                    : (initialData ? 'Update Project' : 'Create project')
                  }
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
