import { z } from 'zod'

/**
 * Environment variables schema with validation
 */
const envSchema = z.object({
  BACKEND_URL: z
    .string()
    .url('BACKEND_URL must be a valid URL')
    .describe('Backend API base URL for server requests'),
})

/**
 * Parse and validate environment variables
 * Falls back to sensible defaults for development
 */
const parseEnv = () => {
  const env = {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000',
  }

  try {
    return envSchema.parse(env)
  } catch (error) {
    console.error('L Invalid environment variables:')
    console.error(error)
    throw new Error('Failed to load environment variables. Please check your .env file.')
  }
}

/**
 * Validated and type-safe application settings
 *
 * @example
 * import { settings } from '@/settings'
 *
 * fetch(`${settings.BACKEND_URL}/api/users`)
 */
export const settings = parseEnv()

/**
 * TypeScript type for settings
 */
export type Settings = z.infer<typeof envSchema>
