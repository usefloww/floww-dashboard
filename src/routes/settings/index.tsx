import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { User, Bell, Shield, Database, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings/")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { user } = useAuthStore();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Profile Section */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <User className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Profile Information</h2>
          </div>

          {user && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">User ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                  {user.id}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">WorkOS User ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                  {user.workos_user_id}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Created</label>
                <p className="mt-1 text-sm text-gray-900">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Coming soon sections */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Bell className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Notifications</h2>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
          </div>
          <p className="text-gray-500 text-sm">
            Configure your notification preferences for workflows, deployments, and team updates.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Security</h2>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
          </div>
          <p className="text-gray-500 text-sm">
            Manage your security settings, API keys, and two-factor authentication.
          </p>
        </div>
      </div>

      {/* Quick Actions Sidebar */}
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Database className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Export Data</span>
              </div>
            </button>
            <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <SettingsIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm">API Settings</span>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Need Help?</h4>
          <p className="text-sm text-blue-700 mb-3">
            Check out our documentation or contact support for assistance.
          </p>
          <button className="text-sm text-blue-600 hover:text-blue-800 underline">
            View Documentation
          </button>
        </div>
      </div>
    </div>
  );
}