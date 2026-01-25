/**
 * Runtimes Package
 *
 * Factory for creating runtime instances based on configuration.
 */

import { LambdaClient } from '@aws-sdk/client-lambda';
import type { Runtime } from './runtime-types';
import { DockerRuntime, type DockerRuntimeConfig } from './implementations/docker-runtime';
import { LambdaRuntime, type LambdaRuntimeConfig } from './implementations/lambda-runtime';
import { settings } from '~/server/settings';

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
  const runtimeType = config.runtimeType ?? settings.runtime.RUNTIME_TYPE;

  switch (runtimeType) {
    case 'docker': {
      const dockerConfig: DockerRuntimeConfig = {
        repositoryName: config.repositoryName ?? settings.runtime.DOCKER_REPOSITORY_NAME,
        registryUrl: config.registryUrl ?? settings.runtime.DOCKER_REGISTRY_URL,
      };
      return new DockerRuntime(dockerConfig);
    }

    case 'lambda': {
      const lambdaClient = config.lambdaClient ?? new LambdaClient({
        region: config.awsRegion ?? settings.runtime.AWS_REGION,
      });

      const lambdaConfig: LambdaRuntimeConfig = {
        lambdaClient,
        executionRoleArn: config.executionRoleArn ?? (settings.runtime.LAMBDA_EXECUTION_ROLE_ARN ?? getEnvOrThrow('LAMBDA_EXECUTION_ROLE_ARN')),
        registryUrl: config.registryUrl ?? (settings.runtime.ECR_REGISTRY_URL ?? getEnvOrThrow('ECR_REGISTRY_URL')),
        repositoryName: config.repositoryName ?? settings.runtime.ECR_REPOSITORY_NAME,
        backendUrl: config.backendUrl ?? settings.general.BACKEND_URL,
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
