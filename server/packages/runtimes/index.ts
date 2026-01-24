/**
 * Runtimes Package
 *
 * Factory for creating runtime instances based on configuration.
 */

import { LambdaClient } from '@aws-sdk/client-lambda';
import type { Runtime } from './runtime-types';
import { DockerRuntime, type DockerRuntimeConfig } from './implementations/docker-runtime';
import { LambdaRuntime, type LambdaRuntimeConfig } from './implementations/lambda-runtime';

export * from './runtime-types';
export { DockerRuntime, type DockerRuntimeConfig } from './implementations/docker-runtime';
export { LambdaRuntime, type LambdaRuntimeConfig } from './implementations/lambda-runtime';

// Re-export utility functions for direct access if needed
export * as dockerUtils from './utils/docker';
export * as lambdaUtils from './utils/aws-lambda';

export type RuntimeType = 'docker' | 'lambda' | 'kubernetes';

export interface RuntimeFactoryConfig {
  runtimeType?: RuntimeType;
  // Docker-specific
  repositoryName?: string;
  registryUrl?: string;
  // Lambda-specific
  lambdaClient?: LambdaClient;
  executionRoleArn?: string;
  backendUrl?: string;
  awsRegion?: string;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Create a runtime instance with the given configuration
 */
export function createRuntime(config: RuntimeFactoryConfig = {}): Runtime {
  const runtimeType = config.runtimeType ?? (process.env.RUNTIME_TYPE as RuntimeType) ?? 'docker';

  switch (runtimeType) {
    case 'docker': {
      const dockerConfig: DockerRuntimeConfig = {
        repositoryName: config.repositoryName ?? process.env.DOCKER_REPOSITORY_NAME ?? 'docker-runtime',
        registryUrl: config.registryUrl ?? process.env.DOCKER_REGISTRY_URL ?? 'localhost:5000',
      };
      return new DockerRuntime(dockerConfig);
    }

    case 'lambda': {
      const lambdaClient = config.lambdaClient ?? new LambdaClient({
        region: config.awsRegion ?? process.env.AWS_REGION ?? 'us-east-1',
      });

      const lambdaConfig: LambdaRuntimeConfig = {
        lambdaClient,
        executionRoleArn: config.executionRoleArn ?? getEnvOrThrow('LAMBDA_EXECUTION_ROLE_ARN'),
        registryUrl: config.registryUrl ?? getEnvOrThrow('ECR_REGISTRY_URL'),
        repositoryName: config.repositoryName ?? process.env.ECR_REPOSITORY_NAME ?? 'floww-runtime',
        backendUrl: config.backendUrl ?? getEnvOrThrow('BACKEND_URL'),
      };
      return new LambdaRuntime(lambdaConfig);
    }

    case 'kubernetes':
      throw new Error('Kubernetes runtime not yet implemented');

    default:
      throw new Error(`Unknown runtime type: ${runtimeType}`);
  }
}

// Singleton instance
let runtimeInstance: Runtime | null = null;

/**
 * Get the runtime singleton (lazily initialized)
 */
export function getRuntime(): Runtime {
  if (!runtimeInstance) {
    runtimeInstance = createRuntime();
  }
  return runtimeInstance;
}

/**
 * Reset the runtime singleton (useful for testing)
 */
export function resetRuntime(): void {
  runtimeInstance = null;
}
