import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables from .env.local first, then .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config({ path: path.join(rootDir, '.env') });

import handler, { type ServerEntry } from "@tanstack/react-start/server-entry";
import { createServer } from "node:http";
import {
  convertToFetchRequest,
  serveStaticFile,
} from "./serverUtils";
import { handleApiRequest } from "~/server/api";
import { startWorker, stopWorker, isWorkerRunning, initWorkerUtils } from "~/server/jobs/worker";

// Auth handlers (lazy loaded to avoid SSR issues)
async function handleAuthLogin(request: Request): Promise<Response> {
  const { getAuthorizationUrl } = await import("~/server/auth/workos");
  const { signState, isSafeRedirectUrl } = await import("~/server/utils/session");
  const crypto = await import("crypto");

  const url = new URL(request.url);
  const nextUrl = url.searchParams.get("next") || "/";
  const prompt = url.searchParams.get("prompt") || undefined;

  const authType = process.env.AUTH_TYPE || "workos";

  // If auth is disabled, redirect directly
  if (authType === "none") {
    return Response.redirect(new URL(nextUrl, request.url), 302);
  }

  // For password auth, we'd show a login form - not yet implemented
  if (authType === "password") {
    return new Response("Password authentication not yet implemented", { status: 501 });
  }

  // WorkOS OAuth flow
  const host = request.headers.get("host") || "localhost:5173";
  const isLocalhost = host.includes("localhost");
  const scheme = isLocalhost ? "http" : "https";
  const redirectUri = `${scheme}://${host}/auth/callback`;

  // Generate CSRF token and sign state
  const csrf = crypto.randomBytes(32).toString("base64url");
  const safeNextUrl = isSafeRedirectUrl(nextUrl, host) ? nextUrl : "/";
  const state = signState({ csrf, next: safeNextUrl });

  // Get WorkOS authorization URL
  const authUrl = getAuthorizationUrl(redirectUri, state, prompt);

  return Response.redirect(authUrl, 302);
}

