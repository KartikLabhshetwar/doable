import { NextRequest, NextResponse } from 'next/server'
import { getLabels, createLabel, updateLabel, deleteLabel } from '@/lib/api/labels'
import { CreateLabelData } from '@/lib/types'
import { getUserId, verifyTeamMembership } from '@/lib/auth-server-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)
    
    const labels = await getLabels(teamId)
    return NextResponse.json(labels)
  } catch (error) {
    console.error('Error fetching labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
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
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    const labelData: CreateLabelData = {
      name: body.name,
      color: body.color || '#64748b',
    }

    const label = await createLabel(teamId, labelData)
    return NextResponse.json(label, { status: 201 })
  } catch (error) {
    console.error('Error creating label:', error)
    return NextResponse.json(
      { error: 'Failed to create label' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; labelId: string }> }
) {
  try {
    const { teamId, labelId } = await params
    const body = await request.json()
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    const updateData: Partial<CreateLabelData> = {
      name: body.name,
      color: body.color,
    }

    const label = await updateLabel(teamId, labelId, updateData)
    return NextResponse.json(label)
  } catch (error) {
    console.error('Error updating label:', error)
    return NextResponse.json(
      { error: 'Failed to update label' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; labelId: string }> }
) {
  try {
    const { teamId, labelId } = await params
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)
    
    await deleteLabel(teamId, labelId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting label:', error)
    return NextResponse.json(
      { error: 'Failed to delete label' },
      { status: 500 }
    )
  }
}
