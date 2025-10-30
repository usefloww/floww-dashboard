import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import { AuthProvider } from "@/components/AuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import "./index.css";

Sentry.init({
  dsn: "",
  sendDefaultPii: true,
});

// Create a new router instance
export const router = createRouter({
  routeTree,
  defaultPreload: false,
  defaultGcTime: 5,
  defaultPreloadGcTime: 5,
  defaultPreloadStaleTime: 5,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
