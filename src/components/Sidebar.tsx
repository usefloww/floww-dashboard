import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useNamespaceStore, WorkspaceItem } from "@/stores/namespaceStore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Workflow,
  Settings,
  Building2,
  ChevronDown,
  Plus,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";

interface NavigationItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getNavigationItems = (isOrganizationContext: boolean): NavigationItem[] => [
  {
    name: "Workflows",
    to: "/workflows",
    icon: Workflow,
  },
  {
    name: "Providers",
    to: "/providers",
    icon: Building2,
  },
  ...(isOrganizationContext ? [{
    name: "Organization Settings",
    to: "/settings",
    icon: Settings,
  }] : []),
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const {
    currentNamespace,
    setCurrentNamespace,
    createNamespace,
    getWorkspaceItems,
    getCurrentWorkspaceContext,
    fetchNamespaces,
    isLoading
  } = useNamespaceStore();
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", display_name: "" });
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  // Determine if we're in an organization context
  const { isOrganizationContext } = getCurrentWorkspaceContext();

  const navigationItems = getNavigationItems(isOrganizationContext);

  // Get workspace items from namespaces
  const workspaceItems = getWorkspaceItems();

  const currentWorkspace = workspaceItems.find(w => w.id === currentNamespace?.id);

  const handleWorkspaceSelect = (workspace: WorkspaceItem) => {
    setCurrentNamespace(workspace.namespace);
    setIsWorkspaceDropdownOpen(false);
  };

  const handleCreateNamespace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!formData.name.trim() || !formData.display_name.trim()) {
      setCreateError("Both name and display name are required");
      return;
    }

    try {
      await createNamespace({ name: formData.name, display_name: formData.display_name });
      setFormData({ name: "", display_name: "" });
      setIsCreateDialogOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create organization");
    }
  };

  const getUserInitials = () => {
    if (!user) return "U";

    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name.substring(0, 2).toUpperCase();
    }
    if (user.last_name) {
      return user.last_name.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return (user.workos_user_id || user.id).substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-gray-200">
      {/* User Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-sky-100 text-sky-700">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.first_name || user?.last_name || user?.email || "User"}
            </p>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
            >
              <LogOut className="h-3 w-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <button
            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900 truncate">
                {currentWorkspace?.display_name || "Select Workspace"}
              </span>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              isWorkspaceDropdownOpen && "transform rotate-180"
            )} />
          </button>

          {isWorkspaceDropdownOpen && (
            <>
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                <div className="py-1">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                    Workspaces
                  </div>
                  {workspaceItems.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceSelect(workspace)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2",
                        currentWorkspace?.id === workspace.id
                          ? "bg-sky-50 text-sky-700"
                          : "text-gray-700"
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{workspace.display_name}</div>
                        {!workspace.isPersonal && (
                          <div className="text-xs text-gray-500 truncate">{workspace.name}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1">
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <button
                          onClick={() => {
                            setIsWorkspaceDropdownOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Create Organization</span>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Create Organization</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateNamespace} className="space-y-4">
                          <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">
                              Name
                            </label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="organization-name"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="display_name" className="text-sm font-medium">
                              Display Name
                            </label>
                            <Input
                              id="display_name"
                              value={formData.display_name}
                              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                              placeholder="Organization Display Name"
                              required
                            />
                          </div>
                          {createError && (
                            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                              {createError}
                            </div>
                          )}
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreateDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                              {isLoading ? "Creating..." : "Create Organization"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              {/* Click outside to close */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsWorkspaceDropdownOpen(false)}
              />
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 [&.active]:bg-sky-100 [&.active]:text-sky-700"
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Brand */}
      <div className="p-4 border-t border-gray-200">
        <Link to="/" className="flex items-center space-x-2 group">
          <span className="text-lg font-bold text-sky-950">Floww</span>
        </Link>
      </div>
    </div>
  );
}