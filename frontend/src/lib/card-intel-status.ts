import type { MappedIntelJob } from "@/lib/map-credit-card";

export const INTEL_RUNNING_STEPS = [
  "Searching the issuer website…",
  "Locating the official rewards guide…",
  "Reading earn rates and credits…",
  "Extracting rules with AI…",
  "Applying rewards to your card…",
] as const;

const RUNNING_STEPS = INTEL_RUNNING_STEPS;

export type IntelProgressState = {
  stepIndex: number;
  stepCount: number;
  /** 0–1 fill within the active step (for segment bar animation only). */
  activeStepFill: number;
  label: string;
};

const STEP_MS = 3_800;

export function intelProgressState(
  job: MappedIntelJob | null | undefined,
  hasLiveExtract: boolean,
  nowMs: number = Date.now(),
): IntelProgressState {
  const stepCount = RUNNING_STEPS.length;
  const label = intelStatusLabel(job, hasLiveExtract, nowMs);

  if (!job) {
    return { stepIndex: 0, stepCount, activeStepFill: 0.15, label };
  }

  switch (job.status) {
    case "PENDING": {
      const created = new Date(job.createdAt).getTime();
      const waitElapsed = Math.max(0, nowMs - created);
      const activeStepFill = Math.min(0.85, 0.1 + (waitElapsed / 2400) * 0.75);
      return { stepIndex: 0, stepCount, activeStepFill, label };
    }
    case "RUNNING": {
      const t0 = job.startedAt
        ? new Date(job.startedAt).getTime()
        : new Date(job.createdAt).getTime();
      const elapsed = Math.max(0, nowMs - t0);
      let stepIndex = Math.min(stepCount - 1, Math.floor(elapsed / STEP_MS));
      if (hasLiveExtract) {
        stepIndex = Math.max(stepIndex, 2);
      }
      const activeStepFill = (elapsed % STEP_MS) / STEP_MS;
      return { stepIndex, stepCount, activeStepFill, label };
    }
    case "COMPLETED":
      return {
        stepIndex: stepCount - 1,
        stepCount,
        activeStepFill: 1,
        label,
      };
    case "FAILED":
    case "SKIPPED_NO_SOURCE":
      return { stepIndex: 0, stepCount, activeStepFill: 0, label };
    default:
      return { stepIndex: 1, stepCount, activeStepFill: 0.35, label };
  }
}

export function intelStatusLabel(
  job: MappedIntelJob | null | undefined,
  hasLiveExtract: boolean,
  nowMs: number = Date.now(),
): string {
  if (!job) return "Preparing analysis…";

  switch (job.status) {
    case "PENDING":
      return "Queued — starting shortly…";
    case "RUNNING": {
      const t0 = job.startedAt
        ? new Date(job.startedAt).getTime()
        : new Date(job.createdAt).getTime();
      const elapsed = Math.max(0, nowMs - t0);
      const idx = Math.min(
        RUNNING_STEPS.length - 1,
        Math.floor(elapsed / STEP_MS),
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
