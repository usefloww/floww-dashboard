import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname, resolve, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// In production, server.js is in dist/server/, so we go up one level to get to dist/
const distRoot = join(__dirname, '..')
const clientRoot = join(distRoot, 'client')

const serverEntry: ServerEntry = {
  fetch(request) {
    return handler.fetch(request)
  },
}

async function serveStaticFile(filePath: string, res: any): Promise<boolean> {
  try {
    // Prevent path traversal attacks - normalize and resolve to absolute path
    const normalizedPath = normalize(filePath).replace(/^\/+/, '')
    const fullPath = resolve(clientRoot, normalizedPath)
    
    // Ensure the resolved path is within clientRoot
    const resolvedClientRoot = resolve(clientRoot)
    if (!fullPath.startsWith(resolvedClientRoot)) {
      return false
    }
    
    const file = await readFile(fullPath)
    
    // Set appropriate content type
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
    }
    
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.statusCode = 200
    res.end(file)
    return true
  } catch (error) {
    return false
  }
}

// Start HTTP server when this file is executed directly
// TanStack Start builds this as server.js and it will be run directly with `node dist/server/server.js`
// Check if this is the main module by comparing import.meta.url with the executed file path
const isMainModule = (() => {
  try {
    const mainModulePath = process.argv[1]?.replace(/\\/g, '/')
    const currentModulePath = import.meta.url.replace(/^file:\/\//, '')
    return mainModulePath === currentModulePath || mainModulePath?.endsWith('server.js')
  } catch {
    return false
  }
})()

if (isMainModule) {
  const PORT = process.env.PORT || 3000
  const HOST = process.env.HOST || '0.0.0.0'

  const server = createServer(async (req, res) => {
    try {
      const urlPath = req.url || '/'
      
      // Try to serve static files first (assets, favicon, etc.)
      // Remove leading slash and check if it's a static asset
      const staticPath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
      
      // Check if it's a static asset request (assets/, favicon, vite.svg, etc.)
      if (staticPath.startsWith('assets/') || staticPath === 'favicon.ico' || staticPath === 'vite.svg') {
        const served = await serveStaticFile(staticPath, res)
        if (served) {
          return
        }
      }
      
      // Convert Node.js request to Fetch API Request
      const url = `http://${req.headers.host}${req.url}`
      
      // Read request body if present
      const chunks: Uint8Array[] = []
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        for await (const chunk of req) {
          chunks.push(chunk)
        }
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined

      const request = new Request(url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: body,
      })

      // Handle the request with TanStack Start
      const response = await serverEntry.fetch(request)

      // Convert Fetch API Response to Node.js response
      res.statusCode = response.status
      res.statusMessage = response.statusText

      // Copy headers
      response.headers.forEach((value, key) => {
        // Skip certain headers that Node.js handles automatically
        if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value)
        }
      })

      // Stream the response body
      if (response.body) {
        const reader = response.body.getReader()
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(value)
            }
            res.end()
          } catch (error) {
            console.error('Error streaming response:', error)
            if (!res.headersSent) {
              res.statusCode = 500
            }
            res.end()
          }
        }
        pump()
      } else {
        res.end()
      }
    } catch (error) {
      console.error('Server error:', error)
      if (!res.headersSent) {
        res.statusCode = 500
      }
      res.end('Internal Server Error')
    }
  })

  server.listen(Number(PORT), HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`)
  })
}

export default serverEntry

