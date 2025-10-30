import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { LoadingScreen } from "@/components/LoadingScreen";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { NotificationContainer } from "@/components/NotificationToast";

const loadingMessages = [
  "Convincing the servers that it's not Friday afternoon yet...",
  "Calculating the optimal loading speed... (our AI is taking its time to be precise)",
  "Convincing the servers to wake up... (they're having a Monday morning)",
  "Making you wait intentionally...",
  "Showing a loading screen...",
  "Floww is processing your workflows efficiently...",
];

export const Route = createRootRoute({
  component: Root,
  errorComponent: () => {
    const randomMessage =
      loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    return <LoadingScreen>{randomMessage}</LoadingScreen>;
  },
});

function Root() {

  return (
    <div className="min-h-screen">
      <div className="flex h-screen">
        <AuthGuard>
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-8">
              <Outlet />
            </div>
          </main>
        </AuthGuard>
      </div>

      <NotificationContainer />
      <TanStackRouterDevtools />
    </div>
  );
}
