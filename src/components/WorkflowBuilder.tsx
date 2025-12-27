import { useState, useRef, useEffect } from "react";
import {
  ChatSection,
  ChatInput,
  ChatMessage,
  ChatMessages,
  useChatUI,
  type Message,
  type ChatHandler,
  getParts,
} from "@llamaindex/chat-ui";
import "@llamaindex/chat-ui/styles/markdown.css";
import "@llamaindex/chat-ui/styles/editor.css";
import Markdown from "react-markdown";
import Editor from "@monaco-editor/react";
import { api, handleApiError } from "@/lib/api";
import { useMonacoTheme } from "@/hooks/useMonacoTheme";
import { 
  AlertTriangle, 
  Loader2, 
  Check, 
  ArrowRight,
  Sparkles,
  Settings,
  Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; 
import { showErrorNotification, showSuccessNotification } from "@/stores/notificationStore";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Provider, WorkflowDeployment, WorkflowDeploymentsResponse } from "@/types/api";
import { ProviderConfigModal } from "@/components/ProviderConfigModal";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface WorkflowBuilderProps {
  workflowId: string;
}

interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

interface MessagePart {
  type: string;
  text?: string;
  data?: {
    message?: string;
    question?: string;
    options?: QuestionOption[];
    provider_type?: string;
    code?: string;
    allow_multiple?: boolean; 
  };
}

