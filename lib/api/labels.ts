import { db } from '@/lib/db'
import { CreateWorkflowStateData, CreateLabelData } from '@/lib/types'

// Workflow States
export async function getWorkflowStates(teamId: string) {
  return await db.workflowState.findMany({
    where: { teamId },
    include: {
      _count: {
        select: {
          issues: true,
        },
      },
    },
    orderBy: {
      position: 'asc',
    },
  })
}

export async function createWorkflowState(teamId: string, data: CreateWorkflowStateData) {
  return await db.workflowState.create({
    data: {
      ...data,
      teamId,
    },
    include: {
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function updateWorkflowState(teamId: string, stateId: string, data: Partial<CreateWorkflowStateData>) {
  return await db.workflowState.update({
    where: {
      id: stateId,
      teamId,
    },
    data,
    include: {
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function deleteWorkflowState(teamId: string, stateId: string) {
  return await db.workflowState.delete({
    where: {
      id: stateId,
      teamId,
    },
  })
}

// Labels
export async function getLabels(teamId: string) {
  return await db.label.findMany({
    where: { teamId },
    include: {
      _count: {
        select: {
          issues: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })
}

export async function createLabel(teamId: string, data: CreateLabelData) {
  return await db.label.create({
    data: {
      ...data,
      teamId,
    },
    include: {
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function updateLabel(teamId: string, labelId: string, data: Partial<CreateLabelData>) {
  return await db.label.update({
    where: {
      id: labelId,
      teamId,
    },
    data,
    include: {
      _count: {
        select: {
          issues: true,
        },
      },
    },
  })
}

export async function deleteLabel(teamId: string, labelId: string) {
  return await db.label.delete({
    where: {
      id: labelId,
      teamId,
    },
  })
}
