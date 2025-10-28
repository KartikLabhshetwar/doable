'use client';

import SidebarLayout, { SidebarItem } from "@/components/sidebar-layout";
import { AlertCircle, BarChart3, FolderOpen, MapPin, Settings, Users, Workflow } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useParams, useRouter } from "next/navigation";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { WorkspaceSelector } from "@/components/shared/workspace-selector";
import { ApiKeyDialog } from "@/components/shared/api-key-dialog";
import { useState, useEffect } from "react";

const navigationItems = (openApiKeyDialog: () => void): SidebarItem[] => [
  {
    name: "Issues",
    href: "/issues",
    icon: AlertCircle,
    type: "item",
  },
  {
    name: "Projects",
    href: "/projects",
    icon: FolderOpen,
    type: "item",
  },
  {
    type: 'label',
    name: 'Management',
  },
  {
    name: "Management",
    href: "/management",
    icon: BarChart3,
    type: "item",
  },
  {
    name: "People",
    href: "/people",
    icon: Users,
    type: "item",
  },
  {
    name: "API Key",
    icon: Settings,
    type: "item",
    action: openApiKeyDialog,
  },
];

export default function Layout(props: { children: React.ReactNode }) {
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const params = useParams<{ teamId: string }>();
  const { data: session } = authClient.useSession();
  const user = session?.user || null;
  const router = useRouter();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Fetch team data
    const fetchTeam = async () => {
      try {
        const response = await fetch('/api/teams');
        if (response.ok) {
          const teams = await response.json();
          const currentTeam = teams.find((t: any) => t.id === params.teamId);
          if (currentTeam) {
            setTeam(currentTeam);
            setLoading(false);
          } else {
            // If team not found, redirect to dashboard immediately
            setIsRedirecting(true);
            setLoading(false);
            router.replace('/dashboard');
            return; // Exit early to prevent rendering
          }
        } else {
          // If response not ok, redirect to dashboard
          setIsRedirecting(true);
          setLoading(false);
          router.replace('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching team:', error);
        setLoading(false);
        setIsRedirecting(true);
        // Redirect to dashboard on error
        router.replace('/dashboard');
      }
    };
    fetchTeam();
  }, [params.teamId, router]);

  // Don't render anything if redirecting
  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <DashboardLoader message="Redirecting..." submessage="Team not found" />
      </div>
    );
  }

  // Show loading while team is being fetched
  if (loading || !team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <DashboardLoader message="Loading team" submessage="Fetching team data..." />
      </div>
    );
  }

  return (
    <>
      <SidebarLayout 
        items={navigationItems(() => setApiKeyDialogOpen(true))}
        basePath={`/dashboard/${team.id}`}
        sidebarTop={<WorkspaceSelector currentTeamId={team.id} currentTeamName={team.name} />}
        baseBreadcrumb={[{
          title: team.displayName || team.name,
          href: `/dashboard/${team.id}`,
        }]}
        teamId={team.id}
      >
        {props.children}
      </SidebarLayout>
      
      {/* API Key Dialog */}
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
      />
    </>
  );
}