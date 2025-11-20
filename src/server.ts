import handler, { type ServerEntry } from "@tanstack/react-start/server-entry";
import { createServer } from "node:http";
import { settings } from "./settings";
import {
  convertToFetchRequest,
  serveStaticFile,
  transparentProxy,
} from "./serverUtils";

const serverEntry: ServerEntry = {
  fetch(request) {
    return handler.fetch(request);
  },
};

// Start HTTP server when this file is executed directly
// TanStack Start builds this as server.js and it will be run directly with `node dist/server/server.js`
// Check if this is the main module by comparing import.meta.url with the executed file path
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

  const server = createServer(async (req, res) => {
    try {
      const urlPath = req.url || "/";

      // Try to serve static files first (assets, favicon, etc.)
      // Remove leading slash and check if it's a static asset
      const staticPath = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;

      // Check if it's a static asset request (assets/, favicon, vite.svg, etc.)
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
        // Skip certain headers that Node.js handles automatically
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

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export default serverEntry;