interface BuilderChatResponse {
  message: {
    role: string;
    parts: MessagePart[];
  };
  code?: string;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getMessageText(message: Message): string {
  const textParts = getParts(message, "text");
  return textParts.map((p) => p.text).join("");
}

const EXAMPLE_PROMPTS = [
  "Send a slack message in #deployments whenever a merge request gets merged on usefloww/floww-sdk",
  "Every morning at 9am, send a message with the tickets that got done the day before",
  "When a new issue is created in GitHub, create a corresponding task in Linear",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "👋 Welcome to the Workflow Builder! I'll help you create your workflow step by step.\n\nTry one of these examples, or describe your own automation:",
    },
    {
      type: "data-examples",
      data: {
        prompts: EXAMPLE_PROMPTS,
      },
    },
  ],
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready");
  const [code, setCode] = useState<string>(`// Your workflow code will appear here as we build it together
// Describe what you want and I'll help you build it!
`);
  const monacoTheme = useMonacoTheme();
  const formRef = useRef<HTMLDivElement>(null);
  const { currentNamespace } = useNamespaceStore();
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<string | undefined>(undefined);

  const queryClient = useQueryClient();

  // Fetch providers for the current namespace
  const { data: providersData } = useQuery<Provider[]>({
    queryKey: ['providers', currentNamespace?.id],
    queryFn: async () => {
      if (!currentNamespace?.id) return [];
      const params = { namespace_id: currentNamespace.id };
      const data = await api.get<{ results: Provider[] }>("/providers", { params });
      return Array.isArray(data?.results) ? data.results : [];
    },
    enabled: !!currentNamespace?.id,
  });

  const providers: Provider[] = providersData || [];

  // Fetch existing deployments to get a runtime_id
  const { data: deploymentsData } = useQuery<WorkflowDeployment[]>({
    queryKey: ['deployments', workflowId],
    queryFn: async () => {
      const params = { workflow_id: workflowId };
      const data = await api.get<WorkflowDeploymentsResponse>("/workflow_deployments", { params });
      return (data.deployments || []).sort(
        (a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime()
      );
    },
  });

  const existingDeployments = deploymentsData || [];
  const latestDeployment = existingDeployments[0];

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      const deploymentData: Record<string, unknown> = {
        workflow_id: workflowId,
        code: {
          files: { "main.ts": code },
          entrypoint: "main.ts",
        },
      };
      
      // Use existing runtime if available, otherwise backend will use default runtime
      if (latestDeployment?.runtime_id) {
        deploymentData.runtime_id = latestDeployment.runtime_id;
      }
      
      return api.post("/workflow_deployments", deploymentData);
    },
    onSuccess: () => {
      showSuccessNotification("Deployed!", "Your workflow has been deployed successfully.");
      queryClient.invalidateQueries({ queryKey: ['deployments', workflowId] });
    },
    onError: (error) => {
      showErrorNotification("Deploy failed", handleApiError(error));
    },
  });

  const canDeploy = code.includes("import") && code.length > 50;
  const isDeploying = deployMutation.isPending;

  async function sendMessage(msg: Message) {
    const userContent = getMessageText(msg);
    
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    setStatus("submitted");

    try {
      const simpleMessages = messages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      }));

      const resp = await api.post<BuilderChatResponse>(
        `/workflows/${workflowId}/builder/chat`,
        {
          messages: simpleMessages,
          user_message: userContent,
          current_code: code,
          namespace_id: currentNamespace?.id,
        },
        {
          timeout: 30000,
        }
      );

      const processedParts: any[] = [];
      
      for (const part of resp.message.parts) {
        if (part.type === "text" && part.text) {
          processedParts.push({ type: "text", text: part.text });
        } else if (part.type === "data-question" && part.data?.options) {
          processedParts.push({
            type: "data-question",
            data: { 
              question: part.data.question,
              options: part.data.options,
              allow_multiple: part.data.allow_multiple,
            },
          });
        } else if (part.type === "data-not-supported" && part.data?.message) {
          processedParts.push({
            type: "data-not-supported",
            data: { message: part.data.message },
          });
        } else if (part.type === "data-provider-setup" && part.data) {
          processedParts.push({
            type: "data-provider-setup",
            data: {
              message: part.data.message,
              provider_type: part.data.provider_type,
            },
          });
        } else if (part.type === "data-code" && part.data?.code) {
          processedParts.push({
            type: "data-code",
            data: { code: part.data.code },
          });
        }
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        parts: processedParts,
      };

      setMessages([...newMessages, assistantMsg]);
      
      if (resp.code) {
        setCode(resp.code);
      }
      
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      const errorMessage = handleApiError(error);
      showErrorNotification("Chat error", errorMessage);
      console.error("Error sending message:", error);
    }
  }

  // Handle clicking an example prompt
  const handleExampleClick = (prompt: string) => {
    const exampleMessage: Message = {
      id: `example-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };
    sendMessage(exampleMessage);
  };

  // Handle confirming a selection (Single or Multi)
  const handleSelectionConfirm = async (selectedOptions: QuestionOption[], answerText?: string) => {
    // Use provided answerText if available, otherwise convert options to string
    const labelString = answerText || selectedOptions.map(o => o.label).join(", ");
    
    // Create user message with the answer
    const userMsg: Message = {
      id: `answer-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: labelString }],
    };
    
    // Add user message to conversation
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStatus("submitted");

    try {
      // Include the user's answer in the conversation history
      const simpleMessages = newMessages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      }));

      const resp = await api.post<BuilderChatResponse>(
        `/workflows/${workflowId}/builder/chat`,
        {
          messages: simpleMessages,
          user_message: labelString,
          current_code: code,
          namespace_id: currentNamespace?.id,
        },
        {
          timeout: 30000,
        }
      );

      const processedParts: any[] = [];
      
      for (const part of resp.message.parts) {
        if (part.type === "text" && part.text) {
          processedParts.push({ type: "text", text: part.text });
        } else if (part.type === "data-question" && part.data?.options) {
          processedParts.push({
            type: "data-question",
            data: { 
              question: part.data.question,
              options: part.data.options,
              allow_multiple: part.data.allow_multiple,
            },
          });
        } else if (part.type === "data-not-supported" && part.data?.message) {
          processedParts.push({
            type: "data-not-supported",
            data: { message: part.data.message },
          });
        } else if (part.type === "data-provider-setup" && part.data) {
          processedParts.push({
            type: "data-provider-setup",
            data: {
              message: part.data.message,
              provider_type: part.data.provider_type,
            },
          });
        } else if (part.type === "data-code" && part.data?.code) {
          processedParts.push({
            type: "data-code",
            data: { code: part.data.code },
          });
        }
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        parts: processedParts,
      };

      setMessages([...newMessages, assistantMsg]);
      
      if (resp.code) {
        setCode(resp.code);
      }
      
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      const errorMessage = handleApiError(error);
      showErrorNotification("Chat error", errorMessage);
      console.error("Error sending message:", error);
    }
  };

  const handler: ChatHandler = {
    messages,
    status,
    sendMessage,
  };

  // Control textarea height to prevent unnecessary growth
  useEffect(() => {
    const container = formRef.current;
    if (!container) return;

    const findTextarea = () => {
      return container.querySelector("textarea") as HTMLTextAreaElement | null;
    };

    let singleLineHeight = 0;
    let rafId: number | null = null;

    const measureSingleLineHeight = (textarea: HTMLTextAreaElement): number => {
      // Temporarily set to single line to measure
      const originalValue = textarea.value;
      const originalHeight = textarea.style.height;
      const originalOverflow = textarea.style.overflow;
      
      // Use a character that represents typical text height
      textarea.value = "M";
      textarea.style.height = "auto";
      textarea.style.overflow = "hidden";
      textarea.style.paddingTop = "";
      textarea.style.paddingBottom = "";
      
      // Force a reflow to get accurate measurement
      void textarea.offsetHeight;
      
      const measuredHeight = textarea.scrollHeight;
      
      // Restore original state
      textarea.value = originalValue;
      textarea.style.height = originalHeight;
      textarea.style.overflow = originalOverflow;
      
      return measuredHeight;
    };

    const adjustHeight = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        const textarea = findTextarea();
        if (!textarea) return;

        // Measure single line height on first run
        if (singleLineHeight === 0) {
          singleLineHeight = measureSingleLineHeight(textarea);
        }

        // Get current value length to detect if it's truly wrapping
        const value = textarea.value;
        const hasNewlines = value.includes("\n");
        
        // Reset height to get accurate scrollHeight
        textarea.style.height = "auto";
        textarea.style.overflow = "hidden";
        const scrollHeight = textarea.scrollHeight;
        
        // Only grow if:
        // 1. Content has newlines (explicit wrapping), OR
        // 2. scrollHeight is significantly larger than single line (actual wrapping)
        // Use a larger threshold (5px) to prevent minor fluctuations
        if (hasNewlines || scrollHeight > singleLineHeight + 5) {
          textarea.style.setProperty("height", `${Math.min(scrollHeight, 128)}px`, "important"); // max-h-32 = 128px
          textarea.style.setProperty("overflow-y", "auto", "important");
        } else {
          // Force single line height with important to override library styles
          // Ensure padding is preserved for proper text alignment
          textarea.style.setProperty("height", `${singleLineHeight}px`, "important");
          textarea.style.setProperty("overflow", "hidden", "important");
          textarea.style.setProperty("padding-top", "", "important");
          textarea.style.setProperty("padding-bottom", "", "important");
        }
      });
    };

    // Use MutationObserver to detect when textarea is added to DOM
    const observer = new MutationObserver(() => {
      const textarea = findTextarea();
      if (textarea && !textarea.dataset.heightControlled) {
        textarea.dataset.heightControlled = "true";
        // Measure single line height
        singleLineHeight = measureSingleLineHeight(textarea);
        // Set initial height with important to override library
        textarea.style.setProperty("height", `${singleLineHeight}px`, "important");
        textarea.style.setProperty("overflow", "hidden", "important");
        // Add event listeners
        textarea.addEventListener("input", adjustHeight);
      }
    });

    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    
    // Initial check with a delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      const textarea = findTextarea();
      if (textarea && !textarea.dataset.heightControlled) {
        textarea.dataset.heightControlled = "true";
        singleLineHeight = measureSingleLineHeight(textarea);
        textarea.style.setProperty("height", `${singleLineHeight}px`, "important");
        textarea.style.setProperty("overflow", "hidden", "important");
        textarea.addEventListener("input", adjustHeight);
      }
    }, 150);

    // Monitor for library overrides - check computed height, not just inline style
    const checkInterval = setInterval(() => {
      const textarea = findTextarea();
      if (textarea && textarea.dataset.heightControlled && singleLineHeight > 0) {
        const computedHeight = textarea.offsetHeight;
        const value = textarea.value;
        const hasNewlines = value.includes("\n");
        
        // If height was changed but shouldn't be, reset it
        if (!hasNewlines && computedHeight > singleLineHeight + 5) {
          // Check if content actually wraps
          textarea.style.height = "auto";
          textarea.style.overflow = "hidden";
          const scrollHeight = textarea.scrollHeight;
          if (scrollHeight <= singleLineHeight + 5) {
            // Force single line - use setProperty with important to override library
            textarea.style.setProperty("height", `${singleLineHeight}px`, "important");
            textarea.style.setProperty("overflow", "hidden", "important");
          } else {
            textarea.style.setProperty("height", `${Math.min(scrollHeight, 128)}px`, "important");
            textarea.style.setProperty("overflow-y", "auto", "important");
          }
        }
      }
    }, 50); // Check more frequently

    return () => {
      clearTimeout(timeoutId);
      clearInterval(checkInterval);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      const textarea = findTextarea();
      if (textarea) {
        textarea.removeEventListener("input", adjustHeight);
      }
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-280px)] gap-6 p-1">
      {/* Left Column: Code Preview */}
      <div className="w-1/2 flex flex-col border border-border rounded-xl overflow-hidden bg-card shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-semibold text-foreground">main.ts</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-0.5 bg-background rounded-full border">Generated</span>
            </div>
            <Button
              size="sm"
              onClick={() => deployMutation.mutate()}
              disabled={!canDeploy || isDeploying}
              className={cn(
                "gap-2 transition-all",
                canDeploy ? "bg-green-600 hover:bg-green-700 text-white" : ""
              )}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5" />
                  Deploy
                </>
              )}
            </Button>
        </div>
        <div className="flex-1 relative">
            <Editor
            height="100%"
            defaultLanguage="typescript"
            value={code}
            onChange={(value) => setCode(value || "")}
            theme={monacoTheme}
            options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 22,
                padding: { top: 16 },
                fontFamily: "'JetBrains Mono', monospace",
                scrollBeyondLastLine: false,
                smoothScrolling: true,
            }}
            />
        </div>
      </div>

      {/* Right Column: Unified Chat Interface */}
      <div className="w-1/2 flex flex-col">
        {/* Unified container for history + input */}
        <div className="flex-1 border border-border rounded-2xl bg-background shadow-sm overflow-hidden flex flex-col relative transition-all">
            
          <ChatSection handler={handler} className="h-full flex flex-col">
            
            {/* Messages Area - flex-1 allows it to fill space and scroll */}
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                <CustomChatMessages 
                    status={status} 
                    onConfirm={handleSelectionConfirm}
                    providers={providers}
                    onOpenProviderModal={(providerType) => {
                      setSelectedProviderType(providerType);
                      setProviderModalOpen(true);
                    }}
                    onExampleClick={handleExampleClick}
                />
                {/* Invisible element to auto-scroll to bottom if needed */}
                <div className="h-4" /> 
            </div>

            {/* Input Area - Integrated visually at the bottom */}
