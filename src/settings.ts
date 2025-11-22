import { z } from "zod";

// schema
const envSchema = z.object({
  BACKEND_URL: z.string().describe("Backend API URL for server-side requests"),
});

// parse env
const parseEnv = () => {
  const env = {
    BACKEND_URL: process.env.BACKEND_URL || "http://localhost:8000",
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
