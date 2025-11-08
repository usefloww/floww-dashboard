import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { User } from '@/types/api'

// Get the backend API URL from environment variable, fallback to localhost for dev
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000'

if (!BACKEND_API_URL) {
  throw new Error('BACKEND_API_URL is not set')
}

/**
 * Server function to check authentication by calling the backend whoami endpoint
 * This runs on the server and forwards cookies from the browser request
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    // Get the request to access headers/cookies
    const request = getRequest()
    const cookies = request.headers.get('cookie')

    // Call the backend API to check authentication
    const response = await fetch(`${BACKEND_API_URL}/api/whoami`, {
      headers: {
        'Content-Type': 'application/json',
        ...(cookies ? { 'Cookie': cookies } : {}),
      },
    })
    if (!response.ok) {
      return null
    }

    const userData = await response.json() as User
    return userData
  } catch (error) {
    console.error('Server auth check failed:', error)
    return null
  }
})

/**
 * Server function to handle logout
 * Calls the backend logout endpoint and returns success status
 */
export const logoutUser = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    const request = getRequest()
    const cookies = request.headers.get('cookie')

    const response = await fetch(`${BACKEND_API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies ? { 'Cookie': cookies } : {}),
      },
    })

    return { success: response.ok }
  } catch (error) {
    console.error('Server logout failed:', error)
    return { success: false }
  }
})