<div className="p-4 bg-background mt-auto z-10" ref={formRef}>
              <ChatInput className="relative">
                <ChatInput.Form 
                  className="
                    relative flex items-center gap-2 
                    bg-background 
                    border border-input 
                    rounded-xl px-3 py-3 
                    shadow-sm 
                    transition-all duration-200 ease-in-out
                    focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary
                  "
                >
                  
                  {/* Icon Area */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  
                  {/* The actual input */}
                  {/* resize-none prevents manual dragging. Height controlled via useEffect */}
                  <ChatInput.Field 
                    placeholder="Type a message or click an example above..." 
                    className="
                      flex-1 
                      bg-transparent 
                      min-h-[24px]
                      max-h-32 
                      border-none 
                      shadow-none 
                      outline-none 
                      focus-visible:ring-0 
                      focus-visible:ring-offset-0 
                      p-0 py-1
                      text-sm 
                      placeholder:text-muted-foreground/60 
                      resize-none
                      leading-normal
                      overflow-y-auto
                    " 
                  />
                  
                  {/* Submit Button */}
                  <ChatInput.Submit 
                    className="
                      shrink-0 
                      p-2 h-8 w-8 
                      rounded-lg 
                      bg-primary text-primary-foreground 
                      hover:bg-primary/90 
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center 
                      transition-all
                    " 
                  />
                </ChatInput.Form>
              </ChatInput>
              
              <div className="text-[10px] text-center text-muted-foreground mt-3 opacity-60">
                AI can make mistakes. Review generated workflows.
              </div>
            </div>
          </ChatSection>
          
        </div>
      </div>
      
      {/* Provider Configuration Modal */}
      {currentNamespace && (
        <ProviderConfigModal
          open={providerModalOpen}
          onOpenChange={(open) => {
            setProviderModalOpen(open);
            if (!open) {
              setSelectedProviderType(undefined);
            }
          }}
          namespaceId={currentNamespace.id}
          providerType={selectedProviderType}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Custom Chat Message List
// ------------------------------------------------------------------

interface CustomChatMessagesProps {
  status: "submitted" | "streaming" | "ready" | "error";
  onConfirm: (options: QuestionOption[], answerText?: string) => void;
  providers: Provider[];
  onOpenProviderModal: (providerType: string) => void;
  onExampleClick: (prompt: string) => void;
}

function CustomChatMessages({ status, onConfirm, providers, onOpenProviderModal, onExampleClick }: CustomChatMessagesProps) {
  const { messages } = useChatUI();
  const isLoading = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);
  const [focusedExampleIndex, setFocusedExampleIndex] = useState<number | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // Reset focus when messages change
    setFocusedExampleIndex(null);
  }, [messages.length, status]);

  return (
    <ChatMessages className="h-full px-4 pt-6 pb-2 space-y-8">
      <ChatMessages.List>
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          const isAssistant = message.role === "assistant";
          const isInteractionActive = isLast && !isLoading;
          
          // Extract parts
          const questionParts = getParts(message, "data-question");
          const exampleParts = getParts(message, "data-examples");
          const notSupportedParts = getParts(message, "data-not-supported");
          const providerSetupParts = getParts(message, "data-provider-setup");
          const codeParts = getParts(message, "data-code");

          return (
            <div key={message.id || index} className="group animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
              <ChatMessage
                message={message}
                isLast={isLast}
                className={cn(
                    "items-start gap-4 max-w-full",
                    isAssistant ? "" : "flex-row-reverse"
                )}
              >
                {/* Avatar */}
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border shadow-sm shrink-0 mt-1",
                    isAssistant ? "bg-background border-border" : "bg-primary text-primary-foreground border-primary"
                )}>
                    {isAssistant ? <Sparkles className="h-4 w-4 text-primary" /> : <div className="text-xs font-bold">You</div>}
                </div>

                <div className={cn("flex-1 space-y-2 min-w-0", isAssistant ? "" : "flex flex-col items-end")}>
                    
                    {/* Text Content */}
                    {getMessageText(message) && (
                      <div className={cn(
                          "prose prose-sm dark:prose-invert max-w-none break-words",
                          isAssistant ? "text-foreground" : "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm"
                      )}>
                          <Markdown>{getMessageText(message)}</Markdown>
                      </div>
                    )}

                    {/* --- Interactive Elements (Only for Assistant) --- */}
                    
                    {/* 1. Example Prompts */}
                    {isAssistant && exampleParts.length > 0 && (
                        <div className="mt-4 w-full max-w-2xl">
                            {exampleParts.map((part: any, partIndex) => (
                                <div key={partIndex} className="grid grid-cols-1 gap-2.5">
                                    {(part.data?.prompts || []).map((prompt: string, promptIndex: number) => {
                                        const isFocused = focusedExampleIndex === promptIndex;
                                        return (
                                            <button
                                                key={promptIndex}
                                                onClick={() => {
                                                    if (isInteractionActive) {
                                                        onExampleClick(prompt);
                                                        setFocusedExampleIndex(null);
                                                    }
                                                }}
                                                onMouseEnter={() => {
                                                    if (isInteractionActive) {
                                                        setFocusedExampleIndex(promptIndex);
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    if (isInteractionActive) {
                                                        setFocusedExampleIndex(null);
                                                    }
                                                }}
                                                onFocus={() => {
                                                    if (isInteractionActive) {
                                                        setFocusedExampleIndex(promptIndex);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (isInteractionActive) {
                                                        setFocusedExampleIndex(null);
                                                    }
                                                }}
                                                disabled={!isInteractionActive}
                                                className={cn(
                                                    "group relative text-left rounded-xl border p-4 transition-all duration-200",
                                                    isInteractionActive
                                                        ? "cursor-pointer border-border bg-card"
                                                        : "opacity-60 pointer-events-none grayscale-[0.5]",
                                                    isFocused && isInteractionActive
                                                        ? "border-primary/60 bg-muted/50"
                                                        : isInteractionActive
                                                        ? "hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm"
                                                        : "",
                                                    "hover:scale-[1.01] active:scale-[0.99]"
                                                )}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                                        isFocused && isInteractionActive
                                                            ? "border-primary/50 bg-primary/10"
                                                            : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
                                                    )}>
                                                        <ArrowRight className={cn(
                                                            "h-3 w-3 transition-colors",
                                                            isFocused && isInteractionActive
                                                                ? "text-primary"
                                                                : "text-muted-foreground group-hover:text-primary"
                                                        )} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-foreground">
                                                            {prompt}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 2. Questions / Options */}
                    {isAssistant && questionParts.length > 0 && (
                        <MultiQuestionContainer
                            questions={questionParts as Array<{ data?: QuestionData }>}
                            isActive={isInteractionActive}
                            onConfirm={onConfirm}
                        />
                    )}

                    {/* 3. Provider Setup Prompts */}
                    {isAssistant && providerSetupParts.length > 0 && (
                        <div className="mt-2 w-full max-w-md">
                        {providerSetupParts.map((part: any, partIndex) => {
                            const providerType = part.data?.provider_type;
                            const existingProvider = providers.find(p => p.type.toLowerCase() === providerType?.toLowerCase());
                            
                            return (
                            <div
                                key={partIndex}
                                className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl p-4 transition-all hover:border-blue-300"
                            >
                                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3 font-medium">
                                    {part.data?.message}
                                </p>
                                {existingProvider ? (
                                    <div className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/40 rounded-lg gap-2">
                                        <Check className="h-4 w-4" />
                                        Using: {existingProvider.alias || existingProvider.name || providerType}
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => onOpenProviderModal(providerType)}
                                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors gap-2"
                                    >
                                        <Settings className="h-4 w-4" />
                                        Configure {providerType}
                                    </Button>
                                )}
                            </div>
                            );
                        })}
                        </div>
                    )}

                    {/* 4. Warnings */}
                    {isAssistant && notSupportedParts.length > 0 && (
                        <div className="mt-2 w-full max-w-md">
                        {notSupportedParts.map((part: any, partIndex) => (
                            <div
                            key={partIndex}
                            className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 flex items-start gap-3"
                            >
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-amber-800 dark:text-amber-200">
                                {part.data?.message}
                            </span>
                            </div>
                        ))}
                        </div>
                    )}

                    {/* 5. Code Snippets (if sent in message) */}
                    {isAssistant && codeParts.length > 0 && (
                        <div className="mt-2 w-full max-w-lg">
                        {codeParts.map((part: any, partIndex) => (
                            <div key={partIndex} className="bg-muted/50 border rounded-lg p-3 overflow-x-auto">
                            <pre className="text-xs font-mono text-foreground">
                                <code>{part.data?.code}</code>
                            </pre>
                            </div>
                        ))}
                        </div>
                    )}
                </div>
              </ChatMessage>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-4 animate-in fade-in duration-300 pl-1">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-transparent">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Thinking</span>
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1 h-1 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1 h-1 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ChatMessages.List>
    </ChatMessages>
  );
}

// ------------------------------------------------------------------
// Multi-Question Container (Handles multiple questions with single Continue)
// ------------------------------------------------------------------

interface QuestionData {
    question?: string;
    options?: QuestionOption[];
    allow_multiple?: boolean;
}

interface MultiQuestionContainerProps {
    questions: Array<{ data?: QuestionData }>;
    isActive: boolean;
    onConfirm: (options: QuestionOption[], answerText?: string) => void;
}

function MultiQuestionContainer({ questions, isActive, onConfirm }: MultiQuestionContainerProps) {
    // Track selections for each question by index
    const [selections, setSelections] = useState<Record<number, Set<string>>>({});

    const toggleOption = (questionIndex: number, optionId: string, allowMultiple: boolean) => {
        if (!isActive) return;

        setSelections(prev => {
            const currentSet = prev[questionIndex] || new Set<string>();
            const newSet = new Set(allowMultiple ? currentSet : []);
            
            if (newSet.has(optionId)) {
                newSet.delete(optionId);
            } else {
                if (!allowMultiple) newSet.clear();
                newSet.add(optionId);
            }
            
            return { ...prev, [questionIndex]: newSet };
        });
    };

    // Check if all questions have at least one selection
    const allQuestionsAnswered = questions.every((_, index) => {
        const selected = selections[index];
        return selected && selected.size > 0;
    });

    // Build combined answer text
    const handleConfirm = () => {
        const answers: string[] = [];
        const allSelectedOptions: QuestionOption[] = [];

        questions.forEach((part, index) => {
            const selectedIds = selections[index] || new Set<string>();
            const options = part.data?.options || [];
            const selectedOptions = options.filter(o => selectedIds.has(o.id));
            
            allSelectedOptions.push(...selectedOptions);
            
            if (selectedOptions.length > 0) {
                const answerLabels = selectedOptions.map(o => o.label).join(", ");
                if (part.data?.question) {
                    answers.push(`${part.data.question}: ${answerLabels}`);
                } else {
                    answers.push(answerLabels);
                }
            }
        });

        const combinedAnswerText = answers.join("\n");
        onConfirm(allSelectedOptions, combinedAnswerText);
    };

    return (
        <div className="mt-4 w-full max-w-md space-y-6">
            {questions.map((part, questionIndex) => {
                const questionData = part.data;
                const options = questionData?.options || [];
                const allowMultiple = questionData?.allow_multiple ?? false;
                const selectedIds = selections[questionIndex] || new Set<string>();

                return (
                    <div key={questionIndex} className="space-y-2">
                        {questionData?.question && (
                            <div className="text-sm font-medium text-foreground">
                                {questionData.question}
                            </div>
                        )}
                        <div className="grid grid-cols-1 gap-2">
                            {options.map((option) => {
                                const isSelected = selectedIds.has(option.id);
                                return (
                                    <div
                                        key={option.id}
                                        onClick={() => toggleOption(questionIndex, option.id, allowMultiple)}
                                        className={cn(
                                            "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                                            isActive 
                                                ? "cursor-pointer hover:border-primary/40 hover:bg-muted/40" 
                                                : "opacity-60 pointer-events-none grayscale-[0.5]",
                                            isSelected 
                                                ? "border-primary bg-primary/5" 
                                                : "border-border bg-card"
                                        )}
                                    >
                                        <div className={cn(
                                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200",
                                            isSelected 
                                                ? "border-primary bg-primary text-primary-foreground" 
                                                : "border-muted-foreground/30 bg-background group-hover:border-primary/50",
                                            !allowMultiple && "rounded-full" 
                                        )}>
                                            <Check className={cn(
                                                "h-3.5 w-3.5 transition-transform duration-200", 
                                                isSelected ? "scale-100" : "scale-0"
                                            )} />
                                        </div>
                                        
                                        <div className="flex-1 space-y-0.5">
                                            <div className={cn("text-sm font-medium transition-colors", isSelected ? "text-primary" : "text-foreground")}>
                                                {option.label}
                                            </div>
                                            {option.description && (
                                                <div className="text-xs text-muted-foreground leading-relaxed">
                                                    {option.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Show hint for current question */}
                        <div className="text-xs text-muted-foreground pl-1">
                            {allowMultiple ? "Select all that apply" : "Select one option"}
                        </div>
                    </div>
                );
            })}

            {/* Single Continue button for all questions */}
            {isActive && (
                <div className="flex items-center justify-end gap-2 pt-2 animate-in slide-in-from-top-1 fade-in duration-300">
                    <Button 
                        size="sm" 
                        onClick={handleConfirm}
                        disabled={!allQuestionsAnswered}
                        className={cn(
                            "gap-2 transition-all duration-300 rounded-lg px-4",
                            allQuestionsAnswered 
                                ? "opacity-100 translate-x-0" 
                                : "opacity-50 translate-x-2 grayscale"
                        )}
                    >
                        Continue <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}