import type { Candidate, Interview } from "../types";
import { includesTerm } from "./filterUtils";
import { normalizeScore } from "./scoreUtils";

export type ReportGroupingMode = "opportunity" | "customer";
export type ReportSortMode = "latest" | "highestScore" | "mostCandidates" | "alphabetical";

export type GroupedInterviewRow = {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateRole: string;
  interview: Interview;
  sortDate: string;
};

export type GroupedReportBucket = {
  id: string;
  label: string;
  totalCandidates: number;
  totalInterviews: number;
  completedInterviews: number;
  pendingInterviews: number;
  averageScore: number;
  latestDate: string;
  rows: GroupedInterviewRow[];
};

export function isInterviewCompleted(interview: Interview): boolean {
  const completion = String(interview.completion_status || "").toLowerCase();
  if (completion.includes("complete") || completion.includes("done") || completion.includes("submitted")) return true;

  const reportStatus = String(interview.report_status || "").toLowerCase();
  if (reportStatus.includes("generating") || reportStatus.includes("pending") || reportStatus.includes("ready_pending")) {
    return false;
  }
  if (reportStatus.includes("ready") || reportStatus.includes("complete")) return true;

  const finalStatus = String(interview.final_status || "").toLowerCase();
  if (finalStatus.includes("completed") || finalStatus.includes("submitted")) return true;

  return Boolean(String(interview.completed_at_ist || "").trim());
}

export function interviewSortDate(interview: Interview): string {
  return String(interview.completed_at_ist || interview.scheduled_at_local || interview.date || "").trim();
}

function groupLabel(mode: ReportGroupingMode, interview: Interview): string {
  if (mode === "opportunity") {
    return String(interview.opportunityId || "").trim() || "Unassigned Opportunity";
  }
  return String(interview.customerName || "").trim() || "Unassigned Customer";
}

export function buildGroupedReports(candidates: Candidate[], mode: ReportGroupingMode): GroupedReportBucket[] {
  const map = new Map<
    string,
    {
      id: string;
      label: string;
      candidateIds: Set<string>;
      rows: GroupedInterviewRow[];
      totalScore: number;
      totalInterviews: number;
      completedInterviews: number;
      latestDate: string;
    }
  >();

  for (const candidate of candidates || []) {
    for (const interview of candidate.interviews || []) {
      const label = groupLabel(mode, interview);
      const key = label.toLowerCase();
      const row: GroupedInterviewRow = {
        candidateId: candidate.id,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        candidateRole: candidate.role,
        interview,
        sortDate: interviewSortDate(interview),
      };

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: key,
          label,
          candidateIds: new Set([candidate.id]),
          rows: [row],
          totalScore: normalizeScore(interview.score),
          totalInterviews: 1,
          completedInterviews: isInterviewCompleted(interview) ? 1 : 0,
          latestDate: row.sortDate,
        });
      } else {
        existing.candidateIds.add(candidate.id);
        existing.rows.push(row);
        existing.totalScore += normalizeScore(interview.score);
        existing.totalInterviews += 1;
        if (isInterviewCompleted(interview)) existing.completedInterviews += 1;
        if (row.sortDate > existing.latestDate) existing.latestDate = row.sortDate;
      }
    }
  }

  return Array.from(map.values()).map((entry) => {
    const avg = entry.totalInterviews ? Math.round(entry.totalScore / entry.totalInterviews) : 0;
    const completed = entry.completedInterviews;
    return {
      id: entry.id,
      label: entry.label,
      totalCandidates: entry.candidateIds.size,
      totalInterviews: entry.totalInterviews,
      completedInterviews: completed,
      pendingInterviews: Math.max(0, entry.totalInterviews - completed),
      averageScore: avg,
      latestDate: entry.latestDate,
      rows: entry.rows.sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate))),
    };
  });
}

export function filterAndSortGroupedReports(
  buckets: GroupedReportBucket[],
  searchTerm: string,
  sortMode: ReportSortMode,
): GroupedReportBucket[] {
  const term = String(searchTerm || "").trim();
  const filtered = (buckets || []).filter((bucket) => {
    if (includesTerm(bucket.label, term)) return true;
    return bucket.rows.some((row) =>
      includesTerm(
        `${row.candidateName} ${row.candidateEmail} ${row.candidateRole} ${row.interview.templateTitle || row.interview.sessionName || ""}`,
        term,
      ),
    );
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortMode === "alphabetical") return a.label.localeCompare(b.label);
    if (sortMode === "highestScore") return b.averageScore - a.averageScore || b.totalInterviews - a.totalInterviews;
    if (sortMode === "mostCandidates") return b.totalCandidates - a.totalCandidates || b.totalInterviews - a.totalInterviews;
    return String(b.latestDate || "").localeCompare(String(a.latestDate || "")) || b.totalInterviews - a.totalInterviews;
  });
  return sorted;
}
