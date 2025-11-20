import { z } from 'zod'

// schema
const envSchema = z.object({
  EXAMPLE_ENV_VAR: z
    .string()
    .describe('Example environment variable'),
})

// parse env
const parseEnv = () => {
  const env = {
    EXAMPLE_ENV_VAR: process.env.EXAMPLE_ENV_VAR || 'default value',
  }

  try {
    return envSchema.parse(env)
  } catch (error) {
    console.error('L Invalid environment variables:')
    console.error(error)
    throw new Error('Failed to load environment variables. Please check your .env file.')
  }
}

export const settings = parseEnv()
export type Settings = z.infer<typeof envSchema>
