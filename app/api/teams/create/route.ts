import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { displayName } = body

    if (!displayName) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      )
    }

    // Get the current user from Better Auth
    const userId = await getUserId()
    const user = await getUser()

    // Generate unique team key
    // Use first 3 chars of name + random 3 char suffix to ensure uniqueness
    const baseKey = displayName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'A').padEnd(3, 'A')
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const teamKey = `${baseKey}${randomSuffix}`
    
    // Create team in database and add creator as admin member
    const team = await db.team.create({
      data: {
        name: displayName,
        key: teamKey,
        members: {
          create: {
            userId: userId,
            userName: user.name || user.email || 'Unknown',
            userEmail: user.email || '',
            role: 'admin'
          }
        }
      }
    })

    // Create default workflow states for the team
    const defaultWorkflowStates = [
      { name: 'Backlog', type: 'backlog', color: '#64748b', position: 0 },
      { name: 'Todo', type: 'unstarted', color: '#3b82f6', position: 1 },
      { name: 'In Progress', type: 'started', color: '#f59e0b', position: 2 },
      { name: 'Done', type: 'completed', color: '#10b981', position: 3 },
    ]

    await Promise.all(
      defaultWorkflowStates.map(state =>
        db.workflowState.create({
          data: {
            ...state,
            teamId: team.id,
          }
        })
      )
    )

    // Create default labels for the team
    const defaultLabels = [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#8b5cf6' },
      { name: 'Enhancement', color: '#06b6d4' },
      { name: 'Documentation', color: '#84cc16' },
    ]

    await Promise.all(
      defaultLabels.map(label =>
        db.label.create({
          data: {
            ...label,
            teamId: team.id,
          }
        })
      )
    )

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    console.error('Error creating team:', error)
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    )
  }
}
