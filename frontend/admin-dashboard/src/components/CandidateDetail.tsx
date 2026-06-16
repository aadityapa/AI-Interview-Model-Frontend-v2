import { ArrowUpRight, LayoutTemplate, Loader2, Trash2, TrendingUp } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Candidate, Interview, InterviewStatus } from "../types";
import { ScoreBadge } from "./ScoreBadge";
import { atsStatusFromScore, weightedCandidateScore } from "../utils/scoreUtils";
import { FloatingGlassCard, InterviewStatusSelector } from "./interview-status/InterviewStatusSelector";
import { CrmMetaLine } from "./CrmMetaLine";

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.05, 0.35), type: "spring" as const, stiffness: 420, damping: 34 },
  }),
};

function CandidateDetailImpl({
  candidate,
  onOpenInterviewReport,
  onInterviewStatusChange,
  onRequestDeleteInterview,
  deleteBusyInterviewId = "",
}: {
  candidate: Candidate;
  onOpenInterviewReport?: (candidateId: string, interviewId: string) => void;
  onInterviewStatusChange?: (candidateId: string, interviewId: string, status: InterviewStatus) => void;
  onRequestDeleteInterview?: (candidateId: string, interview: Interview) => void;
  deleteBusyInterviewId?: string;
}) {
  const w = weightedCandidateScore(candidate.interviews || []);
  const ats = atsStatusFromScore(w);
  const atsCls =
    ats === "Strong Match" ? "text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800" : ats === "Moderate Match" ? "text-amber-700 bg-amber-50 border-amber-100 dark:text-amber-200 dark:bg-amber-950/50 dark:border-amber-800" : "text-rose-700 bg-rose-50 border-rose-100 dark:text-rose-200 dark:bg-rose-950/50 dark:border-rose-800";

  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, variant: "success" | "error" = "success") => {
    setToast({ msg, variant });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const latestCrm = useMemo(() => {
    const sorted = [...(candidate.interviews || [])].sort(
      (a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""),
    );
    const hit = sorted.find((i) => (i.opportunityId || i.customerName || "").trim());
    return {
      opportunityId: hit?.opportunityId || sorted[0]?.opportunityId,
      customerName: hit?.customerName || sorted[0]?.customerName,
    };
  }, [candidate.interviews]);

  const templates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const i of candidate.interviews || []) {
      const title = (i.templateTitle || i.sessionName || "").trim();
      if (!title) continue;
      const k = title.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(title);
    }
    return out;
  }, [candidate]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 32 }}
    >
      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-[100] rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-md ${
            toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50/95 text-rose-900 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100"
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}

      <FloatingGlassCard className="p-8 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <motion.div
            whileHover={{ scale: 1.03, rotate: -1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-black border border-white/30 shadow-lg shadow-indigo-500/25 dark:shadow-indigo-900/40"
          >
            {candidate.name.charAt(0)}
          </motion.div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{candidate.name}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-100/80 dark:border-indigo-900/80">
                {candidate.role}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm">{candidate.email}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${atsCls}`}>ATS: {ats}</span>
            </div>
            <CrmMetaLine
              opportunityId={latestCrm.opportunityId}
              customerName={latestCrm.customerName}
              className="mt-3"
            />
          </div>
        </div>
        <motion.div
          className="text-right sm:text-right"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.08 }}
        >
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1">Normalized Score</p>
          <p className="text-3xl font-black bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
            {w}%
          </p>
        </motion.div>
      </FloatingGlassCard>

      {templates.length > 0 ? (
        <FloatingGlassCard className="px-6 py-4 flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <LayoutTemplate className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Candidate interview is for</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {templates.map((t) => (
              <span
                key={t}
                className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full shadow-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </FloatingGlassCard>
      ) : null}

      <FloatingGlassCard>
        <div className="px-8 py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50/80 via-white/50 to-indigo-50/40 dark:from-slate-900/80 dark:via-slate-900/40 dark:to-indigo-950/30">
          <motion.h3
            className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest flex items-center gap-2"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Complete Interview History
          </motion.h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-950/30">
                <th className="px-8 py-4">Interview Title</th>
                <th className="px-8 py-4">Opportunity ID</th>
                <th className="px-8 py-4">Customer</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Skills</th>
                <th className="px-8 py-4 text-center">AI Score</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Details</th>
                {onRequestDeleteInterview ? <th className="px-8 py-4 text-right">Delete</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(candidate.interviews || []).map((i, idx) => {
                const skills = Array.from(
                  new Set(
                    (i.skills || [])
                      .map((s) => String(s || "").trim().split(/\s+/).join(" "))
                      .filter(Boolean),
                  ),
                );
                const visibleSkills = skills.slice(0, 4);
                const hiddenCount = Math.max(0, skills.length - visibleSkills.length);

                return (
                <motion.tr
                  key={i.id}
                  custom={idx}
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  className="k-hover-row hover:bg-slate-50/90 dark:hover:bg-slate-800/45 transition-colors hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.15)]"
                >
                  <td className="px-8 py-6 font-bold text-slate-700 dark:text-slate-200">{i.templateTitle || i.sessionName}</td>
                  <td className="px-8 py-6 text-sm text-slate-600 dark:text-slate-300">{i.opportunityId || "—"}</td>
                  <td className="px-8 py-6 text-sm text-slate-600 dark:text-slate-300">{i.customerName || "—"}</td>
                  <td className="px-8 py-6 text-sm text-slate-500 dark:text-slate-400">{i.date}</td>
                  <td className="px-8 py-6">
                    {!skills.length ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    ) : (
                      <div className="max-w-[220px]">
                        <div className="flex flex-wrap gap-1.5">
                          {visibleSkills.map((s) => (
                            <span
                              key={s}
                              title={s}
                              className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm truncate max-w-[200px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                        {hiddenCount > 0 ? (
                          <div className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            +{hiddenCount} more
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <ScoreBadge score={i.score} />
                  </td>
                  <td className="px-8 py-6 align-middle relative z-0">
                    <InterviewStatusSelector
                      interviewId={i.id}
                      status={i.status}
                      disabled={!i.id}
                      onUpdated={(next) => onInterviewStatusChange?.(candidate.id, i.id, next)}
                      onToast={showToast}
                    />
                  </td>
                  <td className="px-8 py-6 text-right">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onOpenInterviewReport?.(candidate.id, i.id)}
                      disabled={!onOpenInterviewReport}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 shadow-sm"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      View
                    </motion.button>
                  </td>
                  {onRequestDeleteInterview ? (
                    <td className="px-8 py-6 text-right">
                      <button
                        type="button"
                        onClick={() => onRequestDeleteInterview(candidate.id, i)}
                        disabled={deleteBusyInterviewId === i.id}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white/90 dark:bg-slate-900/90 px-3 text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 shadow-sm transition hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60 disabled:pointer-events-none"
                        title="Delete this interview/report"
                      >
                        {deleteBusyInterviewId === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                      </button>
                    </td>
                  ) : null}
                </motion.tr>
              );
            })}
              {!candidate.interviews?.length ? (
                <tr>
                  <td className="px-8 py-8 text-slate-400 dark:text-slate-500" colSpan={onRequestDeleteInterview ? 9 : 8}>
                    No interview records found for this candidate yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </FloatingGlassCard>
    </motion.div>
  );
}

export const CandidateDetail = memo(
  CandidateDetailImpl,
  (prev, next) =>
    prev.candidate === next.candidate &&
    prev.onOpenInterviewReport === next.onOpenInterviewReport &&
    prev.onInterviewStatusChange === next.onInterviewStatusChange &&
    prev.onRequestDeleteInterview === next.onRequestDeleteInterview &&
    prev.deleteBusyInterviewId === next.deleteBusyInterviewId,
);
