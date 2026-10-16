import { saveJobs } from "@/lib/job-writes";
export async function POST(request: Request) { return saveJobs(request); }
