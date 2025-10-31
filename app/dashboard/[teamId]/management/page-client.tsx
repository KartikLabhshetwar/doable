"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, Tooltip } from "recharts"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ApiKeyDialog } from "@/components/shared/api-key-dialog"
import { Badge } from "@/components/ui/badge"
import IconFiles from "@/components/ui/IconFiles"
import IconKey from "@/components/ui/IconKey"
import IconPaperPlane from "@/components/ui/IconPaperPlane"
import IconUsers from "@/components/ui/IconUsers"
import IconSquareChartLine from "@/components/ui/IconSquareChartLine"
import IconCircleCheck from "@/components/ui/IconCircleCheck"

const COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  none: '#64748b',
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function ManagementPageClient() {
  const params = useParams<{ teamId: string }>()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<{ hasKey: boolean; key: string | null } | null>(null)

  // Check localStorage for API key
  const checkApiKeyStatus = () => {
    if (typeof window !== 'undefined') {
      const apiKey = localStorage.getItem('groq_api_key')
      setApiKeyStatus({
        hasKey: !!apiKey,
        key: apiKey
      })
    }
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/teams/${params.teamId}/stats`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    if (params.teamId) {
      fetchStats()
      checkApiKeyStatus()
    }
  }, [params.teamId])

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    )
  }

  const priorityData = stats.priorityBreakdown?.map((item: any) => ({
    name: item.priority === 'none' ? 'None' : item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
    value: item.count,
    color: COLORS[item.priority as keyof typeof COLORS] || COLORS.none
  })) || []

  const statusData = stats.statusBreakdown?.map((item: any) => ({
    name: item.status,
    value: item.count
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Management</h1>
          <p className="text-muted-foreground text-sm">
            Track your team&apos;s performance and productivity
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setApiKeyDialogOpen(true)}
          className="gap-2"
        >
          <IconKey className="h-4 w-4" />
          Manage API Key
          {apiKeyStatus?.hasKey && (
            <Badge variant="default" className="ml-2">
              Configured
            </Badge>
          )}
        </Button>
      </div>

      {/* AI Chatbot Status Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/20 p-2">
                <IconPaperPlane className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  doable AI
                  {apiKeyStatus?.hasKey ? (
                    <Badge variant="default" className="bg-green-600">Ready</Badge>
                  ) : (
                    <Badge variant="destructive">Not Configured</Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {apiKeyStatus?.hasKey
                    ? 'AI chatbot is ready to use. Click the sparkles icon in the header to start chatting.'
                    : 'Get your free Groq API key to enable the Doable AI feature.'}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.members || 0}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <IconSquareChartLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.projects || 0}</div>
            <p className="text-xs text-muted-foreground">Projects in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <IconFiles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.totalIssues || 0}</div>
            <p className="text-xs text-muted-foreground">{stats.stats?.completedIssues || 0} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats?.completionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Issues completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues by Priority */}
        <Card>
          <CardHeader>
            <CardTitle>Issues by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {priorityData.length > 0 ? (
              <ChartContainer
                config={{
                  count: { label: "Count" }
                }}
                className="h-[300px]"
              >
                <BarChart data={priorityData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-count)">
                    {priorityData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No priority data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Issues by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Issues by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ChartContainer
                config={{
                  count: { label: "Count" }
                }}
                className="h-[300px]"
              >
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No status data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentIssues && stats.recentIssues.length > 0 ? (
              stats.recentIssues.map((issue: any) => (
                <div key={issue.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <IconFiles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{issue.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <IconCircleCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Completion Rate</p>
                <p className="text-xs text-muted-foreground">
                  {stats.stats?.completionRate || 0}% of issues are completed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <IconUsers className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Team Size</p>
                <p className="text-xs text-muted-foreground">
                  {stats.stats?.members || 0} active members
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <IconSquareChartLine className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Active Projects</p>
                <p className="text-xs text-muted-foreground">
                  {stats.stats?.projects || 0} projects in progress
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
        onSuccess={() => {
          // Refresh API key status from localStorage
          checkApiKeyStatus()
        }}
      />
    </div>
  )
}

