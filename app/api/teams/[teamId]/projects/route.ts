import { NextRequest, NextResponse } from 'next/server'
import { getProjects, createProject, getProjectStats } from '@/lib/api/projects'
import { CreateProjectData } from '@/lib/types'
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers"
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const userId = await getUserId()

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Check if requesting stats
    if (searchParams.get('stats') === 'true') {
      const stats = await getProjectStats(teamId)
      return NextResponse.json(stats)
    }

    const projects = await getProjects(teamId)
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const body = await request.json()

    // Get the current user from Better Auth
    const [authResult, userResult] = await Promise.all([
      getUserId(),
      getUser()
    ])
    
    const userId = authResult
    const user = userResult

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Get user display name from Clerk
    const userName = user.name || user.email || 'Unknown'

    // Look up lead name from TeamMember if leadId is provided
    let leadName: string | undefined = userName // default to current user
    const actualLeadId = body.leadId || userId
    
    if (actualLeadId) {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: actualLeadId
        }
      })
      
      if (teamMember) {
        leadName = teamMember.userName
      } else if (actualLeadId === userId) {
        // Fallback to current user's name if not in team members
        leadName = userName
      }
    }

    const projectData: CreateProjectData = {
      name: body.name,
      description: body.description,
      key: body.key,
      color: body.color || '#6366f1',
      icon: body.icon,
      leadId: actualLeadId,
      lead: leadName,
    }

    // Create project and check team in parallel
    const project = await createProject(teamId, projectData)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
