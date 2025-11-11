import { readFile } from "node:fs/promises";
import { join, dirname, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { IncomingMessage, ServerResponse } from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distRoot = join(__dirname, "..");
const clientRoot = join(distRoot, "client");

export async function convertToFetchRequest(
  req: IncomingMessage
): Promise<Request> {
  const url = `http://${req.headers.host}${req.url}`;
  const chunks: Uint8Array[] = [];
  if (req.method !== "GET" && req.method !== "HEAD") {
    for await (const chunk of req) chunks.push(chunk);
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  return new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body,
  });
}

export async function transparentProxy(req: IncomingMessage, res: ServerResponse, targetBase: string) {
  try {
    const targetUrl = new URL(req.url || "/", targetBase);
    const chunks = [];
    if (req.method !== "GET" && req.method !== "HEAD") {
      for await (const chunk of req) chunks.push(chunk);
    }
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body,
      redirect: "manual",
    });

    // set headers BEFORE writing any body data
    res.statusCode = backendResponse.status;
    res.statusMessage = backendResponse.statusText;
    for (const [key, value] of backendResponse.headers) {
      res.setHeader(key, value);
    }

    // stream safely
    if (backendResponse.body) {
      const reader = backendResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("transparent proxy failed", err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("bad gateway");
    } else res.end();
  }
}

export async function serveStaticFile(
  filePath: string,
  res: any
): Promise<boolean> {
  try {
    // Prevent path traversal attacks - normalize and resolve to absolute path
    const normalizedPath = normalize(filePath).replace(/^\/+/, "");
    const fullPath = resolve(clientRoot, normalizedPath);

    // Ensure the resolved path is within clientRoot
    const resolvedClientRoot = resolve(clientRoot);
    if (!fullPath.startsWith(resolvedClientRoot)) {
      return false;
    }

    const file = await readFile(fullPath);

    // Set appropriate content type
    const ext = filePath.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
    };

    const contentType = contentTypes[ext || ""] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.statusCode = 200;
    res.end(file);
    return true;
  } catch (error) {
    return false;
  }
}
