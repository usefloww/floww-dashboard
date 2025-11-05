import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'
import { createServer } from 'node:http'

const serverEntry: ServerEntry = {
  fetch(request) {
    return handler.fetch(request)
  },
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

