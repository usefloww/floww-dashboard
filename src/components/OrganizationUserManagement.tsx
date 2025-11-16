import { useQuery } from "@tanstack/react-query";
import { api, handleApiError } from "@/lib/api";
import { OrganizationRole, OrganizationMember, OrganizationUser } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Users, Crown, Shield, User, Calendar } from "lucide-react";

interface OrganizationUserManagementProps {
  organizationId: string;
}

export function OrganizationUserManagement({ organizationId }: OrganizationUserManagementProps) {
  // Use TanStack Query to fetch members
  const { data, isLoading, error } = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async () => {
      const data = await api.get<OrganizationMember[]>(`/organizations/${organizationId}/members`);
      return Array.isArray(data) ? data : [];
    },
  });

  const members = data || [];
  const errorMessage = error ? handleApiError(error) : null;

  const getRoleIcon = (role: OrganizationRole) => {
    switch (role) {
      case OrganizationRole.OWNER:
        return <Crown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case OrganizationRole.ADMIN:
        return <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case OrganizationRole.MEMBER:
        return <User className="h-4 w-4 text-muted-foreground" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleColor = (role: OrganizationRole) => {
    switch (role) {
      case OrganizationRole.OWNER:
        return "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800/50";
      case OrganizationRole.ADMIN:
        return "text-blue-700 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50";
      case OrganizationRole.MEMBER:
        return "text-foreground bg-muted border-border";
      default:
        return "text-foreground bg-muted border-border";
    }
  };

  const getUserInitials = (user: OrganizationUser) => {
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
    return user.workos_user_id.substring(0, 2).toUpperCase();
  };

  return (
    <Loader isLoading={isLoading} loadingMessage="Loading organization members...">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Organization Members</h2>
          <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>

        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4">
            {errorMessage}
          </div>
        )}

      {members.length === 0 ? (
        <div className="text-center py-8">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">No members found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This organization doesn't have any members yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop table view */}
          <div className="hidden md:block">
            <div className="overflow-hidden border border-border rounded-lg">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {getUserInitials(member.user)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-foreground">
                              {member.user.first_name && member.user.last_name
                                ? `${member.user.first_name} ${member.user.last_name}`
                                : member.user.email || member.user.workos_user_id
                              }
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {member.user.email && (member.user.first_name || member.user.last_name) && (
                                <div>{member.user.email}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(member.role)}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRoleColor(member.role)}`}>
                            {member.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(member.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-muted border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {getUserInitials(member.user)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {member.user.first_name && member.user.last_name
                          ? `${member.user.first_name} ${member.user.last_name}`
                          : member.user.email || member.user.workos_user_id
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.user.email && (member.user.first_name || member.user.last_name) && (
                          <div>{member.user.email}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getRoleIcon(member.role)}
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRoleColor(member.role)}`}>
                      {member.role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Joined {new Date(member.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* Read-only notice */}
        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Read-only view:</strong> User management functionality (invite, remove, role changes) is not available in this interface.
          </p>
        </div>
      </div>
    </Loader>
  );
}