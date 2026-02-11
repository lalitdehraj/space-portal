// In-memory job storage
// For production, consider using Redis or a database
interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress?: number; // 0-100
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, JobStatus>();

// Clean up old jobs (older than 1 hour)
const cleanupOldJobs = () => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
};

// Run cleanup every 30 minutes
setInterval(cleanupOldJobs, 30 * 60 * 1000);

export const jobStore = {
  create: (id: string): void => {
    const job = {
      id,
      status: "pending" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    jobs.set(id, job);
    console.log(`[jobStore] Created job: ${id}, total jobs: ${jobs.size}`);
  },

  update: (id: string, updates: Partial<JobStatus>): void => {
    const job = jobs.get(id);
    if (job) {
      jobs.set(id, {
        ...job,
        ...updates,
        updatedAt: Date.now(),
      });
    }
  },

  get: (id: string): JobStatus | undefined => {
    console.log(
      `[jobStore] Looking for job: "${id}" (type: ${typeof id}, length: ${
        id.length
      })`
    );
    console.log(`[jobStore] Total jobs in store: ${jobs.size}`);

    const job = jobs.get(id);
    if (!job) {
      const availableIds = Array.from(jobs.keys());
      console.log(`[jobStore] Job not found: "${id}"`);
      console.log(
        `[jobStore] Available job IDs (${availableIds.length}):`,
        availableIds
      );

      // Try to find exact match with different comparison
      for (const [storedId, storedJob] of jobs.entries()) {
        if (storedId === id) {
          console.log(
            `[jobStore] Found exact match: "${storedId}" === "${id}"`
          );
          return storedJob;
        }
        // Check if they're the same when trimmed
        if (storedId.trim() === id.trim()) {
          console.log(
            `[jobStore] Found match after trim: "${storedId}" === "${id}"`
          );
          return storedJob;
        }
      }
    } else {
      console.log(`[jobStore] Job found: "${id}", status: ${job.status}`);
    }
    return job;
  },

  delete: (id: string): boolean => {
    return jobs.delete(id);
  },

  getAll: (): JobStatus[] => {
    return Array.from(jobs.values());
  },

  cancel: (id: string): boolean => {
    const job = jobs.get(id);
    if (job) {
      // Only allow cancellation if job is pending or processing
      if (job.status === "pending" || job.status === "processing") {
        jobs.set(id, {
          ...job,
          status: "cancelled",
          updatedAt: Date.now(),
        });
        console.log(`[jobStore] Job cancelled: ${id}`);
        return true;
      }
      console.log(
        `[jobStore] Cannot cancel job ${id} with status: ${job.status}`
      );
      return false;
    }
    console.log(`[jobStore] Job not found for cancellation: ${id}`);
    return false;
  },

  isCancelled: (id: string): boolean => {
    const job = jobs.get(id);
    return job?.status === "cancelled";
  },
};
