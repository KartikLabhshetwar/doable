'use server'

import { revalidatePath } from 'next/cache'
import { createProject as createProjectLib, updateProject as updateProjectLib, deleteProject as deleteProjectLib } from '@/lib/api/projects'
import { CreateProjectData, UpdateProjectData } from '@/lib/types'
import { getUserId, getUser, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function createProjectAction(teamId: string, data: CreateProjectData) {
  try {
    // Get the current user from Better Auth (parallel calls)
    const [authResult, userResult] = await Promise.all([
      getUserId(),
      getUser()
    ])
    
    const userId = authResult
    const user = userResult

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Get user display name
    const userName = user.name || user.email || 'Unknown'

    // Look up lead name from TeamMember if leadId is provided
    let leadName: string | undefined = userName // default to current user
    const actualLeadId = data.leadId || userId
    
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
        leadName = userName
      }
    }

    const projectData: CreateProjectData = {
      name: data.name,
      description: data.description,
      key: data.key,
      color: data.color || '#6366f1',
      icon: data.icon,
      leadId: actualLeadId,
      lead: leadName,
    }

    const project = await createProjectLib(teamId, projectData)
    
    // Revalidate the projects page
    revalidatePath(`/dashboard/${teamId}/projects`)
    
    return { success: true, project }
  } catch (error) {
    console.error('Error creating project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create project' 
    }
  }
}

export async function updateProjectAction(teamId: string, projectId: string, data: UpdateProjectData) {
  try {
    const userId = await getUserId()
    await verifyTeamMembership(teamId, userId)

    // Handle lead name lookup if lead is being updated
    if (data.leadId !== undefined) {
      const user = await getUser()
      const userName = user.name || user.email || 'Unknown'
      
      let leadName: string | undefined = userName
      const actualLeadId = data.leadId || userId
      
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
          leadName = userName
        }
      }
      
      data.lead = leadName
      data.leadId = actualLeadId
    }

    const project = await updateProjectLib(teamId, projectId, data)
    
    // Revalidate the projects page
    revalidatePath(`/dashboard/${teamId}/projects`)
    
    return { success: true, project }
  } catch (error) {
    console.error('Error updating project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update project' 
    }
  }
}

export async function deleteProjectAction(teamId: string, projectId: string) {
  try {
    const userId = await getUserId()
    await verifyTeamMembership(teamId, userId)

    await deleteProjectLib(teamId, projectId)
    
    // Revalidate the projects page
    revalidatePath(`/dashboard/${teamId}/projects`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete project' 
    }
  }
}

