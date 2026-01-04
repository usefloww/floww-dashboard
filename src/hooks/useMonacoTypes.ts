import { useEffect, useState, useRef, useCallback } from "react";
import type { BeforeMount, OnMount } from "@monaco-editor/react";
import { 
  prefetchPackageTypes, 
  configureMonacoBeforeMount, 
  loadTypesAfterMount,
  type PackageTypeConfig 
} from "@/utils/monacoTypes";

interface UseMonacoTypesOptions {
  packages?: PackageTypeConfig[];
  enabled?: boolean;
}

export function useMonacoTypes(options: UseMonacoTypesOptions = {}) {
  const { packages, enabled = true } = options;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const prefetchedTypesRef = useRef<Map<string, string>>(new Map());
  const monacoRef = useRef<any>(null);

  // Prefetch types on mount
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function prefetch() {
      try {
        const types = await prefetchPackageTypes(packages);
        if (!cancelled) {
          prefetchedTypesRef.current = types;
          
          // If Monaco is already available, add the types now
          if (monacoRef.current) {
            types.forEach((content, packageName) => {
              monacoRef.current.languages.typescript.typescriptDefaults.addExtraLib(
                content,
                `file:///node_modules/${packageName}/index.d.ts`
              );
            });
          }
          
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error("Failed to prefetch type definitions");
          setError(error);
          setIsLoading(false);
          console.error("Monaco types prefetch error:", error);
        }
      }
    }

    prefetch();

    return () => {
      cancelled = true;
    };
  }, [enabled, packages]);

  // Called BEFORE the editor is created - configure Monaco synchronously
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    if (!enabled) return;
    
    monacoRef.current = monaco;
    
    // Configure compiler options and add any prefetched types
    configureMonacoBeforeMount(monaco, prefetchedTypesRef.current);
  }, [enabled]);

  // Called AFTER the editor is created - load any remaining types
  const handleMount: OnMount = useCallback(async (_editor, monaco) => {
    if (!enabled) return;
    
    monacoRef.current = monaco;
    
    // If types weren't prefetched in time, load them now
    if (prefetchedTypesRef.current.size === 0) {
      try {
        await loadTypesAfterMount(monaco, packages);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load type definitions");
        setError(error);
        console.error("Monaco types loading error:", error);
      }
    }
  }, [enabled, packages]);

  return {
    beforeMount: handleBeforeMount,
    onMount: handleMount,
    isLoading,
    error,
  };
}
