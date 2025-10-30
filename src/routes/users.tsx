import { createFileRoute } from "@tanstack/react-router";
import { Users, UserPlus, Shield, Mail } from "lucide-react";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">
            Manage users and permissions within your organizations
          </p>
        </div>
        <button className="flex items-center space-x-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors">
          <UserPlus className="h-4 w-4" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Coming soon placeholder */}
      <div className="text-center py-16">
        <Users className="mx-auto h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">User Management</h3>
        <p className="mt-2 text-gray-500 max-w-md mx-auto">
          User management functionality is coming soon. You'll be able to invite users,
          manage permissions, and control access to your organizations and workflows.
        </p>

        <div className="mt-8 grid gap-4 max-w-2xl mx-auto md:grid-cols-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Mail className="h-8 w-8 text-sky-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Invite Users</h4>
            <p className="text-sm text-gray-500 mt-1">Send invitations via email</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Shield className="h-8 w-8 text-sky-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Role Management</h4>
            <p className="text-sm text-gray-500 mt-1">Assign roles and permissions</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Users className="h-8 w-8 text-sky-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Team Overview</h4>
            <p className="text-sm text-gray-500 mt-1">View team members and status</p>
          </div>
        </div>
      </div>
    </div>
  );
}