async function handleAuthCallback(request: Request): Promise<Response> {
  const { parseState, createSessionCookie, isSafeRedirectUrl } = await import(
    "~/server/utils/session"
  );
  const { exchangeCodeForToken } = await import("~/server/auth/workos");
  const { getOrCreateUser } = await import("~/server/services/user");

  const url = new URL(request.url);
  const host = request.headers.get("host") || "localhost:5173";

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const authType = process.env.AUTH_TYPE || "workos";

  // If auth is disabled, redirect to home
  if (authType === "none") {
    return Response.redirect(new URL("/", request.url), 302);
  }

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error);
    return Response.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error)}`, request.url),
      302
    );
  }

  if (!code || !state) {
    return Response.redirect(
      new URL("/auth/login?error=missing_code_or_state", request.url),
      302
    );
  }

  // Validate state
  const stateData = parseState(state);
  if (!stateData) {
    return Response.redirect(
      new URL("/auth/login?error=invalid_state", request.url),
      302
    );
  }

  const nextUrl = isSafeRedirectUrl(stateData.next, host) ? stateData.next : "/";

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(code);

    // Get or create user
    await getOrCreateUser({
      workosUserId: tokenResponse.user.id,
      email: tokenResponse.user.email,
      firstName: tokenResponse.user.firstName,
      lastName: tokenResponse.user.lastName,
    });

    // Create session cookie
    const sessionCookie = createSessionCookie(tokenResponse.accessToken);

    // Build cookie string
    const isSecure = !host.includes("localhost");
    const cookieValue = `session=${sessionCookie}; Max-Age=${30 * 24 * 3600}; Path=/; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`;

    // Create redirect response with cookie
    const redirectUrl = new URL(nextUrl, request.url);
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
        "Set-Cookie": cookieValue,
      },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return Response.redirect(
      new URL("/auth/login?error=authentication_failed", request.url),
      302
    );
  }
}

async function handleAuthLogout(request: Request): Promise<Response> {
  const { getJwtFromSessionCookie } = await import("~/server/utils/session");
  const { revokeSession } = await import("~/server/auth/workos");

  const authType = process.env.AUTH_TYPE || "workos";

  // Try to revoke the session
  const cookies = request.headers.get("cookie");
  if (cookies && authType !== "none") {
    const sessionCookie = cookies
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("session="));

    if (sessionCookie) {
      try {
        const cookieValue = sessionCookie.split("=")[1];
        const jwt = getJwtFromSessionCookie(cookieValue);

        if (jwt) {
          await revokeSession(jwt);
        }
      } catch (error) {
        console.error("Session revocation error:", error);
      }
    }
  }

  // Determine redirect URL
  const redirectUrl = authType === "none" ? "/" : "/auth/login?prompt=select_account";

  // Clear the session cookie
  const cookieValue = "session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax";

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(redirectUrl, request.url).toString(),
      "Set-Cookie": cookieValue,
    },
  });
}

const serverEntry: ServerEntry = {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle auth endpoints directly (bypass TanStack Router)
    if (url.pathname === "/auth/login") {
      return handleAuthLogin(request);
    }
    if (url.pathname === "/auth/callback") {
      return handleAuthCallback(request);
    }
    if (url.pathname === "/auth/logout") {
      return handleAuthLogout(request);
    }

    // Handle API routes
    if (url.pathname.startsWith("/api/")) {
      const apiResponse = await handleApiRequest(request);
      if (apiResponse) {
        return apiResponse;
      }
    }

    // Handle admin panel routes (if enabled)
    if (url.pathname.startsWith("/admin") && process.env.ENABLE_ADMIN === "true") {
      try {
        const { createAdminRouter } = await import("~/server/admin");
        const adminRouter = await createAdminRouter({
          rootPath: "/admin",
          credentials: process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD ? {
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
          } : undefined,
        });
        return adminRouter.fetch(request);
      } catch (error) {
        console.error('Admin panel error:', error);
        return new Response(`Admin Error: ${error}`, { status: 500 });
      }
    }

    return handler.fetch(request);
  },
};

// Start HTTP server when this file is executed directly
const isMainModule = (() => {
  try {
    const mainModulePath = process.argv[1]?.replace(/\\/g, "/");
    const currentModulePath = import.meta.url.replace(/^file:\/\//, "");
    return (
      mainModulePath === currentModulePath ||
      mainModulePath?.endsWith("server.js")
    );
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || "0.0.0.0";
  const ENABLE_WORKER = process.env.ENABLE_WORKER === "true";
  const WORKER_ONLY = process.env.WORKER_ONLY === "true";

  // If running as worker-only mode, just start the worker
  if (WORKER_ONLY) {
    (async () => {
      console.log("Starting in worker-only mode...");
      try {
        await startWorker();
        console.log("Background worker started successfully");
      } catch (error) {
        console.error("Failed to start worker:", error);
        process.exit(1);
      }
    })();
  } else {
    // Initialize worker utils so jobs can be scheduled even if worker is separate
    initWorkerUtils().catch((err: unknown) => {
      console.warn("Failed to initialize worker utils:", err);
    });

    // Optionally start worker in same process
    if (ENABLE_WORKER) {
      startWorker().catch((err: unknown) => {
        console.error("Failed to start embedded worker:", err);
      });
    }

  const server = createServer(async (req, res) => {
    try {
      const urlPath = req.url || "/";
      const pathname = urlPath.split("?")[0].split("#")[0];

      // Handle health check endpoint directly
      if (pathname === "/health") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      // Try to serve static files first
      const staticPath = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;

      if (
        staticPath.startsWith("assets/") ||
        staticPath === "favicon.ico" ||
        staticPath === "vite.svg"
      ) {
        const served = await serveStaticFile(staticPath, res);
        if (served) {
          return;
        }
      }

      // Convert Node.js request to Fetch API Request
      const request = await convertToFetchRequest(req);
      const response = await serverEntry.fetch(request);

      // Convert Fetch API Response to Node.js response
      res.statusCode = response.status;
      res.statusMessage = response.statusText;

      // Copy headers
      response.headers.forEach((value, key) => {
        if (
          key.toLowerCase() !== "connection" &&
          key.toLowerCase() !== "transfer-encoding"
        ) {
          res.setHeader(key, value);
        }
      });

      // Stream the response body
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (error) {
            console.error("Error streaming response:", error);
            if (!res.headersSent) {
              res.statusCode = 500;
            }
            res.end();
          }
        };
        pump();
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Server error:", error);
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      res.end("Internal Server Error");
    }
  });

  server.listen(Number(PORT), HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // Stop worker if running
    if (isWorkerRunning()) {
      console.log("Stopping background worker...");
      await stopWorker();
    }

    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } // Close the else block for WORKER_ONLY check
}

export default serverEntry;
