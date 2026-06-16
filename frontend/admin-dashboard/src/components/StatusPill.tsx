import type { InterviewStatus } from "../types";

type StatusPillProps = {
  status: InterviewStatus | string;
  /** capsule: compact uppercase; tile: interview tables / reports */
  variant?: "capsule" | "tile";
};

export function StatusPill({ status, variant = "capsule" }: StatusPillProps) {
  const raw = String(status ?? "").trim();
  const s = raw.toLowerCase();

  let cls =
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800";
  let label = raw || "Pending Review";

  if (raw === "Rejected" || s.includes("reject")) {
    cls =
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800";
    label = "Rejected";
  } else if (raw === "Selected" || (s.includes("select") && !s.includes("deselect"))) {
    cls =
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800";
    label = "Selected";
  } else if (raw === "On Hold" || s.includes("hold")) {
    // May 2026: deferred decision — saturated amber to differentiate from
    // the neutral "Pending Review" badge.
    cls =
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700";
    label = "On Hold";
  } else if (raw === "Pending Review") {
    cls =
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800";
    label = "Pending Review";
  } else if (s.includes("generat")) {
    cls =
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800";
    label = "Generating";
  } else if (s.includes("complete")) {
    cls =
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800";
    label = "Completed";
  } else if (s.includes("review")) {
    cls =
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800";
    label = "In Review";
  }

  const shape =
    variant === "tile"
      ? "rounded-xl px-2.5 py-1 text-xs font-bold"
      : "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider";

  return <span className={`inline-flex items-center border ${cls} ${shape}`}>{label}</span>;
}
