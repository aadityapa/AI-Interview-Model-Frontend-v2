import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Candidate, Interview, InterviewStatus } from "../types";
import { deleteCandidate, getDashboardData, getSchedules, wakeBackend, type InterviewSchedule } from "../api";
import { motion, useReducedMotion } from "framer-motion";
import { listChildMotion } from "../lib/motionPresets";
import { normalizeScore, weightedCandidateScore } from "../utils/scoreUtils";

type Trend = { direction: "up" | "down" | "flat"; label: string };

function safeParseDate(value: string): number {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : 0;
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "C";
}

function latestInterview(c: Candidate): Interview | null {
  const list = c.interviews || [];
  if (!list.length) return null;
  return [...list].sort((a, b) => safeParseDate(b.date) - safeParseDate(a.date))[0] || null;
}

function TrendPill({ trend }: { trend: Trend }) {
  const cls =
    trend.direction === "up"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : trend.direction === "down"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-bold ${cls}`}>{trend.label}</span>;
}

export function DashboardStatsCard({
  title,
  value,
  icon,
  trend,
  subtext,
  loading,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  trend: Trend;
  subtext?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-500">{title}</div>
          {loading ? (
            <div className="mt-3 h-9 w-28 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
          )}
          <div className="mt-3 flex items-center gap-2">
            {loading ? <div className="h-5 w-14 rounded-lg bg-slate-100 animate-pulse" /> : <TrendPill trend={trend} />}
            {subtext ? <span className="text-xs text-slate-400">{subtext}</span> : null}
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function PipelineStageCard({
  name,
  count,
  color,
  percent,
}: {
  name: string;
  count: number;
  color: "slate" | "amber" | "indigo" | "violet" | "emerald";
  percent: number;
}) {
  const bar =
    color === "amber"
      ? "bg-amber-500"
      : color === "indigo"
        ? "bg-indigo-600"
        : color === "violet"
          ? "bg-violet-600"
          : color === "emerald"
            ? "bg-emerald-600"
            : "bg-slate-500";
  const dot =
    color === "amber"
      ? "bg-amber-500"
      : color === "indigo"
        ? "bg-indigo-600"
        : color === "violet"
          ? "bg-violet-600"
          : color === "emerald"
            ? "bg-emerald-600"
            : "bg-slate-500";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <div className="text-sm font-bold text-slate-700">{name}</div>
        </div>
        <div className="text-sm font-extrabold text-slate-900">{count}</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
        <div className={`h-full ${bar}`} style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
      </div>
      <div className="mt-2 text-xs text-slate-400">{percent}% of pipeline</div>
    </div>
  );
}

// May 2026: extended the pipeline pill with a fifth "On Hold" state so the
// recruiter sees the deferred decision directly in candidate lists.
type PipelineStatus = "Pending" | "In Review" | "Completed" | "Rejected" | "On Hold";

function PipelineStatusPill({ status }: { status: PipelineStatus }) {
  const styles =
    status === "Completed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "In Review"
        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
        : status === "Rejected"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : status === "On Hold"
            ? "bg-amber-100 text-amber-800 border-amber-300"
            : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-flex px-2.5 py-1 rounded-xl text-xs font-bold border ${styles}`}>{status}</span>;
}

