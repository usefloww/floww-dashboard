import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { handleApiError, getProviderType, createProvider, updateProvider } from "@/lib/api";
import { Provider, ProviderType, ProviderSetupStep } from "@/types/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";
import { Loader } from "@/components/Loader";

interface ProviderConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: Provider | null; // If provided, we're editing; otherwise creating
  namespaceId: string;
  providerType?: string; // For create mode, the selected provider type
}

export function ProviderConfigModal({
  open,
  onOpenChange,
  provider,
  namespaceId,
  providerType: initialProviderType,
}: ProviderConfigModalProps) {
  const isEditMode = !!provider;
  const [selectedProviderType, setSelectedProviderType] = useState<string>(
    initialProviderType || provider?.type || ""
  );
  const [alias, setAlias] = useState(provider?.alias || "");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch provider type schema when provider type is selected
  const { data: providerTypeData, isLoading: isLoadingType } = useQuery<ProviderType | null>({
    queryKey: ["provider-type", selectedProviderType],
    queryFn: async () => {
      if (!selectedProviderType) return null;
      const data = await getProviderType(selectedProviderType);
      return data;
    },
    enabled: !!selectedProviderType && open,
  });

  // Initialize form when provider changes or modal opens
  useEffect(() => {
    if (open) {
      if (isEditMode && provider) {
        setSelectedProviderType(provider.type);
        setAlias(provider.alias);
        // Initialize config with existing values, but mask secrets
        const initialConfig: Record<string, string> = {};
        if (providerTypeData) {
          providerTypeData.setup_steps.forEach((step: ProviderSetupStep) => {
            if (step.type === "secret" && provider.config[step.alias]) {
              // Mask existing secrets
              initialConfig[step.alias] = "••••••••";
            } else if (step.type !== "info" && step.type !== "oauth") {
              initialConfig[step.alias] = provider.config[step.alias] || "";
            }
          });
        } else {
          // Fallback: set all config values (will be masked once type loads)
          Object.keys(provider.config).forEach((key) => {
            initialConfig[key] = provider.config[key] || "";
          });
        }
        setConfig(initialConfig);
      } else {
        // Create mode
        setAlias("");
        setConfig({});
        if (initialProviderType) {
          setSelectedProviderType(initialProviderType);
        }
      }
      setErrors({});
    }
  }, [open, provider, isEditMode, initialProviderType, providerTypeData]);

  // Update config when provider type data loads in edit mode
  useEffect(() => {
    if (isEditMode && provider && providerTypeData) {
      const updatedConfig: Record<string, string> = {};
      providerTypeData.setup_steps.forEach((step: ProviderSetupStep) => {
        if (step.type === "secret" && provider.config[step.alias]) {
          updatedConfig[step.alias] = "••••••••";
        } else if (step.type !== "info" && step.type !== "oauth") {
          updatedConfig[step.alias] = provider.config[step.alias] || "";
        }
      });
      setConfig(updatedConfig);
    }
  }, [providerTypeData, isEditMode, provider]);

  const createMutation = useMutation({
    mutationFn: async (data: { namespace_id: string; type: string; alias: string; config: Record<string, any> }) => {
      return await createProvider(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers", namespaceId] });
      showSuccessNotification("Provider created", "The provider has been created successfully.");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to create provider", errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { alias?: string; config?: Record<string, any> }) => {
      if (!provider) throw new Error("Provider is required for update");
      return await updateProvider(provider.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers", namespaceId] });
      showSuccessNotification("Provider updated", "The provider has been updated successfully.");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to update provider", errorMessage);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate provider type selection (create mode only)
    if (!isEditMode && !selectedProviderType) {
      setErrors({ providerType: "Provider type is required" });
      return;
    }

    // Validate alias
    if (!alias.trim()) {
      setErrors({ alias: "Alias is required" });
      return;
    }

    // Validate required fields
    const newErrors: Record<string, string> = {};
    if (providerTypeData) {
          providerTypeData.setup_steps.forEach((step: ProviderSetupStep) => {
        if (step.type !== "info" && step.type !== "oauth" && step.type !== "webhook" && step.required) {
          const value = config[step.alias];
          const hasExistingSecret = isEditMode && step.type === "secret" && provider && provider.config[step.alias];
          const isMasked = hasExistingSecret && (value === "••••••••" || value === "");
          // In edit mode, masked secrets are valid (they preserve existing value)
          if (!value || (value.trim() === "" && !isMasked)) {
            newErrors[step.alias] = `${step.title} is required`;
          }
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build config object, excluding masked secrets in edit mode
    const configToSend: Record<string, any> = {};
    if (providerTypeData) {
      providerTypeData.setup_steps.forEach((step: ProviderSetupStep) => {
        if (step.type !== "info" && step.type !== "oauth") {
          // For webhook steps, include the default value if it exists
          if (step.type === "webhook") {
            const webhookUrl = provider?.config[step.alias] || step.default;
            if (webhookUrl) {
              configToSend[step.alias] = webhookUrl;
            }
            return;
          }

          const value = config[step.alias];
          // In edit mode, if it's a secret field and value is empty or masked, preserve existing
          if (isEditMode && step.type === "secret" && (!value || value === "" || value === "••••••••")) {
            // Don't include - existing value will be preserved
            return;
          }
          // Include non-empty values
          if (value !== undefined && value !== "" && value !== "••••••••") {
            configToSend[step.alias] = value;
          }
        }
      });
    }

    if (isEditMode) {
      updateMutation.mutate({
        alias: alias.trim(),
        config: Object.keys(configToSend).length > 0 ? configToSend : undefined,
      });
    } else {
      createMutation.mutate({
        namespace_id: namespaceId,
        type: selectedProviderType,
        alias: alias.trim(),
        config: configToSend,
      });
    }
  };

  const handleCancel = () => {
    setAlias("");
    setConfig({});
    setErrors({});
    onOpenChange(false);
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const renderSetupStep = (step: ProviderSetupStep) => {
    if (step.type === "info") {
      return (
        <div key={step.alias} className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">{step.title}</h4>
          {step.message && <p className="text-sm text-blue-700 dark:text-blue-300">{step.message}</p>}
          {step.action_url && step.action_text && (
            <a
              href={step.action_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {step.action_text}
            </a>
          )}
        </div>
      );
    }

    if (step.type === "webhook") {
      // Use existing webhook URL from provider config, or the pre-generated default
      const webhookUrl = provider?.config[step.alias] || step.default || "";
      return (
        <div key={step.alias}>
          <Label htmlFor={step.alias}>{step.title}</Label>
          {step.description && (
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">{step.description}</p>
          )}
          {webhookUrl ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                id={step.alias}
                type="text"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm bg-muted cursor-default select-none opacity-75"
                onFocus={(e) => e.target.blur()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                }}
                className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1 italic">
              Webhook URL will be generated when you save this provider.
            </p>
          )}
        </div>
      );
    }

    if (step.type === "oauth") {
      return (
        <div key={step.alias} className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">{step.title}</h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            OAuth configuration is not yet supported in the UI. Please use the CLI to configure OAuth providers.
          </p>
        </div>
      );
    }

    if (step.type === "file") {
      return (
        <div key={step.alias} className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">{step.title}</h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            File upload is not yet supported in the UI. Please use the CLI to configure file-based providers.
          </p>
        </div>
      );
    }

    const value = config[step.alias] || "";
    const isSecret = step.type === "secret";
    // Check if this is a masked secret (has existing value but user hasn't changed it)
    const hasExistingSecret = isEditMode && isSecret && provider && provider.config[step.alias];
    const isMasked = hasExistingSecret && (value === "••••••••" || value === "");
    const hasError = !!errors[step.alias];

    return (
      <div key={step.alias}>
        <Label htmlFor={step.alias}>
          {step.title}
          {step.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {step.description && (
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">{step.description}</p>
        )}
        {step.type === "choice" ? (
          <Select
            value={value}
            onValueChange={(val) => handleConfigChange(step.alias, val)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <SelectTrigger className="mt-1" aria-invalid={hasError}>
              <SelectValue placeholder={step.placeholder || `Select ${step.title.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {step.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={step.alias}
            type={isSecret ? "password" : "text"}
            value={isMasked ? "" : value}
            onChange={(e) => {
              // If it was masked and user starts typing, clear the masked marker
              const newValue = e.target.value;
              if (isMasked && newValue !== "") {
                handleConfigChange(step.alias, newValue);
              } else {
                handleConfigChange(step.alias, newValue);
              }
            }}
            placeholder={isMasked ? "•••••••• (leave empty to keep existing)" : step.placeholder || step.default || ""}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="mt-1"
            aria-invalid={hasError}
          />
        )}
        {isMasked && (
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to keep the existing value, or enter a new value to update it.
          </p>
        )}
        {hasError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors[step.alias]}</p>
        )}
      </div>
    );
  };

  const isLoading = isLoadingType || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Configure Provider" : "Create Provider"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the provider configuration. Leave secret fields empty to preserve existing values."
              : "Create a new provider by selecting a type and configuring its settings."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditMode && (
            <div>
              <Label htmlFor="providerType">
                Provider Type <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                value={selectedProviderType}
                onValueChange={setSelectedProviderType}
                disabled={isLoading}
              >
                <SelectTrigger className="mt-1" aria-invalid={!!errors.providerType}>
                  <SelectValue placeholder="Select a provider type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="gitlab">GitLab</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="jira">Jira</SelectItem>
                  <SelectItem value="todoist">Todoist</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google AI</SelectItem>
                  <SelectItem value="kvstore">KV Store</SelectItem>
                  <SelectItem value="builtin">Built-in</SelectItem>
                </SelectContent>
              </Select>
              {errors.providerType && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.providerType}</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="alias">
              Alias <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="alias"
              type="text"
              value={alias}
              onChange={(e) => {
                setAlias(e.target.value);
                if (errors.alias) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.alias;
                    return newErrors;
                  });
                }
              }}
              placeholder="default"
              disabled={isLoading}
              className="mt-1"
              aria-invalid={!!errors.alias}
            />
            {errors.alias && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.alias}</p>
            )}
          </div>

          <Loader isLoading={isLoadingType} loadingMessage="Loading provider configuration...">
            {providerTypeData && providerTypeData.setup_steps.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium text-sm">Configuration</h3>
                {providerTypeData.setup_steps.map((step: ProviderSetupStep) => renderSetupStep(step))}
              </div>
            )}
            {providerTypeData && providerTypeData.setup_steps.length === 0 && (
              <div className="text-sm text-muted-foreground border-t pt-4">
                This provider type requires no additional configuration.
              </div>
            )}
          </Loader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update Provider"
                : "Create Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

