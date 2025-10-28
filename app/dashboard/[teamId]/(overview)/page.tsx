import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OverviewPage({ params }: { params: Promise<{ teamId: string }> }) {
  // Redirect to issues page for now
  const { teamId } = await params
  redirect(`/dashboard/${teamId}/issues`)
}
