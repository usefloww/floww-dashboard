/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import appCss from '../styles/app.css?url'
import { NotificationContainer } from '@/components/NotificationToast'
import { Sidebar } from '@/components/Sidebar'
import { getCurrentUser } from '@/lib/server/auth'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
    beforeLoad: async () => {
    // Check authentication server-side before loading any route
    const user = await getCurrentUser()

    if (!user) {
      // Redirect to backend login page if not authenticated
      const nextParam = encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/`)
      throw redirect({
        href: `/auth/login?next=${nextParam}`,
      })
    }

    return { user }
  },
  errorComponent: () => {
    <>Something went wrong</>
  },
  notFoundComponent: () => {
    <>Not found</>
  }
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>

      <body>
        <div className="min-h-screen">
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <div className="p-8">
                <Outlet />
              </div>
            </main>
          </div>

          <NotificationContainer />
          <TanStackRouterDevtools />
        </div>
        <Scripts />
      </body>
    </html>
  )
}


