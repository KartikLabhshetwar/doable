'use server'

import { revalidatePath } from 'next/cache'
import { createIssue as createIssueLib, updateIssue as updateIssueLib, deleteIssue as deleteIssueLib } from '@/lib/api/issues'
import { CreateIssueData, UpdateIssueData } from '@/lib/types'
import { getUserId, getUser, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function createIssueAction(teamId: string, data: CreateIssueData) {
  try {
    // Get user info from Better Auth (parallel calls for speed)
    const [userId, user, teamCheck] = await Promise.all([
      getUserId(),
      getUser(),
      db.team.findUnique({ where: { id: teamId } }).then(team => {
        if (!team) throw new Error('Team not found')
        return team
      })
    ])

    // Get creator name early
    const creatorName = user.name || user.email || 'Unknown'

    // Look up assignee name in parallel with team membership verification
    const needsAssigneeLookup = data.assigneeId && data.assigneeId !== 'unassigned' && data.assigneeId !== userId
    
    // Parallelize: verify membership and lookup assignee simultaneously
    const [, teamMember] = await Promise.all([
      verifyTeamMembership(teamId, userId),
      needsAssigneeLookup
        ? db.teamMember.findFirst({
            where: {
              teamId,
              userId: data.assigneeId
            },
            select: { userName: true }
          })
        : Promise.resolve(null)
    ])

    // Determine assignee name efficiently
    let assigneeName: string | undefined = undefined
    if (data.assigneeId && data.assigneeId !== 'unassigned') {
      if (data.assigneeId === userId) {
        assigneeName = creatorName
      } else {
        assigneeName = teamMember?.userName
      }
    }

    const issueData: CreateIssueData = {
      title: data.title,
      description: data.description,
      projectId: data.projectId && data.projectId.trim() !== '' ? data.projectId : undefined,
      workflowStateId: data.workflowStateId,
      assigneeId: data.assigneeId === 'unassigned' ? undefined : data.assigneeId,
      assignee: assigneeName,
      priority: data.priority || 'none',
      estimate: data.estimate,
      labelIds: data.labelIds,
    }

    const issue = await createIssueLib(
      teamId, 
      issueData, 
      userId, 
      creatorName
    )
    
    // Revalidate the issues page
    revalidatePath(`/dashboard/${teamId}/issues`)
    
    return { success: true, issue }
  } catch (error) {
    console.error('Error creating issue:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create issue' 
    }
  }
}

export async function updateIssueAction(teamId: string, issueId: string, data: UpdateIssueData) {
  try {
    const userId = await getUserId()
    await verifyTeamMembership(teamId, userId)

    // Normalize the update data
    const updateData: UpdateIssueData = {}

    // Handle title - always include if provided
    if (data.title !== undefined) {
      updateData.title = data.title
    }

    // Handle description - normalize empty strings to null
    if (data.description !== undefined) {
      updateData.description = data.description === '' || data.description === null ? null : data.description
    }

    // Handle projectId - normalize empty strings to null
    if (data.projectId !== undefined) {
      updateData.projectId = data.projectId === '' || data.projectId === null ? null : data.projectId
    }

    // Handle workflowStateId - include if provided
    if (data.workflowStateId !== undefined) {
      updateData.workflowStateId = data.workflowStateId
    }

    // Handle assignee - lookup assignee name if assigneeId is provided (including empty string/null for unassigning)
    if (data.assigneeId !== undefined) {
      const normalizedAssigneeId = data.assigneeId === '' || data.assigneeId === 'unassigned' || data.assigneeId === null ? null : data.assigneeId
      
      let assigneeName: string | null = null
      if (normalizedAssigneeId) {
        const [user, teamMember] = await Promise.all([
          getUser(),
          db.teamMember.findFirst({
            where: {
              teamId,
              userId: normalizedAssigneeId
            },
            select: { userName: true }
          })
        ])
        
        if (normalizedAssigneeId === userId) {
          assigneeName = user.name || user.email || 'Unknown'
        } else if (teamMember) {
          assigneeName = teamMember.userName
        }
      }
      
      updateData.assigneeId = normalizedAssigneeId
      updateData.assignee = assigneeName
    }

    // Handle priority - include if provided
    if (data.priority !== undefined) {
      updateData.priority = data.priority
    }

    // Handle estimate - normalize undefined/null
    if (data.estimate !== undefined) {
      updateData.estimate = data.estimate === null ? null : data.estimate
    }

    // Handle labelIds - include if provided (including empty array)
    if (data.labelIds !== undefined) {
      updateData.labelIds = data.labelIds
    }

    const issue = await updateIssueLib(teamId, issueId, updateData)
    
    // Revalidate the issues page
    revalidatePath(`/dashboard/${teamId}/issues`)
    
    return { success: true, issue }
  } catch (error) {
    console.error('Error updating issue:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update issue' 
    }
  }
}

export async function deleteIssueAction(teamId: string, issueId: string) {
  try {
    const userId = await getUserId()
    await verifyTeamMembership(teamId, userId)

    await deleteIssueLib(teamId, issueId)
    
    // Revalidate the issues page
    revalidatePath(`/dashboard/${teamId}/issues`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting issue:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete issue' 
    }
  }
}

