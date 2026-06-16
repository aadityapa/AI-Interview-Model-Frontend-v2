import { CalendarClock, CheckCircle2, Clock3, Layers3, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GroupedReportBucket } from "../utils/reportGrouping";
import { isInterviewCompleted } from "../utils/reportGrouping";
import { ScoreBadge } from "./ScoreBadge";
import { StatusPill } from "./StatusPill";

function fmtWhen(s?: string) {
  const raw = String(s || "").trim();
  if (!raw) return "—";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

const PAGE_SIZE = 12;

export function ReportGroupDetail({
  groupLabel,
  group,
  onOpenCandidateReport,
}: {
  groupLabel: string;
  group: GroupedReportBucket | null;
  onOpenCandidateReport?: (candidateId: string, interviewId?: string) => void;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [group?.id]);

  const pageCount = useMemo(() => {
    if (!group?.rows?.length) return 1;
    return Math.max(1, Math.ceil(group.rows.length / PAGE_SIZE));
  }, [group?.rows]);

  const rows = useMemo(() => {
    if (!group?.rows?.length) return [];
    const start = (page - 1) * PAGE_SIZE;
    return group.rows.slice(start, start + PAGE_SIZE);
  }, [group?.rows, page]);

  if (!group) {
    return (
      <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-slate-400 dark:text-slate-500">
        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-full mb-6 border border-slate-100 dark:border-slate-700">
          <Layers3 className="w-16 h-16 text-indigo-200 dark:text-indigo-500/60" />
        </div>
        <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Select {groupLabel}</h3>
        <p className="mt-2 text-slate-400 dark:text-slate-500 max-w-sm text-center">
          Pick an item from the sidebar to review grouped interview metrics and linked candidate reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60">
            <Target className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-300 tracking-widest">{groupLabel}</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight truncate">{group.label}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" /> Latest interview: {fmtWhen(group.latestDate)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{group.averageScore}%</p>
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Average AI score</p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Total candidates</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> {group.totalCandidates}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Total interviews</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{group.totalInterviews}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
          <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 tracking-widest">Completed interviews</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-200 mt-1 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {group.completedInterviews}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 p-4">
          <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 tracking-widest">Pending interviews</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-200 mt-1 flex items-center gap-2"><Clock3 className="w-4 h-4" /> {group.pendingInterviews}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
          <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-widest">Latest activity</p>
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-200 mt-2">{fmtWhen(group.latestDate)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest">Linked Candidate Interviews</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{group.rows.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-3">Candidate</th>
                <th className="px-6 py-3">Template</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Completion</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">AI Score</th>
                <th className="px-6 py-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => {
                const interview = row.interview;
                const done = isInterviewCompleted(interview);
                return (
                  <tr key={`${row.candidateId}:${interview.id}`} className="k-hover-row hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{row.candidateName}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.candidateEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{interview.templateTitle || interview.sessionName || "Interview"}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtWhen(row.sortDate)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                          done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        }`}
                      >
                        {done ? "Completed" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={interview.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ScoreBadge score={interview.score} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenCandidateReport?.(row.candidateId, interview.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
                      >
                        Open Report
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    No linked interviews found for this grouping.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Page {page} of {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
