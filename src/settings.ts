import { z } from "zod";

// schema
const envSchema = z.object({
  EXAMPLE_ENV_VAR: z.string().describe("Example environment variable"),
  PUBLIC_API_URL: z.string().describe("Public API URL"),
});

// parse env
const parseEnv = () => {
  const env = {
    EXAMPLE_ENV_VAR: process.env.EXAMPLE_ENV_VAR || "default value",
    PUBLIC_API_URL: process.env.PUBLIC_API_URL || "http://localhost:8000",
  };

  try {
    return envSchema.parse(env);
  } catch (error) {
    console.error("L Invalid environment variables:");
    console.error(error);
    throw new Error(
      "Failed to load environment variables. Please check your .env file."
    );
  }
};

export const settings = parseEnv();
export type Settings = z.infer<typeof envSchema>;
