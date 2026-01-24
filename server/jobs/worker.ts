/**
 * Graphile Worker Setup
 *
 * Initializes and runs the background job worker.
 */

import { run, Runner, makeWorkerUtils, WorkerUtils } from 'graphile-worker';
import { taskList, cronJobs } from './index';

let workerInstance: Runner | null = null;
let workerUtils: WorkerUtils | null = null;

/**
 * Get the database connection string
 */
function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgresql://localhost:5432/floww';
}

/**
 * Initialize worker utilities for adding jobs
 */
export async function initWorkerUtils(): Promise<WorkerUtils> {
  if (!workerUtils) {
    workerUtils = await makeWorkerUtils({
      connectionString: getDatabaseUrl(),
    });
  }
  return workerUtils;
}

/**
 * Get worker utilities (must be initialized first)
 */
export function getWorkerUtils(): WorkerUtils {
  if (!workerUtils) {
    throw new Error('Worker utils not initialized. Call initWorkerUtils() first.');
  }
  return workerUtils;
}

/**
 * Start the Graphile Worker
 */
export async function startWorker(): Promise<Runner> {
  if (workerInstance) {
    console.log('Worker already running');
    return workerInstance;
  }

  console.log('Starting Graphile Worker...');

  // Initialize utils first
  await initWorkerUtils();

  // Start the worker
  workerInstance = await run({
    connectionString: getDatabaseUrl(),
    taskList,
    // Cron tasks are scheduled separately
    crontabFile: undefined, // We use programmatic crons
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
    pollInterval: 1000, // Check for jobs every second
    noHandleSignals: false, // Handle SIGINT/SIGTERM
  });

  // Set up cron jobs
  await setupCronJobs();

  console.log('Graphile Worker started');

  return workerInstance;
}

/**
 * Set up recurring cron jobs
 */
async function setupCronJobs(): Promise<void> {
  const utils = getWorkerUtils();

  // Note: Graphile Worker's cron functionality works via crontab
  // For programmatic crons, we'd schedule initial jobs and let them reschedule
  // This is a simplified approach - in production use crontab file

  for (const cronJob of cronJobs) {
    console.log(`Setting up cron job: ${cronJob.task} with pattern: ${cronJob.pattern}`);

    // Schedule first run
    await utils.addJob(cronJob.task, {}, { jobKey: `cron:${cronJob.task}` });
  }
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (workerInstance) {
    console.log('Stopping Graphile Worker...');
    await workerInstance.stop();
    workerInstance = null;
  }

  if (workerUtils) {
    await workerUtils.release();
    workerUtils = null;
  }

  console.log('Graphile Worker stopped');
}

/**
 * Add a job to the queue
 */
export async function addJob(
  taskName: keyof typeof taskList,
  payload: Record<string, unknown> = {},
  options?: {
    runAt?: Date;
    maxAttempts?: number;
    jobKey?: string;
    priority?: number;
  }
): Promise<void> {
  const utils = await initWorkerUtils();
  await utils.addJob(taskName, payload, {
    runAt: options?.runAt,
    maxAttempts: options?.maxAttempts ?? 3,
    jobKey: options?.jobKey,
    priority: options?.priority,
  });
}

/**
 * Worker health check
 */
export function isWorkerRunning(): boolean {
  return workerInstance !== null;
}