function mapCandidateStatus(
  latest: Interview | null,
  hrDecision?: "shortlist" | "reject" | "on_hold" | null,
): PipelineStatus {
  if (hrDecision === "reject") return "Rejected";
  if (hrDecision === "shortlist") return "Completed";
  // May 2026 — "on_hold" beats interview-level status, so HR sees the
  // explicit decision instead of the model's default "In Review".
  if (hrDecision === "on_hold") return "On Hold";
  if (!latest) return "Pending";
  const s = String(latest.status || "").toLowerCase();
  if (s.includes("rejected")) return "Rejected";
  if (s.includes("selected")) return "Completed";
  if (s.includes("hold")) return "On Hold";
  if (s.includes("pending")) return "In Review";
  return "In Review";
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtDateLabel(date: string) {
  if (!date) return "—";
  const t = safeParseDate(date);
  if (!t) return date;
  const d = new Date(t);
  const dd = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT[d.getMonth()] || "";
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  return `${dd} ${month} ${yyyy}, ${hh}:${minutes} ${meridiem}`;
}

const RECENT_CANDIDATES_PAGE_SIZE = 10;

function DeleteCandidateModal({
  open,
  candidateName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  candidateName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/50" onClick={busy ? undefined : onClose} />
      <div className="absolute inset-x-0 top-24 mx-auto w-[min(480px,calc(100%-2rem))]">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-slate-900">Delete candidate permanently?</div>
                <div className="mt-2 text-sm text-slate-600">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-bold text-slate-900">{candidateName || "this candidate"}</span>{" "}
                  and all interview records?
                </div>
                <ul className="mt-3 text-xs text-slate-500 space-y-1 list-disc pl-5">
                  <li>Profile, interview history, evaluations</li>
                  <li>AI analytics, ATS records, schedules</li>
                  <li>Cached data, session and login data</li>
                </ul>
                <div className="mt-3 text-xs font-semibold text-rose-600">This action cannot be undone.</div>
                {error ? <div className="mt-3 text-xs text-rose-600">{error}</div> : null}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="h-10 px-4 rounded-xl bg-rose-600 text-white font-semibold shadow-sm hover:bg-rose-700 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecentCandidatesTable({
  candidates,
  onOpenInvite,
  onViewCandidateReport,
  onRefresh,
  onViewAll,
}: {
  candidates: Candidate[];
  onOpenInvite: (candidateId: string) => void;
  onViewCandidateReport: (candidateId: string, interviewId?: string) => void;
  onRefresh: () => Promise<void> | void;
  onViewAll?: () => void;
}) {
  const [toast, setToast] = useState<string>("");
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [page, setPage] = useState(1);
  const reduceMotion = useReducedMotion();

  const rows = useMemo(() => {
    return [...(candidates || [])]
      .map((c) => {
        const latest = latestInterview(c);
        const score = latest ? normalizeScore(latest.score) : weightedCandidateScore(c.interviews || []);
        return {
          id: c.id,
          name: c.name,
          email: c.email || "",
          role: c.role,
          opportunityId: latest?.opportunityId || "",
          customerName: latest?.customerName || "",
          score,
          status: mapCandidateStatus(latest, c.hr_decision),
          date: latest?.date || "",
          scheduledAt: (latest as any)?.scheduled_at_local || "",
          completedAt: (latest as any)?.completed_at_ist || "",
          interviewId: latest?.id || "",
        };
      })
      .sort((a, b) => {
        const ta = safeParseDate(a.scheduledAt || a.completedAt || a.date);
        const tb = safeParseDate(b.scheduledAt || b.completedAt || b.date);
        return tb - ta;
      });
  }, [candidates]);

  const totalPages = Math.max(1, Math.ceil(rows.length / RECENT_CANDIDATES_PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, rows.length]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * RECENT_CANDIDATES_PAGE_SIZE;
    return rows.slice(start, start + RECENT_CANDIDATES_PAGE_SIZE);
  }, [rows, page]);

  const rangeStart = rows.length === 0 ? 0 : (page - 1) * RECENT_CANDIDATES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * RECENT_CANDIDATES_PAGE_SIZE, rows.length);

  const requestDelete = (id: string, name: string) => {
    setDeleteError("");
    setConfirmTarget({ id, name });
  };

  const cancelDelete = () => {
    if (deleteBusy) return;
    setConfirmTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteCandidate(confirmTarget.id);
      setConfirmTarget(null);
      setToast("Candidate deleted.");
      window.setTimeout(() => setToast(""), 1600);
      try {
        await onRefresh();
      } catch (_) {
        // refresh errors are non-fatal; user still got deletion confirmation
      }
    } catch (e: any) {
      setDeleteError(String(e?.message || e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <DeleteCandidateModal
        open={!!confirmTarget}
        candidateName={confirmTarget?.name || ""}
        busy={deleteBusy}
        error={deleteError}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
      />
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold tracking-tight">Recent candidates</div>
          <div className="text-xs text-slate-500 mt-0.5">Latest interview activity and outcomes</div>
        </div>
        <button onClick={onViewAll} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition inline-flex items-center gap-1">
          View all <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-bold uppercase tracking-widest text-slate-500">
              <th className="px-5 py-3">Candidate</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Opportunity ID</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">AI Score</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Interview Date</th>
              <th className="px-5 py-3 text-right w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td className="px-5 py-12" colSpan={8}>
                  <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900">No candidates yet</div>
                      <div className="mt-1 text-sm text-slate-500">
                        Schedule an interview from HR Setup and this table will auto-populate from the database.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenInvite("")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition"
                    >
                      <ClipboardList className="w-4 h-4" />
                      Invite candidate
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <motion.tr
                  key={r.id}
                  className="group k-hover-row border-b border-slate-100 hover:bg-slate-50/60 transition-colors align-middle"
                  {...listChildMotion(!!reduceMotion, i)}
                >
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-extrabold text-slate-700 dark:text-slate-100 shrink-0">
                        {initials(r.name)}
                      </div>
                      <div className="leading-tight min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white group-hover:dark:text-white truncate">{r.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-200 group-hover:dark:text-slate-100 truncate">
                          {r.email || r.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-100 group-hover:dark:text-white font-semibold align-middle">{r.role}</td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-100 group-hover:dark:text-white text-sm align-middle">{r.opportunityId || "—"}</td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-100 group-hover:dark:text-white text-sm align-middle">{r.customerName || "—"}</td>
                  <td className="px-5 py-4 align-middle">
                    <div className="inline-flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white group-hover:dark:text-white w-8 text-right">{r.score}</span>
                      <div className="w-24 h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600"
                          style={{ width: `${Math.max(2, Math.min(100, r.score))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <PipelineStatusPill status={r.status} />
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-200 group-hover:dark:text-slate-100 font-medium whitespace-nowrap align-middle">
                    <div className="text-slate-700 dark:text-slate-100 group-hover:dark:text-white font-semibold">
                      {fmtDateLabel(r.scheduledAt || r.completedAt || r.date)}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onViewCandidateReport(r.id, r.interviewId || undefined)}
                        className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold text-slate-700 inline-flex items-center gap-2"
                      >
                        <ArrowUpRight className="w-4 h-4" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(r.id, r.name)}
                        className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 transition flex items-center justify-center text-slate-600 hover:text-rose-700"
                        aria-label="Delete candidate"
                        title="Delete candidate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 ? (
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              {rangeStart}–{rangeEnd}
            </span>
            <span className="text-slate-500"> of {rows.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500 tabular-nums px-2">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5 transition"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <div className="px-5 pb-4 text-xs text-slate-500">{toast}</div> : null}
    </div>
  );
}

export function UpcomingInterviewCard({ schedules, onViewAll }: { schedules: InterviewSchedule[]; onViewAll?: () => void }) {
  const reduceMotion = useReducedMotion();
  const items = useMemo(() => {
    const now = Date.now();
    const next48 = now + 48 * 60 * 60 * 1000;
    return (schedules || [])
      .map((s) => ({
        id: s.id,
        name: s.candidate_name || "Candidate",
        role: s.role || s.job_title || s.template_name || "Interview",
        opportunityId: s.opportunityId || "",
        customerName: s.customerName || "",
        when: s.scheduled_at_local || "",
        status: String(s.status || "scheduled"),
        ts: safeParseDate(s.scheduled_at_local || ""),
      }))
      .filter((x) => x.ts && x.ts >= now && x.ts <= next48)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 8);
  }, [schedules]);

  const dot = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("scheduled")) return "bg-emerald-500";
    if (s.includes("resched")) return "bg-amber-500";
    if (s.includes("cancel")) return "bg-rose-500";
    return "bg-slate-400";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold tracking-tight">Upcoming interviews</div>
          <div className="text-xs text-slate-500 mt-0.5">Next 48 hours</div>
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      <div className="p-4 space-y-3">
        {!items.length ? (
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/40">
            <div className="font-extrabold text-slate-900 text-sm">No upcoming interviews</div>
            <div className="mt-1 text-sm text-slate-500">Once an interview is scheduled in HR Setup, it will appear here automatically.</div>
          </div>
        ) : (
          items.map((it, i) => (
          <motion.div
            key={it.id || `${it.name}-${it.when}`}
            className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors flex items-center gap-3"
            {...listChildMotion(!!reduceMotion, i)}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-extrabold text-slate-600">
              {initials(it.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-900 truncate">{it.name}</div>
                <div className="text-xs text-slate-500 whitespace-nowrap">{fmtDateLabel(it.when)}</div>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 truncate">{it.role}</div>
                  {(it.opportunityId || it.customerName) ? (
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {[it.opportunityId ? `Opp: ${it.opportunityId}` : "", it.customerName ? it.customerName : ""]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${dot(it.status)}`} />
                  <span className="font-semibold">{it.status}</span>
                </div>
              </div>
            </div>
          </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function isCompletedStatus(s: InterviewStatus) {
  const t = String(s || "").toLowerCase();
  return t.includes("selected") || t.includes("rejected");
}

export function AIInsightsCard({ candidates }: { candidates: Candidate[] }) {
  const insights = useMemo(() => {
    const list = candidates || [];
    const completedInterviews = list.flatMap((c) => (c.interviews || []).filter((i) => isCompletedStatus(i.status)));
    const allInterviews = list.flatMap((c) => c.interviews || []);
    const completionRate = allInterviews.length ? Math.round((completedInterviews.length / allInterviews.length) * 100) : 0;
    const recommended = list.filter(
      (c) =>
        weightedCandidateScore(c.interviews || []) >= 80 && mapCandidateStatus(latestInterview(c), c.hr_decision) !== "Rejected",
    ).length;

    const byRole = new Map<string, { sum: number; n: number }>();
    for (const c of list) {
      const score = weightedCandidateScore(c.interviews || []);
      const role = String(c.role || "Candidate").trim() || "Candidate";
      const cur = byRole.get(role) || { sum: 0, n: 0 };
      byRole.set(role, { sum: cur.sum + score, n: cur.n + 1 });
    }
    let topRole = "";
    let topRoleScore = 0;
    for (const [role, v] of byRole.entries()) {
      const avg = v.n ? Math.round(v.sum / v.n) : 0;
      if (avg >= topRoleScore) {
        topRoleScore = avg;
        topRole = role;
      }
    }

    const avgScore = allInterviews.length
      ? Math.round(allInterviews.map((i) => normalizeScore(i.score)).reduce((a, b) => a + b, 0) / allInterviews.length)
      : 0;
    const responseQuality = avgScore ? `${(avgScore / 20).toFixed(1)}/5` : "—";

    return {
      topRole: { label: "Top performing role", value: topRole || "—", score: topRoleScore },
      completion: { label: "Interview completion rate", value: `${completionRate}%`, pct: completionRate },
      recommended: { label: "Recommended candidates", value: String(recommended), pct: Math.min(100, Math.round((recommended / Math.max(1, list.length)) * 100)) },
      response: { label: "Avg response quality", value: responseQuality, pct: avgScore },
    };
  }, [candidates]);

  const Bar = ({ pct, tone }: { pct: number; tone: "indigo" | "emerald" | "violet" | "amber" }) => {
    const c =
      tone === "emerald"
        ? "bg-emerald-600"
        : tone === "violet"
          ? "bg-violet-600"
          : tone === "amber"
            ? "bg-amber-500"
            : "bg-indigo-600";
    return (
      <div className="mt-2 h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
        <div className={`h-full ${c}`} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-extrabold tracking-tight">AI hiring insights</div>
          <div className="text-xs text-slate-500 mt-0.5">Signal quality, completion, and recommendations</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      {!candidates?.length ? (
        <div className="mt-5 p-5 rounded-xl border border-slate-200 bg-slate-50/40">
          <div className="font-extrabold text-slate-900 text-sm">Waiting for data</div>
          <div className="mt-1 text-sm text-slate-500">
            Insights appear automatically after candidates/interviews are created from HR Setup.
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{insights.topRole.label}</div>
            <div className="mt-2 font-extrabold text-slate-900">{insights.topRole.value}</div>
            <div className="mt-2 text-xs text-slate-500">
              Avg score: <span className="font-bold text-slate-700">{insights.topRole.score}</span>
            </div>
            <Bar pct={insights.topRole.score} tone="violet" />
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{insights.completion.label}</div>
              <div className="text-sm font-extrabold text-slate-900">{insights.completion.value}</div>
            </div>
            <Bar pct={insights.completion.pct} tone="emerald" />
            <div className="mt-2 text-xs text-slate-500">Fewer drop-offs after the first question.</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{insights.recommended.label}</div>
              <div className="text-sm font-extrabold text-slate-900">{insights.recommended.value}</div>
            </div>
            <Bar pct={insights.recommended.pct} tone="indigo" />
            <div className="mt-2 text-xs text-slate-500">Calibrated threshold: ≥ 80 AI score.</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{insights.response.label}</div>
              <div className="text-sm font-extrabold text-slate-900">{insights.response.value}</div>
            </div>
            <Bar pct={insights.response.pct} tone="amber" />
            <div className="mt-2 text-xs text-slate-500">High coherence and specificity across answers.</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HrDashboard({
  onCreateTemplate,
  onInviteCandidate,
  onViewCandidateReport,
  onViewAllCandidates,
  onViewAllUpcoming,
}: {
  onCreateTemplate: () => void;
  onInviteCandidate: () => void;
  onViewCandidateReport: (candidateId: string, interviewId?: string) => void;
  onViewAllCandidates?: () => void;
  onViewAllUpcoming?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [schedules, setSchedules] = useState<InterviewSchedule[]>([]);

  const refresh = async () => {
    const [dash, sch] = await Promise.all([getDashboardData(500), getSchedules()]);
    setCandidates(dash.candidates);
    setSchedules(sch);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        await wakeBackend();
        const [dash, sch] = await Promise.all([getDashboardData(500), getSchedules()]);
        if (!alive) return;
        setCandidates(dash.candidates);
        setSchedules(sch);
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const derived = useMemo(() => {
    const list = candidates || [];
    const allInterviews = list.flatMap((c) => c.interviews || []);
    const active = allInterviews.filter((i) => String(i.status || "").toLowerCase().includes("pending")).length;
    const completed = allInterviews.filter((i) => isCompletedStatus(i.status)).length;
    const avgScore = completed
      ? Math.round(
          allInterviews
            .filter((i) => isCompletedStatus(i.status))
            .map((i) => normalizeScore(i.score))
            .reduce((a, b) => a + b, 0) / Math.max(1, completed)
        )
      : 0;

    const applied = list.filter((c) => !(c.interviews || []).length).length;
    const screening = list.filter((c) => {
      const latest = latestInterview(c);
      return !!latest && String(latest.status || "").toLowerCase().includes("pending");
    }).length;
    const interview = active;
    const evaluation = completed;
    const hired = list.filter((c) => {
      if (c.hr_decision === "shortlist") return true;
      const latest = latestInterview(c);
      return !!latest && String(latest.status || "").toLowerCase().includes("selected");
    }).length;
    const totalPipeline = Math.max(1, applied + screening + evaluation + hired + interview);

    const pipeline = [
      { name: "Applied", count: applied, color: "slate" as const, percent: Math.round((applied / totalPipeline) * 100) },
      { name: "Screening", count: screening, color: "amber" as const, percent: Math.round((screening / totalPipeline) * 100) },
      { name: "Interview", count: interview, color: "indigo" as const, percent: Math.round((interview / totalPipeline) * 100) },
      { name: "Evaluation", count: evaluation, color: "violet" as const, percent: Math.round((evaluation / totalPipeline) * 100) },
      { name: "Hired", count: hired, color: "emerald" as const, percent: Math.round((hired / totalPipeline) * 100) },
    ];

    const stats = [
      {
        title: "Total Candidates",
        value: String(list.length),
        icon: <Users className="w-5 h-5" />,
        trend: { direction: "flat" as const, label: "Live" },
        subtext: "from database",
      },
      {
        title: "Active Interviews",
        value: String(active),
        icon: <Activity className="w-5 h-5" />,
        trend: { direction: active ? ("up" as const) : ("flat" as const), label: active ? "In progress" : "None" },
        subtext: "pending review",
      },
      {
        title: "Completed Interviews",
        value: String(completed),
        icon: <ClipboardCheck className="w-5 h-5" />,
        trend: { direction: "flat" as const, label: "Live" },
        subtext: "evaluated",
      },
      {
        title: "Avg Interview Score",
        value: avgScore ? `${avgScore}%` : "—",
        icon: <BarChart3 className="w-5 h-5" />,
        trend: { direction: "flat" as const, label: "Live" },
        subtext: "completed only",
      },
    ];

    return { stats, pipeline };
  }, [candidates]);

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">HR Dashboard</h1>
          <p className="text-slate-500 mt-1">Monitor hiring pipeline and AI interview performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 transition"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            Create Template
          </button>
          <button
            onClick={onInviteCandidate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition"
          >
            <ClipboardList className="w-4 h-4" />
            Invite Candidate
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {derived.stats.map((s) => (
          <DashboardStatsCard
            key={s.title}
            title={s.title}
            value={s.value}
            icon={s.icon}
            trend={s.trend}
            subtext={s.subtext}
            loading={loading}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Pipeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-extrabold tracking-tight">Hiring pipeline</div>
                <div className="text-xs text-slate-500 mt-0.5">Stage distribution and throughput</div>
              </div>
              <div className="text-xs text-slate-500 font-semibold">{loading ? "Syncing…" : "Live from database"}</div>
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {derived.pipeline.map((p) => (
                <PipelineStageCard key={p.name} name={p.name} count={p.count} color={p.color} percent={p.percent} />
              ))}
            </div>
          </div>

          {/* Recent candidates table */}
          {error ? (
            <div className="bg-white border border-rose-200 rounded-2xl p-6 text-rose-700">
              <div className="font-extrabold">Dashboard error</div>
              <div className="mt-2 text-sm text-rose-600">{error}</div>
            </div>
          ) : (
            <RecentCandidatesTable
              candidates={candidates}
              onOpenInvite={() => {
                onInviteCandidate();
              }}
              onViewCandidateReport={onViewCandidateReport}
              onViewAll={onViewAllCandidates}
              onRefresh={async () => {
                try {
                  await refresh();
                } catch (e: any) {
                  setError(String(e?.message || e));
                }
              }}
            />
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <UpcomingInterviewCard schedules={schedules} onViewAll={onViewAllUpcoming} />
          <AIInsightsCard candidates={candidates} />
        </div>
      </div>
    </div>
  );
}

