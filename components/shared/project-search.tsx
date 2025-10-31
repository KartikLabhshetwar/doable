'use client'

import { useState, useEffect } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ProjectWithRelations } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ProjectSearchProps {
  projects: ProjectWithRelations[]
  onSelect?: (project: ProjectWithRelations) => void
  onSearchChange?: (query: string) => void
  placeholder?: string
  className?: string
  value?: string
}

export function ProjectSearch({
  projects,
  onSelect,
  onSearchChange,
  placeholder = 'Search projects...',
  className,
  value,
}: ProjectSearchProps) {
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

  const handleSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      onSelect?.(project)
      setQuery('')
      onSearchChange?.('')
    }
  }

  const filteredProjects = projects.filter((project) => {
    if (!query) return false
    
    const searchLower = query.toLowerCase()
    return (
      project.name.toLowerCase().includes(searchLower) ||
      project.key.toLowerCase().includes(searchLower) ||
      project.description?.toLowerCase().includes(searchLower)
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
            {filteredProjects.length === 0 ? (
              <CommandEmpty>No projects found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredProjects.slice(0, 10).map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id}
                    onSelect={handleSelect}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{project.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {project.key}
                        </span>
                      </div>
                      {project.description && (
                        <span className="text-sm text-muted-foreground truncate">
                          {project.description}
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

