import { db } from '@/lib/db'
import { CreateProjectData, UpdateProjectData } from '@/lib/types'

export async function getProjects(teamId: string) {
  return await db.project.findMany({
    where: { teamId },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          issues: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function getProjectById(teamId: string, projectId: string) {
  return await db.project.findFirst({
    where: {
      id: projectId,
      teamId,
    },
    include: {
      issues: {
        include: {
          workflowState: true,
          labels: {
            include: {
              label: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function createProject(teamId: string, data: CreateProjectData) {
  return await db.project.create({
    data: {
      name: data.name,
      description: data.description,
      key: data.key,
      color: data.color,
      icon: data.icon,
      leadId: data.leadId,
      lead: data.lead,
      status: data.status || 'active',
      teamId,
    },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function updateProject(teamId: string, projectId: string, data: UpdateProjectData) {
  const updateData: any = { ...data }
  
  // Only update lead fields if explicitly provided
  if (data.leadId !== undefined) {
    updateData.leadId = data.leadId
  }
  if (data.lead !== undefined) {
    updateData.lead = data.lead
  }
  
  return await db.project.update({
    where: {
      id: projectId,
      teamId,
    },
    data: updateData,
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function deleteProject(teamId: string, projectId: string) {
  return await db.project.delete({
    where: {
      id: projectId,
      teamId,
    },
  })
}

export async function getProjectStats(teamId: string) {
  const [total, byStatus] = await Promise.all([
    db.project.count({
      where: { teamId },
    }),
    db.project.groupBy({
      by: ['status'],
      where: { teamId },
      _count: true,
    }),
  ])

  return {
    total,
    byStatus,
  }
}
