import { randomUUID } from "node:crypto";

export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type JobSnapshot<TResult = unknown> = {
  id: string;
  key: string | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: TResult | null;
  error: string | null;
};

type QueueJob<TResult> = {
  id: string;
  key: string | null;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  result: TResult | null;
  error: string | null;
  timeoutMs: number;
  run: () => Promise<TResult>;
};

export type EnqueueJobInput<TResult> = {
  key?: string | null;
  timeoutMs?: number;
  run: () => Promise<TResult>;
};

export type SimpleJobQueueOptions = {
  name: string;
  concurrency?: number;
  defaultTimeoutMs?: number;
  maxCompletedJobs?: number;
};

const defaultTimeoutMs = 60_000;
const defaultMaxCompletedJobs = 200;

export class SimpleJobQueue {
  readonly name: string;
  readonly concurrency: number;
  readonly defaultTimeoutMs: number;
  readonly maxCompletedJobs: number;

  private readonly jobs = new Map<string, QueueJob<unknown>>();
  private readonly pending: QueueJob<unknown>[] = [];
  private runningCount = 0;

  constructor(options: SimpleJobQueueOptions) {
    this.name = options.name;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? defaultTimeoutMs;
    this.maxCompletedJobs = options.maxCompletedJobs ?? defaultMaxCompletedJobs;
  }

  enqueue<TResult>(input: EnqueueJobInput<TResult>): JobSnapshot<TResult> {
    const key = input.key ?? null;
    const activeJob = key ? this.findActiveByKey<TResult>(key) : null;

    if (activeJob) {
      return activeJob;
    }

    const now = new Date();
    const job: QueueJob<TResult> = {
      id: randomUUID(),
      key,
      status: "QUEUED",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      timeoutMs: input.timeoutMs ?? this.defaultTimeoutMs,
      run: input.run
    };

    this.jobs.set(job.id, job as QueueJob<unknown>);
    this.pending.push(job as QueueJob<unknown>);
    this.pump();

    return toSnapshot(job);
  }

  get<TResult = unknown>(id: string): JobSnapshot<TResult> | null {
    const job = this.jobs.get(id);
    return job ? toSnapshot(job as QueueJob<TResult>) : null;
  }

  findActiveByKey<TResult = unknown>(key: string): JobSnapshot<TResult> | null {
    const job = Array.from(this.jobs.values()).find(
      (item) => item.key === key && (item.status === "QUEUED" || item.status === "RUNNING")
    );

    return job ? toSnapshot(job as QueueJob<TResult>) : null;
  }

  private pump() {
    while (this.runningCount < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) {
        return;
      }

      this.runJob(job);
    }
  }

  private runJob(job: QueueJob<unknown>) {
    this.runningCount += 1;
    job.status = "RUNNING";
    job.startedAt = new Date();
    job.updatedAt = job.startedAt;

    void this.execute(job).finally(() => {
      this.runningCount = Math.max(0, this.runningCount - 1);
      this.cleanupCompletedJobs();
      this.pump();
    });
  }

  private async execute(job: QueueJob<unknown>) {
    try {
      job.result = await withTimeout(job.run(), job.timeoutMs);
      job.status = "COMPLETED";
      job.error = null;
    } catch (error) {
      job.status = "FAILED";
      job.result = null;
      job.error = error instanceof Error ? error.message.slice(0, 500) : "Job çalıştırılamadı.";
    } finally {
      job.finishedAt = new Date();
      job.updatedAt = job.finishedAt;
    }
  }

  private cleanupCompletedJobs() {
    const completed = Array.from(this.jobs.values())
      .filter((job) => job.status === "COMPLETED" || job.status === "FAILED")
      .sort((first, second) => first.updatedAt.getTime() - second.updatedAt.getTime());
    const removableCount = Math.max(0, completed.length - this.maxCompletedJobs);

    for (const job of completed.slice(0, removableCount)) {
      this.jobs.delete(job.id);
    }
  }
}

export function createSimpleJobQueue(options: SimpleJobQueueOptions) {
  return new SimpleJobQueue(options);
}

function toSnapshot<TResult>(job: QueueJob<TResult>): JobSnapshot<TResult> {
  return {
    id: job.id,
    key: job.key,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    result: job.result,
    error: job.error
  };
}

async function withTimeout<TResult>(promise: Promise<TResult>, timeoutMs: number): Promise<TResult> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("Job zaman aşımına uğradı.")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    promise.catch(() => undefined);
  }
}
