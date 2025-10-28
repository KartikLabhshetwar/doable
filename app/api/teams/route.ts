import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrNull } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get the current user from Better Auth
    const session = await getSessionOrNull()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Only return teams where the user is a member
    const teams = await db.team.findMany({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        members: {
          where: {
            userId: userId
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Return only the team data (not members)
    const teamsWithoutMembers = teams.map(({ members, ...team }) => team)
    
    return NextResponse.json(teamsWithoutMembers)
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}

