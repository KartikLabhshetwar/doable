import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from "@/lib/auth-server-helpers"
import { db } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/email'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get pending invitations
    const invitations = await db.invitation.findMany({
      where: {
        teamId,
        status: 'pending',
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
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
    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { email, role } = body

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userEmail: email,
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 400 }
      )
    }

    // Check if invitation already exists
    const existingInvitation = await db.invitation.findUnique({
      where: {
        teamId_email: {
          teamId,
          email,
        },
      },
    })

    // If pending invitation exists, return error
    if (existingInvitation && existingInvitation.status === 'pending') {
      // Check if it's expired
      if (existingInvitation.expiresAt > new Date()) {
        return NextResponse.json(
          { error: 'Invitation already sent to this email' },
          { status: 400 }
        )
      }
      // If expired, we'll update it below
    }

    // Create or update invitation (expires in 7 days)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invitation = await db.invitation.upsert({
      where: {
        teamId_email: {
          teamId,
          email,
        },
      },
      update: {
        role: role || 'developer',
        invitedBy: userId,
        status: 'pending',
        expiresAt,
      },
      create: {
        teamId,
        email,
        role: role || 'developer',
        invitedBy: userId,
        status: 'pending',
        expiresAt,
      },
    })

    // Get team info for email
    const team = await db.team.findUnique({
      where: { id: teamId },
    })

    // Get inviter info
    const inviterName = user.name || user.email || 'Someone'

    // Send invitation email
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/${invitation.id}`

    if (process.env.RESEND_API_KEY) {
      try {
        await sendInvitationEmail({
          email,
          teamName: team?.name || 'the team',
          inviterName,
          role: role || 'developer',
          inviteUrl,
        })
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError)
        // Don't fail the invitation if email fails
      }
    }

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

