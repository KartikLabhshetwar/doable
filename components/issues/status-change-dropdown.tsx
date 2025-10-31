'use client'

import { useState } from 'react'
import { WorkflowState } from '@prisma/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check, Circle, MoreVertical, Clock, X } from 'lucide-react'

interface StatusChangeDropdownProps {
  currentState: WorkflowState
  workflowStates: WorkflowState[]
  onStatusChange: (stateId: string) => void
  trigger?: React.ReactNode
}

export function StatusChangeDropdown({
  currentState,
  workflowStates,
  onStatusChange,
  trigger,
}: StatusChangeDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const getStateIcon = (stateType: string, color: string) => {
    switch (stateType) {
      case 'backlog':
        return (
          <div className="h-4 w-4 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: color }}>
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          </div>
        )
      case 'unstarted':
        return <Circle className="h-4 w-4" style={{ color, fill: 'none', strokeWidth: 2 }} />
      case 'started':
        return <Clock className="h-4 w-4" style={{ color }} />
      case 'completed':
        return (
          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: color, backgroundColor: `${color}20` }}>
            <Check className="h-2.5 w-2.5" style={{ color }} />
          </div>
        )
      case 'canceled':
      default:
        return (
          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: color }}>
            <X className="h-2.5 w-2.5" style={{ color }} />
          </div>
        )
    }
  }

  // Sort workflow states by position
  const sortedStates = [...workflowStates].sort((a, b) => {
    if ('position' in a && 'position' in b) {
      return (a.position as number) - (b.position as number)
    }
    return a.name.localeCompare(b.name)
  })

  // Filter states based on search
  const filteredStates = sortedStates.filter((state) =>
    state.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <button
            className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground/60" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <CommandInput
              placeholder="Change status..."
              value={search}
              onValueChange={setSearch}
              className="h-9 border-0 focus:ring-0"
            />
            <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>S
            </kbd>
          </div>
          <CommandList>
            <CommandEmpty>No status found.</CommandEmpty>
            <CommandGroup>
              {filteredStates.map((state, index) => {
                const isSelected = state.id === currentState.id
                return (
                  <CommandItem
                    key={state.id}
                    value={state.id}
                    onSelect={() => {
                      onStatusChange(state.id)
                      setOpen(false)
                      setSearch('')
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className="flex-shrink-0">
                      {getStateIcon(state.type, state.color)}
                    </div>
                    <span className="flex-1">{state.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {index + 1}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

