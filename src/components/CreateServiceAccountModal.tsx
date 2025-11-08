import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, handleApiError } from "@/lib/api";
import { ServiceAccount, ServiceAccountCreate } from "@/types/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";

interface CreateServiceAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function CreateServiceAccountModal({
  open,
  onOpenChange,
  organizationId,
}: CreateServiceAccountModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: ServiceAccountCreate) => {
      return await api.post<ServiceAccount>("/service_accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-accounts', organizationId] });
      showSuccessNotification("Service account created", "The service account has been created successfully.");
      setName("");
      setError("");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      showErrorNotification("Failed to create service account", errorMessage);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      organization_id: organizationId,
    });
  };

  const handleCancel = () => {
    setName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Service Account</DialogTitle>
          <DialogDescription>
            Create a new service account for this organization. Service accounts can be used to generate API keys for programmatic access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Service Account"
              disabled={createMutation.isPending}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Service Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

