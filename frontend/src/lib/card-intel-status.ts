import type { MappedIntelJob } from "@/lib/map-credit-card";

const RUNNING_STEPS = [
  "Searching the issuer website…",
  "Locating the official rewards guide…",
  "Reading earn rates and credits…",
  "Extracting rules with AI…",
  "Applying rewards to your card…",
] as const;

export function intelStatusLabel(
  job: MappedIntelJob | null | undefined,
  hasLiveExtract: boolean,
): string {
  if (!job) return "Preparing analysis…";

  switch (job.status) {
    case "PENDING":
      return "Queued — starting shortly…";
    case "RUNNING": {
      const t0 = job.startedAt
        ? new Date(job.startedAt).getTime()
        : new Date(job.createdAt).getTime();
      const elapsed = Date.now() - t0;
      const idx = Math.min(
        RUNNING_STEPS.length - 1,
        Math.floor(elapsed / 4500),
      );
      if (hasLiveExtract && idx >= 2) {
        return "Rewards found — finalizing your card…";
      }
      return RUNNING_STEPS[idx] ?? RUNNING_STEPS[0];
    }
    case "COMPLETED":
      return "Analysis complete";
    case "FAILED":
      return job.errorMessage?.slice(0, 120) ?? "Analysis failed";
    case "SKIPPED_NO_SOURCE":
      return "Could not find an official rewards document";
    default:
      return "Processing…";
  }
}

export function intelIsTerminal(job: MappedIntelJob | null | undefined): boolean {
  if (!job) return false;
  return (
    job.status === "COMPLETED" ||
    job.status === "FAILED" ||
    job.status === "SKIPPED_NO_SOURCE"
  );
}

export function intelIsActive(job: MappedIntelJob | null | undefined): boolean {
  if (!job) return true;
  return job.status === "PENDING" || job.status === "RUNNING";
}

export function intelHasFailed(job: MappedIntelJob | null | undefined): boolean {
  if (!job) return false;
  return job.status === "FAILED" || job.status === "SKIPPED_NO_SOURCE";
}
