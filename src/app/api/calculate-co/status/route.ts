import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "../jobStore";

export type JobStatusResponse = {
  success: boolean;
  status?: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress?: number;
  result?: unknown;
  error?: string;
  message?: string;
};

export async function GET(req: NextRequest) {
  try {
    // searchParams.get() already decodes URL-encoded parameters automatically
    // So we don't need to decode again - just use it directly
    const jobId = req.nextUrl.searchParams.get("jobId");
    console.log(`[GET /api/calculate-co/status] Raw jobId from query: ${jobId}`);
    console.log(`[GET /api/calculate-co/status] JobId type: ${typeof jobId}, length: ${jobId?.length}`);

    if (!jobId) {
      console.error("[GET /api/calculate-co/status] Job ID is missing");
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Use jobId directly - searchParams already decoded it
    // Also try without any encoding/decoding to ensure exact match
    const job = jobStore.get(jobId);

    if (!job) {
      // Log all available jobs for debugging
      const allJobs = jobStore.getAll();
      console.error(`[GET /api/calculate-co/status] Job not found: ${jobId}`);
      console.error(`[GET /api/calculate-co/status] JobId received: "${jobId}"`);
      console.error(`[GET /api/calculate-co/status] JobId length: ${jobId.length}`);
      console.error(`[GET /api/calculate-co/status] Total jobs in store: ${allJobs.length}`);
      console.error(`[GET /api/calculate-co/status] Available job IDs: ${allJobs.map(j => `"${j.id}"`).join(", ") || "none"}`);
      
      // Try to find a job with similar ID (in case of encoding issues)
      const similarJob = allJobs.find(j => j.id.includes(jobId) || jobId.includes(j.id));
      if (similarJob) {
        console.error(`[GET /api/calculate-co/status] Found similar job: "${similarJob.id}"`);
      }
      
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    console.log(`[GET /api/calculate-co/status] Job found: ${jobId}, status: ${job.status}, progress: ${job.progress}%`);

    const response: JobStatusResponse = {
      success: true,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Job Status API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

