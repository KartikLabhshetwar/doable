'use client'

import { useState, useEffect } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { IssueWithRelations } from '@/lib/types'
import { cn } from '@/lib/utils'

interface IssueSearchProps {
  issues: IssueWithRelations[]
  onSelect?: (issue: IssueWithRelations) => void
  onSearchChange?: (query: string) => void
  placeholder?: string
  className?: string
  value?: string
}

export function IssueSearch({
  issues,
  onSelect,
  onSearchChange,
  placeholder = 'Search issues...',
  className,
  value,
}: IssueSearchProps) {
  const [query, setQuery] = useState(value || '')

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value)
    }
  }, [value])

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery)
    onSearchChange?.(newQuery)
  }

  const handleSelect = (issueId: string) => {
    const issue = issues.find(i => i.id === issueId)
    if (issue) {
      onSelect?.(issue)
      setQuery('')
      onSearchChange?.('')
    }
  }

  const filteredIssues = issues.filter((issue) => {
    if (!query) return false
    
    const searchLower = query.toLowerCase()
    return (
      issue.title.toLowerCase().includes(searchLower) ||
      issue.description?.toLowerCase().includes(searchLower) ||
      `${issue.project?.key || issue.team.key}-${issue.number}`.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className={cn('relative flex-1', className)}>
      <Command 
        className="rounded-lg border shadow-md" 
        shouldFilter={false}
      >
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={handleQueryChange}
        />
        {query.length > 0 && (
          <CommandList>
            {filteredIssues.length === 0 ? (
              <CommandEmpty>No issues found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredIssues.slice(0, 10).map((issue) => (
                  <CommandItem
                    key={issue.id}
                    value={issue.id}
                    onSelect={handleSelect}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{issue.title}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {issue.project?.key || issue.team.key}-{issue.number}
                        </span>
                      </div>
                      {issue.description && (
                        <span className="text-sm text-muted-foreground truncate">
                          {issue.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  )
}

