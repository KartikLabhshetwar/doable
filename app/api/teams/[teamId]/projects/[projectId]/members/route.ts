import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'
import { getProjectById } from '@/lib/api/projects'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const userId = await getUserId()
    const user = await getUser()

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Fetch project members from database
    const projectMembers = await db.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    // Format members for the frontend
    const formattedMembers = projectMembers.map((member) => ({
      id: member.id,
      userId: member.userId,
      userName: member.userName,
      userEmail: member.userEmail,
      displayName: member.userName,
      email: member.userEmail,
      profileImageUrl: undefined, // Can be enhanced with user data
    }))

    return NextResponse.json(formattedMembers)
  } catch (error) {
    console.error('Error fetching project members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project members' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { userId: memberUserId } = body

    if (!memberUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify the user being added is a team member
    const teamMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userId: memberUserId,
      },
    })

    if (!teamMember) {
      return NextResponse.json(
        { error: 'User must be a team member first' },
        { status: 400 }
      )
    }

    // Check if member already exists
    const existingMember = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberUserId,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'Member already added to project' },
        { status: 400 }
      )
    }

    // Add member to project
    const projectMember = await db.projectMember.create({
      data: {
        projectId,
        userId: teamMember.userId,
        userEmail: teamMember.userEmail,
        userName: teamMember.userName,
      },
    })

    // Format for frontend
    const formattedMember = {
      id: projectMember.id,
      userId: projectMember.userId,
      userName: projectMember.userName,
      userEmail: projectMember.userEmail,
      displayName: projectMember.userName,
      email: projectMember.userEmail,
      profileImageUrl: undefined,
    }

    return NextResponse.json(formattedMember, { status: 201 })
  } catch (error) {
    console.error('Error adding project member:', error)
    return NextResponse.json(
      { error: 'Failed to add project member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Get the memberId from query parameters
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    // Get the member to remove
    const memberToRemove = await db.projectMember.findUnique({
      where: { id: memberId },
    })

    if (!memberToRemove || memberToRemove.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Project member not found' },
        { status: 404 }
      )
    }

    // Delete the member
    await db.projectMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing project member:', error)
    return NextResponse.json(
      { error: 'Failed to remove project member' },
      { status: 500 }
    )
  }
}

