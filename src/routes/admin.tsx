import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { role: "client" } });
    else if (profile && profile.role !== "admin") navigate({ to: "/app" });
  }, [user, profile, loading, navigate]);

  if (loading || !profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Loading admin…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b bg-background px-3 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="font-display font-semibold">Admin Console</div>
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
              Signed in as {profile.full_name}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}