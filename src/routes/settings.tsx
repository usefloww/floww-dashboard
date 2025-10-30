import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { User, Users, Building2, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

interface SettingsTab {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const settingsTabs: SettingsTab[] = [
  {
    name: "Profile",
    to: "/settings",
    icon: User,
  },
  {
    name: "Users",
    to: "/settings/users",
    icon: Users,
  },
  {
    name: "Organization",
    to: "/settings/organization",
    icon: Building2,
  },
  {
    name: "Advanced",
    to: "/settings/advanced",
    icon: SettingsIcon,
  },
];

function SettingsLayout() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your organization, users, and application preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className="flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm [&.active]:border-sky-500 [&.active]:text-sky-600 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Outlet />
    </div>
  );
}