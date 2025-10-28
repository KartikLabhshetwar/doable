import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from "@/lib/auth-server-helpers"
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find invitation
    const invitation = await db.invitation.findUnique({
      where: {
        id: invitationId,
        teamId,
      },
    })

    if (!invitation) {
      console.log('Invitation not found:', invitationId)
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    console.log('Invitation found:', {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      invitedTo: teamId
    })

    if (invitation.status !== 'pending') {
      console.log('Invitation status is not pending:', invitation.status)
      return NextResponse.json(
        { error: `Invitation is no longer valid (status: ${invitation.status})` },
        { status: 400 }
      )
    }

    if (invitation.expiresAt < new Date()) {
      console.log('Invitation expired:', invitation.expiresAt)
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Verify email matches
    const userEmail = user.email
    console.log('Email check:', { invitationEmail: invitation.email, userEmail })
    if (invitation.email !== userEmail) {
      console.log('Email mismatch')
      return NextResponse.json(
        { error: `Invitation email does not match your account. Invitation is for: ${invitation.email}, but you are logged in as: ${userEmail}` },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMember = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    })

    if (existingMember) {
      // Update invitation status
      await db.invitation.update({
        where: { id: invitationId },
        data: { status: 'accepted' },
      })

      return NextResponse.json({ success: true, message: 'Already a member' })
    }

    // Create team member
    const userName = user.name || user.email || 'Unknown'
    
    await db.teamMember.create({
      data: {
        teamId,
        userId,
        userName,
        userEmail: invitation.email,
        role: invitation.role,
      },
    })

    // Update invitation status
    await db.invitation.update({
      where: { id: invitationId },
      data: { status: 'accepted' },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}

