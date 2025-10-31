import { db } from '@/lib/db'
import { CreateIssueData, UpdateIssueData, IssueFilters, IssueSort } from '@/lib/types'

export async function getIssues(
  teamId: string,
  filters: IssueFilters = {},
  sort: IssueSort = { field: 'createdAt', direction: 'desc' }
) {
  const where: any = {
    teamId,
  }

  // Apply filters
  if (filters.status?.length) {
    where.workflowStateId = {
      in: filters.status,
    }
  }

  if (filters.assignee?.length) {
    where.assigneeId = {
      in: filters.assignee,
    }
  }

  if (filters.project?.length) {
    where.projectId = {
      in: filters.project,
    }
  }

  if (filters.priority?.length) {
    where.priority = {
      in: filters.priority,
    }
  }

  if (filters.label?.length) {
    where.labels = {
      some: {
        labelId: {
          in: filters.label,
        },
      },
    }
  }

  if (filters.search) {
    where.OR = [
      {
        title: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
    ]
  }

  const orderBy: any = {}
  orderBy[sort.field] = sort.direction

  return await db.issue.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      description: true,
      number: true,
      priority: true,
      estimate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      teamId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      workflowStateId: true,
      workflowState: true,
      assigneeId: true,
      assignee: true,
      creatorId: true,
      creator: true,
      team: true,
      labels: {
        include: {
          label: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })
}

export async function getIssueById(teamId: string, issueId: string) {
  return await db.issue.findFirst({
    where: {
      id: issueId,
      teamId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      number: true,
      priority: true,
      estimate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      teamId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      workflowStateId: true,
      workflowState: true,
      assigneeId: true,
      assignee: true,
      creatorId: true,
      creator: true,
      team: true,
      labels: {
        include: {
          label: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })
}

export async function createIssue(teamId: string, data: CreateIssueData, creatorId: string, creatorName: string) {
  // Extract labelIds and exclude from main data
  const { labelIds, projectId, ...issueData } = data

  // Verify project if provided
  const project = projectId ? await db.project.findFirst({ where: { id: projectId, teamId }, select: { id: true } }) : null

  // Prepare issue data (without number first, will be set in transaction)
  const issueDataToCreate: any = {
    title: issueData.title,
    description: issueData.description,
    workflowStateId: issueData.workflowStateId,
    assigneeId: issueData.assigneeId,
    assignee: issueData.assignee,
    priority: issueData.priority || 'none',
    estimate: issueData.estimate,
    teamId,
    creatorId,
    creator: creatorName,
    ...(project && projectId ? { projectId } : {}),
  }

  // Create the issue with a select that includes all necessary relations
  // Exclude comments to reduce payload size and improve performance
  const selectConfig = {
    id: true,
    title: true,
    description: true,
    number: true,
    priority: true,
    estimate: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
    teamId: true,
    projectId: true,
    project: {
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
      },
    },
    workflowStateId: true,
    workflowState: true,
    assigneeId: true,
    assignee: true,
    creatorId: true,
    creator: true,
    team: true,
    labels: {
      include: {
        label: true,
      },
    },
  }

  // Use transaction to generate number atomically and create issue, preventing race conditions
  if (labelIds?.length) {
    return await db.$transaction(async (tx) => {
      // Get last issue number for the entire team (not per project) within transaction
      const lastIssue = await tx.issue.findFirst({
        where: { teamId },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      
      const nextNumber = (lastIssue?.number || 0) + 1

      const issue = await tx.issue.create({
        data: {
          ...issueDataToCreate,
          number: nextNumber,
        },
        select: selectConfig,
      })

      await tx.issueLabel.createMany({
        data: labelIds.map((labelId) => ({
          issueId: issue.id,
          labelId,
        })),
      })

      // Return issue with labels loaded
      return await tx.issue.findUnique({
        where: { id: issue.id },
        select: selectConfig,
      })
    })
  }

  // Create issue without labels, but still in transaction to prevent race conditions
  return await db.$transaction(async (tx) => {
    // Get last issue number for the entire team (not per project) within transaction
    const lastIssue = await tx.issue.findFirst({
      where: { teamId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    
    const nextNumber = (lastIssue?.number || 0) + 1

    return await tx.issue.create({
      data: {
        ...issueDataToCreate,
        number: nextNumber,
      },
      select: selectConfig,
    })
  })
}

export async function updateIssue(teamId: string, issueId: string, data: UpdateIssueData) {
  // Get current issue to check if project is changing
  const currentIssue = await db.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true, number: true },
  })

  // Normalize projectId: empty string becomes null
  const normalizedProjectId = data.projectId === '' ? null : data.projectId

  // Handle project change - renumber the issue
  if (normalizedProjectId !== undefined && normalizedProjectId !== currentIssue?.projectId) {
    // Get the last issue number for the entire team (not per project)
    const lastIssue = await db.issue.findFirst({
      where: { teamId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    
    const nextNumber = (lastIssue?.number || 0) + 1
    data.number = nextNumber
    data.projectId = normalizedProjectId
  } else if (normalizedProjectId !== undefined) {
    data.projectId = normalizedProjectId
  }

  // Handle labels separately
  if (data.labelIds !== undefined) {
    // Remove existing labels
    await db.issueLabel.deleteMany({
      where: { issueId },
    })

    // Add new labels
    if (data.labelIds.length > 0) {
      await db.issueLabel.createMany({
        data: data.labelIds.map((labelId) => ({
          issueId,
          labelId,
        })),
      })
    }
  }

  // Update the issue (excluding labelIds)
  const { labelIds, ...updateData } = data

  const updatedIssue = await db.issue.update({
    where: {
      id: issueId,
      teamId,
    },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      number: true,
      priority: true,
      estimate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      teamId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      workflowStateId: true,
      workflowState: true,
      assigneeId: true,
      assignee: true,
      creatorId: true,
      creator: true,
      team: true,
      labels: {
        include: {
          label: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return updatedIssue
}

export async function deleteIssue(teamId: string, issueId: string) {
  return await db.issue.delete({
    where: {
      id: issueId,
      teamId,
    },
  })
}

export async function getIssueStats(teamId: string) {
  const [total, byStatus, byPriority, byAssignee] = await Promise.all([
    db.issue.count({
      where: { teamId },
    }),
    db.issue.groupBy({
      by: ['workflowStateId'],
      where: { teamId },
      _count: true,
    }),
    db.issue.groupBy({
      by: ['priority'],
      where: { teamId },
      _count: true,
    }),
    db.issue.groupBy({
      by: ['assigneeId'],
      where: { 
        teamId,
        assigneeId: { not: null },
      },
      _count: true,
    }),
  ])

  return {
    total,
    byStatus,
    byPriority,
    byAssignee,
  }
}
