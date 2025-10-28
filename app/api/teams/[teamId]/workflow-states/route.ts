import { NextRequest, NextResponse } from 'next/server'
import { getWorkflowStates, createWorkflowState, updateWorkflowState, deleteWorkflowState } from '@/lib/api/labels'
import { CreateWorkflowStateData } from '@/lib/types'
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
    
    const states = await getWorkflowStates(teamId)
    return NextResponse.json(states)
  } catch (error) {
    console.error('Error fetching workflow states:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow states' },
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

    const stateData: CreateWorkflowStateData = {
      name: body.name,
      type: body.type,
      color: body.color || '#64748b',
      position: body.position || 0,
    }

    const state = await createWorkflowState(teamId, stateData)
    return NextResponse.json(state, { status: 201 })
  } catch (error) {
    console.error('Error creating workflow state:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow state' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; stateId: string }> }
) {
  try {
    const { teamId, stateId } = await params
    const body = await request.json()
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    const updateData: Partial<CreateWorkflowStateData> = {
      name: body.name,
      type: body.type,
      color: body.color,
      position: body.position,
    }

    const state = await updateWorkflowState(teamId, stateId, updateData)
    return NextResponse.json(state)
  } catch (error) {
    console.error('Error updating workflow state:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow state' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; stateId: string }> }
) {
  try {
    const { teamId, stateId } = await params
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)
    
    await deleteWorkflowState(teamId, stateId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting workflow state:', error)
    return NextResponse.json(
      { error: 'Failed to delete workflow state' },
      { status: 500 }
    )
  }
}
