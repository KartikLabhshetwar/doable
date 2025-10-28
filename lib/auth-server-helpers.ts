import { auth } from "./auth"
import { headers } from "next/headers"
import { db } from "./db"

/**
 * Get the current session from Better Auth
 */
export async function getSession() {
  return await auth.api.getSession({
    headers: await headers()
  })
}

/**
 * Get the current user ID (throws if not authenticated)
 */
export async function getUserId() {
  const session = await getSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

/**
 * Get the current user object (throws if not authenticated)
 */
export async function getUser() {
  const session = await getSession()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  return session.user
}

/**
 * Check if user is authenticated (returns null if not)
 */
export async function getSessionOrNull() {
  return await getSession()
}

/**
 * Check if user is a member of a team
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const member = await db.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  })
  return !!member
}

/**
 * Verify that user is a member of a team (throws if not)
 */
export async function verifyTeamMembership(teamId: string, userId: string): Promise<void> {
  const isMember = await isTeamMember(teamId, userId)
  if (!isMember) {
    throw new Error("Unauthorized: Not a team member")
  }
}

