import { defineNitroConfig } from "nitro/config";

// Modules that need to be externalized (resolved at runtime from node_modules)
const externalModules = [
  // Docker chain - native .node binaries
  "ssh2",
  "cpu-features", 
  "dockerode",
  "docker-modem",
  // macOS file system events - native
  "fsevents",
  // pg - used by graphile-worker, causes malformed imports when bundled
  "pg",
  "graphile-worker",
  // AdminJS - uses @babel/core at runtime, CommonJS patterns break when bundled
  "adminjs",
];

export default defineNitroConfig({
  // Tells Nitro to optimize for Bun's APIs and entry point
  preset: "bun",

  rollupConfig: {
    // Externalize modules so they're loaded from node_modules at runtime
    external: externalModules,
    onwarn(warning, warn) {
      if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
      warn(warning);
    },
  },
});