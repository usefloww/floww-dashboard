import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { User } from '@/types/api'
import { settings } from '@/settings'
import { cachePerRequest } from './requestCache'

/**
 * Server function to check authentication by calling the backend whoami endpoint
 * This runs on the server and forwards cookies from the browser request
 *
 * Optimizations:
 * - Checks for session cookie before making backend request
 * - Deduplicates multiple calls within the same request/page load
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  return cachePerRequest('getCurrentUser', async () => {
    try {
      // Get the request to access headers/cookies
      const request = getRequest()
      const cookies = request.headers.get('cookie')

      // Early return if no cookies at all
      if (!cookies) {
        return null
      }

      // Check specifically for the session cookie
      const hasSessionCookie = cookies.split(';').some(cookie =>
        cookie.trim().startsWith('session=')
      )

      if (!hasSessionCookie) {
        return null
      }

      // Call the backend API to check authentication
      const response = await fetch(`${settings.BACKEND_URL}/api/whoami`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies,
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
})

/**
 * Server function to handle logout
 * Calls the backend logout endpoint and returns success status
 */
export const logoutUser = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    const request = getRequest()
    const cookies = request.headers.get('cookie')

    const response = await fetch(`${settings.BACKEND_URL}/auth/logout`, {
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
