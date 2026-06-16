import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileJson,
  Loader2,
  PauseCircle,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import {
  deleteInterviewRecord,
  excludeQuestionFromScore,
  includeQuestionInScore,
  getCandidateById,
  getCandidateInterviewDetail,
  getCandidateInterviewHistory,
  getCandidateStrengthsWeaknesses,
  setHrCandidateDecision,
} from "../api";
import { invalidateApiCache } from "../api/client";
import type { Candidate, CandidateInterviewHistory, CandidateInterviewSummary, InterviewRecord } from "../types";
import { atsStatusFromScore, normalizeScore, weightedCandidateScore } from "../utils/scoreUtils";
import {
  completionRatePercent,
  enrichedTurnsFromRecord,
  overallFromReport,
  pickLatestInterviewId,
  problemSolvingScore,
  safeText,
} from "../utils/reportExtract";
import { PerformanceRadar, SkillBarChart } from "../components/candidate-report/ReportCharts";
import { StrengthsWeaknessesPanel } from "../components/candidate-report/StrengthsWeaknessesPanel";
import { ProfessionalAssessmentSections } from "../components/candidate-report/ProfessionalAssessmentSections";
import type { StrengthsWeaknessesAnalysis } from "../types/strengthsWeaknesses";
import { DeleteInterviewRecordModal } from "../components/DeleteInterviewRecordModal";
import { CrmMetaLine } from "../components/CrmMetaLine";
import { navButtonMotion } from "../lib/motionPresets";

const loadInterviewPdf = () =>
  import("../utils/pdf/generateInterviewPdf").then((m) => m.generateInterviewPdf);

export type CandidateReportReturnTarget = "dashboard" | "candidates";

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "C";
}

function fmtWhen(s?: string) {
  if (!s) return "—";
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return s;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(t);
}

function StatusBanner({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  // Default = amber (Pending Review). On Hold also lives in the amber palette
  // but is slightly more saturated so the recruiter can see it is a deliberate
  // HR action rather than the model's neutral "review" state.
  let cls = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800";
  if (s.includes("reject")) cls = "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800";
  else if (s.includes("select")) cls = "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800";
  else if (s.includes("hold")) cls = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700";
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {status || "—"}
    </span>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-700/80 ${className}`} />;
}

export function CandidateReportPage({
  candidateId,
  initialInterviewId,
  returnTo,
  onBack,
}: {
  candidateId: string;
  initialInterviewId: string;
  returnTo: CandidateReportReturnTarget;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CandidateInterviewHistory | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [record, setRecord] = useState<InterviewRecord | null>(null);
  const [recordBusy, setRecordBusy] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState(() => String(initialInterviewId || "").trim());
  const [detailTab, setDetailTab] = useState<"breakdown" | "strengths">("breakdown");
  const [swAnalysis, setSwAnalysis] = useState<StrengthsWeaknessesAnalysis | null>(null);
  const [swBusy, setSwBusy] = useState(false);
  const [swError, setSwError] = useState("");
  const detailSectionRef = useRef<HTMLElement | null>(null);
  // May 2026: hr_decision now supports a third "on_hold" state. We keep the
  // legacy "shortlist" | "reject" wire format and just extend the union.
  const [hrMark, setHrMark] = useState<"shortlist" | "reject" | "on_hold" | null>(null);
  const [hrSaving, setHrSaving] = useState<"shortlist" | "reject" | "on_hold" | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [excludeTarget, setExcludeTarget] = useState<{ idx: number; question: string } | null>(null);
  const [excludeReason, setExcludeReason] = useState("Not relevant to role");
  const [excludeBusy, setExcludeBusy] = useState(false);
  const [excludeError, setExcludeError] = useState("");
  const [scoreToggleBusy, setScoreToggleBusy] = useState<number | null>(null);

  const EXCLUDE_REASON_OPTIONS = [
    "Not relevant to role",
    "Duplicate question",
    "AI generated poor question",
    "Incorrect question",
    "Other",
  ] as const;
  const reduceMotion = useReducedMotion();
  const navTap = navButtonMotion(!!reduceMotion);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [hist, cand] = await Promise.all([
          getCandidateInterviewHistory(candidateId, { limit: 80 }),
          getCandidateById(candidateId),
        ]);
        if (!alive) return;
        setHistory(hist);
        setCandidate(cand);
        const d = hist?.candidate?.hr_decision;
        setHrMark(d === "shortlist" || d === "reject" || d === "on_hold" ? d : null);
        if (!hist?.candidate?.id) {
          setError("Candidate not found or you may not have access.");
          return;
        }
        let sel = String(initialInterviewId || "").trim();
        if (!sel && hist.interviews?.length) sel = pickLatestInterviewId(hist.interviews);
        setSelectedInterviewId(sel);
      } catch (e: unknown) {
        if (!alive) return;
        setError(String((e as Error)?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [candidateId, initialInterviewId]);

  useEffect(() => {
    const id = String(selectedInterviewId || "").trim();
    if (!id || !history?.candidate?.id) {
      setRecord(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setRecordBusy(true);
        const rec = await getCandidateInterviewDetail(candidateId, id);
        if (!alive) return;
        setRecord(rec);
      } catch {
        if (!alive) return;
        setRecord(null);
      } finally {
        if (!alive) return;
        setRecordBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [candidateId, selectedInterviewId, history?.candidate?.id]);

  const activeSummary: CandidateInterviewSummary | null = useMemo(() => {
    const id = String(selectedInterviewId || "").trim();
    if (!id || !history?.interviews?.length) return null;
    return history.interviews.find((i) => i.id === id) || null;
  }, [history, selectedInterviewId]);

  const report = (record?.report || {}) as Record<string, unknown>;

  const modelInterviewVerdict = useMemo(() => {
    const fromSummary = safeText(activeSummary?.recommendation || "");
    const fromReport =
      safeText((report?.recommendation as string) || "") ||
      safeText((report?.overall_recommendation as string) || "") ||
      safeText(String(report?.fitment || ""));
    const merged = (fromSummary || fromReport || "").trim();
    return merged || "—";
  }, [activeSummary, report]);
  const normScore = activeSummary ? normalizeScore(activeSummary.score) : overallFromReport(report, 0);
  const overall = overallFromReport(report, normScore);
  const commEval = (report?.communication_evaluation || {}) as Record<string, unknown>;
  const comm = normalizeScore(
    commEval.communication_score ?? commEval.overall_score ?? activeSummary?.communication_score ?? 0,
  );
  const tech = normalizeScore(report?.technical_score ?? activeSummary?.technical_score ?? overall);
  const conf = normalizeScore(
    commEval.presentation_score ?? commEval.confidence_score ?? activeSummary?.confidence_score ?? comm,
  );
  const prob = activeSummary ? problemSolvingScore(report, activeSummary) : 0;
  const completion = completionRatePercent(activeSummary);
  const wScore = candidate ? weightedCandidateScore(candidate.interviews || []) : normalizeScore(history?.candidate?.avg_score || 0);
  const ats = atsStatusFromScore(wScore);
  const atsPct = wScore;
  const turns = useMemo(() => enrichedTurnsFromRecord(record), [record]);

  const excludedQuestionsCount = useMemo(() => {
    const ss = report?.scoring_summary as Record<string, unknown> | undefined;
    const fromSummary = Number(ss?.excluded_questions);
    if (Number.isFinite(fromSummary) && fromSummary >= 0) return fromSummary;
    return turns.filter((t) => t.excludedFromScore).length;
  }, [report, turns]);

  const swFromRecord = useMemo((): StrengthsWeaknessesAnalysis | null => {
    const sw = (record?.report as Record<string, unknown> | undefined)?.strengths_weaknesses_analysis;
    if (!sw || typeof sw !== "object") return null;
    const o = sw as StrengthsWeaknessesAnalysis;
    return o.complete ? o : null;
  }, [record]);

  const focusInterviewDetail = useCallback((interviewId: string, tab: "breakdown" | "strengths") => {
    setSelectedInterviewId(interviewId);
    setDetailTab(tab);
    window.requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (detailTab !== "strengths") return;
    const id = String(selectedInterviewId || "").trim();
    if (!id || !candidateId) return;
    if (swFromRecord) {
      setSwAnalysis(swFromRecord);
      setSwError("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        setSwBusy(true);
        setSwError("");
        const res = await getCandidateStrengthsWeaknesses(candidateId, id);
        if (!alive) return;
        setSwAnalysis((res?.analysis as StrengthsWeaknessesAnalysis) || null);
        if (!res?.analysis?.questions?.length) {
          setSwError("No strengths & weaknesses data available for this interview yet.");
        }
      } catch (e: unknown) {
        if (!alive) return;
        setSwAnalysis(null);
        setSwError(String((e as Error)?.message || e || "Failed to load strengths & weaknesses."));
      } finally {
        if (alive) setSwBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [detailTab, selectedInterviewId, candidateId, swFromRecord]);

  const scoringFootnote = useMemo(() => {
    const s = report?.scoring_summary;
    if (!s || typeof s !== "object") return null;
    const o = s as Record<string, unknown>;
    const gen = Number(o.generated_questions);
    const att = Number(o.attempted_questions);
    const ev = Number(o.evaluated_questions);
    if (![gen, att, ev].some((x) => Number.isFinite(x) && x >= 0)) return null;
    const g = Number.isFinite(gen) ? gen : "—";
    const a = Number.isFinite(att) ? att : "—";
    const e = Number.isFinite(ev) ? ev : "—";
    const ex = Number(o.excluded_questions);
    const base = `Generated ${g} · Attempted slots ${a} · Evaluated ${e} · headline score uses evaluated answers only`;
    if (Number.isFinite(ex) && ex > 0) {
      return `${base} · ${ex} excluded from score`;
    }
    return base;
  }, [report]);

  const refreshInterviewData = useCallback(async () => {
    const id = String(selectedInterviewId || "").trim();
    if (!id || !candidateId) return;
    const [hist, rec] = await Promise.all([
      getCandidateInterviewHistory(candidateId, { limit: 80 }),
      getCandidateInterviewDetail(candidateId, id),
    ]);
    setHistory(hist);
    setRecord(rec);
    setSwAnalysis(null);
    invalidateApiCache();
  }, [candidateId, selectedInterviewId]);

  const confirmExcludeFromScore = useCallback(async () => {
    const id = String(selectedInterviewId || "").trim();
    if (!excludeTarget || !id || !candidateId) return;
    try {
      setExcludeBusy(true);
      setExcludeError("");
      const res = await excludeQuestionFromScore(candidateId, id, excludeTarget.idx, excludeReason);
      if (res?.record) setRecord(res.record);
      await refreshInterviewData();
      setExcludeTarget(null);
      showToast(`Question ${excludeTarget.idx} excluded from final score`);
    } catch (e: unknown) {
      setExcludeError(String((e as Error)?.message || e || "Failed to exclude question."));
    } finally {
      setExcludeBusy(false);
    }
  }, [candidateId, selectedInterviewId, excludeTarget, excludeReason, refreshInterviewData, showToast]);

  const toggleQuestionScoreInclusion = useCallback(
    async (turn: { idx: number; question: string; excludedFromScore?: boolean }) => {
      const id = String(selectedInterviewId || "").trim();
      if (!id || !candidateId) return;
      if (turn.excludedFromScore) {
        try {
          setScoreToggleBusy(turn.idx);
          const res = await includeQuestionInScore(candidateId, id, turn.idx);
          if (res?.record) setRecord(res.record);
          await refreshInterviewData();
          showToast(`Question ${turn.idx} included in final score`);
        } catch (e: unknown) {
          showToast(String((e as Error)?.message || e || "Failed to include question."));
        } finally {
          setScoreToggleBusy(null);
        }
        return;
      }
      setExcludeError("");
      setExcludeReason("Not relevant to role");
      setExcludeTarget({ idx: turn.idx, question: turn.question });
    },
    [candidateId, selectedInterviewId, refreshInterviewData, showToast],
  );

  const aiSummaryBody =
    safeText(report?.overall_summary || report?.summary || report?.feedback) ||
    safeText(activeSummary?.summary) ||
    "—";

  const managerReviewSnapshot = useMemo(
    () => ({
      candidateName: candidate?.name || history?.candidate?.name || "—",
      role: activeSummary?.job_title || candidate?.role || history?.candidate?.role || "—",
      scorePercent: normScore,
      recommendation: modelInterviewVerdict,
      interviewDate:
        activeSummary?.updated_date_ist ||
        activeSummary?.created_date_ist ||
        fmtWhen(activeSummary?.updated_at || activeSummary?.created_at),
      aiVerdict: aiSummaryBody,
      communicationScore: comm,
      technicalScore: tech,
    }),
    [
      candidate?.name,
      candidate?.role,
      history?.candidate?.name,
      history?.candidate?.role,
      activeSummary,
      normScore,
      modelInterviewVerdict,
      aiSummaryBody,
      comm,
      tech,
    ],
  );

  const strengthsList =
    (Array.isArray(report?.strengths) && (report.strengths as string[])) ||
    activeSummary?.strengths ||
    [];
  const gapsList =
    (Array.isArray(report?.weaknesses) && (report.weaknesses as string[])) ||
    activeSummary?.weaknesses ||
    [];

  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            candidate: history?.candidate,
            interviews: history?.interviews,
            selected_interview_id: selectedInterviewId,
            interview_record: record,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `karnex-candidate-${candidateId}-report.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("JSON exported");
  };

  const copyShareLink = async () => {
    const params = new URLSearchParams();
    params.set("view", "candidateReport");
    params.set("cid", candidateId);
    if (selectedInterviewId) params.set("iid", selectedInterviewId);
    if (returnTo === "dashboard") params.set("ret", "dashboard");
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Report link copied");
    } catch {
      showToast("Could not copy link");
    }
  };

  const downloadPdf = async () => {
    if (!history?.candidate || !activeSummary) {
      showToast("Select an interview with data first");
      return;
    }
    try {
      setPdfBusy(true);
      const gen = await loadInterviewPdf();
      await gen(candidateId, { candidate: history.candidate, interview: activeSummary });
    } catch (e: unknown) {
      showToast(String((e as Error)?.message || e));
    } finally {
      setPdfBusy(false);
    }
  };

  const requestDeleteInterview = (id: string, label?: string) => {
    const rid = String(id || "").trim();
    if (!rid) {
      showToast("Select an interview first");
      return;
    }
    setDeleteTarget({ id: rid, label: label || "Selected interview/report" });
    setDeleteError("");
  };

  const confirmDeleteInterview = async () => {
    const id = String(deleteTarget?.id || "").trim();
    if (!id) {
      showToast("Select an interview first");
      return;
    }
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteInterviewRecord(id);
      invalidateApiCache();
      const [hist, cand] = await Promise.all([
        getCandidateInterviewHistory(candidateId, { limit: 80 }),
        getCandidateById(candidateId),
      ]);
      setHistory(hist);
      setCandidate(cand);
      const nextId = hist?.interviews?.length ? pickLatestInterviewId(hist.interviews) : "";
      setSelectedInterviewId(nextId);
      setRecord(null);
      setDeleteTarget(null);
      showToast("Interview/report deleted");
      if (!nextId) onBack();
    } catch (e: unknown) {
      setDeleteError(String((e as Error)?.message || e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const backLabel = returnTo === "dashboard" ? "Back to dashboard" : "Back to reports";

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <SkeletonBlock className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonBlock className="h-40 lg:col-span-2" />
          <SkeletonBlock className="h-40" />
        </div>
        <SkeletonBlock className="h-72" />
      </div>
    );
  }

  if (error || !history?.candidate) {
    return (
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </button>
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-8 text-rose-800 dark:text-rose-200">
          <div className="font-extrabold text-lg">Unable to load report</div>
          <p className="mt-2 text-sm opacity-90">{error || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const c = history.candidate;
  const displayName = candidate?.name || c.name;
  const displayEmail = candidate?.email || c.email;
  const displayRole = candidate?.role || c.role;
  const displayOpportunity =
    activeSummary?.opportunityId || record?.opportunityId || "";
  const displayCustomer =
    activeSummary?.customerName || record?.customerName || "";

  const headerStatusBadge =
    c.hr_decision === "reject"
      ? "Rejected"
      : c.hr_decision === "shortlist"
        ? "Selected"
        : c.hr_decision === "on_hold"
          ? "On Hold"
          : String(activeSummary?.status || c.status || "—");

  // May 2026: Re-toggling the same chip clears the decision so HR can
  // "un-hold" / "un-reject" a candidate without leaving the page.
  const persistHrDecision = async (decision: "shortlist" | "reject" | "on_hold") => {
    setHrSaving(decision);
    const nextDecision: "shortlist" | "reject" | "on_hold" | null =
      hrMark === decision ? null : decision;
    try {
      await setHrCandidateDecision(candidateId, nextDecision);
      invalidateApiCache("/hr/dashboard");
      const [hist, cand] = await Promise.all([
        getCandidateInterviewHistory(candidateId, { limit: 80 }),
        getCandidateById(candidateId),
      ]);
      setHistory(hist);
      setCandidate(cand);
      const d = hist?.candidate?.hr_decision;
      setHrMark(d === "shortlist" || d === "reject" || d === "on_hold" ? d : null);
      if (nextDecision === null) {
        showToast("Decision cleared for this candidate");
      } else if (nextDecision === "shortlist") {
        showToast("Selected — saved everywhere for this candidate");
      } else if (nextDecision === "reject") {
        showToast("Rejected — saved everywhere for this candidate");
      } else {
        showToast("On Hold — saved everywhere for this candidate");
      }
    } catch (e: unknown) {
      showToast(String((e as Error)?.message || e));
    } finally {
      setHrSaving(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/80 dark:bg-slate-950 pb-16">
      <DeleteInterviewRecordModal
        open={Boolean(deleteTarget)}
        busy={deleteBusy}
        error={deleteError}
        targetLabel={deleteTarget?.label}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={() => void confirmDeleteInterview()}
      />
      {excludeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Exclude this question from final score?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Question, answer, transcript, strengths, weaknesses, and audit history are kept. Only aggregate scores
              are recalculated.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Question, answer, transcript, strengths &amp; weaknesses, and audit history are kept. Only the final
              score and recommendation will be recalculated.
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-3">
              Question {excludeTarget.idx}: {excludeTarget.question || "—"}
            </p>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Reason (optional)
              <select
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-100"
              >
                {EXCLUDE_REASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            {excludeError ? <p className="text-sm text-rose-600 dark:text-rose-400">{excludeError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={excludeBusy}
                onClick={() => {
                  if (excludeBusy) return;
                  setExcludeTarget(null);
                  setExcludeError("");
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={excludeBusy}
                onClick={() => void confirmExcludeFromScore()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60"
              >
                {excludeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Exclude
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Sticky toolbar */}
      <div className="sticky top-16 z-10 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Hiring decision buttons (May 2026 redesign).
              ------------------------------------------------------
              Pill-shaped buttons with a circular icon badge that grows on
              hover so the recruiter has immediate visual feedback when their
              cursor / keyboard focus is on a button.

              Visual states:
                - idle      → soft tinted background + 2-px outline
                - hover     → lifts 2px, deeper border, soft colored shadow
                - focus     → 2-px ring with offset for keyboard nav (a11y)
                - selected  → filled gradient + white text + inline CheckCircle
                              badge so the active choice is unmistakable
                - saving    → spinner replaces the icon (existing logic kept)
            */}
            <motion.button
              type="button"
              disabled={hrSaving !== null}
              onClick={() => void persistHrDecision("shortlist")}
              {...navTap}
              aria-pressed={hrMark === "shortlist"}
              title="Mark this candidate as Shortlisted"
              className={`group relative inline-flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2 text-sm font-bold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                hrMark === "shortlist"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-300/50 dark:shadow-emerald-900/40"
                  : "bg-emerald-50/90 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/55 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-200/70 dark:hover:shadow-emerald-900/40 hover:-translate-y-0.5"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-transform duration-200 group-hover:scale-110 group-active:scale-95 ${
                  hrMark === "shortlist"
                    ? "bg-white/20 text-white"
                    : "bg-white text-emerald-600 dark:bg-slate-900 dark:text-emerald-300 shadow-sm"
                }`}
              >
                {hrSaving === "shortlist" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ThumbsUp className="w-4 h-4" strokeWidth={2.5} />
                )}
              </span>
              <span>Shortlist</span>
              {hrMark === "shortlist" ? (
                <CheckCircle2 className="w-4 h-4 ml-0.5 opacity-90" aria-hidden="true" />
              ) : null}
            </motion.button>

            {/*
              May 2026 — "On Hold" is the third hiring decision in the pill
              cluster. We use an amber palette to distinguish it visually from
              the green Shortlist and rose Reject options, and a PauseCircle
              icon to communicate "decision parked, not closed". Clicking it
              again clears the mark (see `persistHrDecision`).
            */}
            <motion.button
              type="button"
              disabled={hrSaving !== null}
              onClick={() => void persistHrDecision("on_hold")}
              {...navTap}
              aria-pressed={hrMark === "on_hold"}
              title="Park this candidate as On Hold"
              className={`group relative inline-flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2 text-sm font-bold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                hrMark === "on_hold"
                  ? "bg-gradient-to-br from-amber-500 to-amber-600 border-amber-600 text-white shadow-lg shadow-amber-300/50 dark:shadow-amber-900/40"
                  : "bg-amber-50/90 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/55 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:border-amber-500 hover:shadow-md hover:shadow-amber-200/70 dark:hover:shadow-amber-900/40 hover:-translate-y-0.5"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-transform duration-200 group-hover:scale-110 group-active:scale-95 ${
                  hrMark === "on_hold"
                    ? "bg-white/20 text-white"
                    : "bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-300 shadow-sm"
                }`}
              >
                {hrSaving === "on_hold" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PauseCircle className="w-4 h-4" strokeWidth={2.5} />
                )}
              </span>
              <span>On Hold</span>
              {hrMark === "on_hold" ? (
                <Timer className="w-4 h-4 ml-0.5 opacity-90" aria-hidden="true" />
              ) : null}
            </motion.button>

            <motion.button
              type="button"
              disabled={hrSaving !== null}
              onClick={() => void persistHrDecision("reject")}
              {...navTap}
              aria-pressed={hrMark === "reject"}
              title="Mark this candidate as Rejected"
              className={`group relative inline-flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2 text-sm font-bold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                hrMark === "reject"
                  ? "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-600 text-white shadow-lg shadow-rose-300/50 dark:shadow-rose-900/40"
                  : "bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/55 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:border-rose-500 hover:shadow-md hover:shadow-rose-200/70 dark:hover:shadow-rose-900/40 hover:-translate-y-0.5"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-transform duration-200 group-hover:scale-110 group-active:scale-95 ${
                  hrMark === "reject"
                    ? "bg-white/20 text-white"
                    : "bg-white text-rose-600 dark:bg-slate-900 dark:text-rose-300 shadow-sm"
                }`}
              >
                {hrSaving === "reject" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ThumbsDown className="w-4 h-4" strokeWidth={2.5} />
                )}
              </span>
              <span>Reject</span>
              {hrMark === "reject" ? (
                <XCircle className="w-4 h-4 ml-0.5 opacity-90" aria-hidden="true" />
              ) : null}
            </motion.button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => void downloadPdf()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FileJson className="w-4 h-4" />
              JSON
            </button>
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              type="button"
              onClick={() => requestDeleteInterview(selectedInterviewId, `${displayName} • ${activeSummary?.job_title || displayRole || "Interview"}`)}
              disabled={deleteBusy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60 disabled:pointer-events-none"
            >
              {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold shadow-lg flex items-center gap-2">
          <Copy className="w-4 h-4 text-indigo-500" />
          {toast}
        </div>
      ) : null}

      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/*
          May 2026 — confirmation banner that mirrors the active decision.
          The amber "On Hold" branch lives alongside the existing emerald
          (Shortlist) and rose (Reject) variants, so HR always sees the same
          colour language across the page.
        */}
        {hrMark ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
              hrMark === "shortlist"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100"
                : hrMark === "on_hold"
                  ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100"
                  : "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-100"
            }`}
          >
            {hrMark === "shortlist" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : hrMark === "on_hold" ? (
              <PauseCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {hrMark === "shortlist"
              ? "Selected — this choice is saved and shown on the dashboard, reports list, and interview history (same status everywhere)."
              : hrMark === "on_hold"
                ? "On Hold — candidate is parked in the pipeline. Status is mirrored on the dashboard, reports list, and interview history."
                : "Rejected — this choice is saved and shown on the dashboard, reports list, and interview history (same status everywhere)."}
          </motion.div>
        ) : null}

        {/* Header card */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-500" />
          <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
            <div className="flex items-start gap-5 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-black shrink-0 shadow-lg shadow-indigo-500/25">
                {initials(displayName)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Candidate</p>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="truncate max-w-full">{displayEmail}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide text-xs">{displayRole}</span>
                </div>
                <CrmMetaLine
                  opportunityId={displayOpportunity}
                  customerName={displayCustomer}
                  className="mt-3"
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBanner status={headerStatusBadge} />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Interview: {fmtWhen(activeSummary?.updated_at_ist || activeSummary?.created_at_ist)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 lg:text-right shrink-0">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 min-w-[140px]">
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">ATS match</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{atsPct}%</p>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">{ats}</p>
              </div>
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-6 py-4 min-w-[160px] text-left sm:text-right">
                <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-widest">AI score</p>
                <p className="text-4xl sm:text-5xl font-black text-indigo-700 dark:text-indigo-200 mt-1 tabular-nums">{overall}%</p>
                {excludedQuestionsCount > 0 ? (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-2">
                    Excluded Questions: {excludedQuestionsCount}
                  </p>
                ) : null}
                {scoringFootnote ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[220px] sm:ml-auto leading-snug">{scoringFootnote}</p>
                ) : null}
                {recordBusy ? (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Syncing interview…
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Analytics */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3"
        >
          {[
            { label: "Communication", value: comm, icon: <User className="w-4 h-4" /> },
            { label: "Technical", value: tech, icon: <Award className="w-4 h-4" /> },
            { label: "Confidence", value: conf, icon: <Sparkles className="w-4 h-4" /> },
            { label: "Problem solving", value: prob, icon: <Brain className="w-4 h-4" /> },
            { label: "Completion", value: completion, icon: <BarChart3 className="w-4 h-4" /> },
            {
              label: "Model recommendation",
              value: null,
              text: modelInterviewVerdict,
              icon: <Sparkles className="w-4 h-4" />,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{card.label}</span>
                {card.icon}
              </div>
              {card.value != null ? (
                <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{card.value}%</div>
              ) : (
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 line-clamp-4">{card.text}</p>
              )}
              {card.value != null ? (
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${Math.max(4, Math.min(100, card.value))}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </motion.section>

        {/* Charts */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
          className="grid grid-cols-1 xl:grid-cols-2 gap-4"
        >
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Skill scores</h2>
            <SkillBarChart data={activeSummary?.skill_breakdown || []} />
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Performance radar</h2>
            <PerformanceRadar
              communication={comm}
              technical={tech}
              confidence={conf}
              problemSolving={prob}
              overall={overall}
            />
          </div>
        </motion.section>

        {/* Timeline */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Interview timeline</h2>
            <span className="text-xs font-semibold text-slate-400">{history.interviews?.length || 0} sessions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-3">Role / template</th>
                  <th className="px-6 py-3">Opportunity ID</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Score</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(history.interviews || []).map((row) => {
                  const active = row.id === selectedInterviewId;
                  return (
                    <tr key={row.id} className={active ? "bg-indigo-50/60 dark:bg-indigo-950/30" : "k-hover-row hover:bg-slate-50/60 dark:hover:bg-slate-800/40"}>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{row.job_title || displayRole}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.opportunityId || "—"}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.customerName || "—"}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtWhen(row.scheduled_at_local || row.created_at_ist)}</td>
                      <td className="px-6 py-4">
                        <StatusBanner status={String(row.status)} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-black text-slate-900 dark:text-white">{normalizeScore(row.score)}%</div>
                        {Number(row.excluded_questions_count) > 0 ? (
                          <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mt-1">
                            Excluded Questions: {row.excluded_questions_count}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => focusInterviewDetail(row.id, "breakdown")}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          View breakdown
                          <ChevronDown
                            className={`w-3 h-3 transition ${active && detailTab === "breakdown" ? "rotate-180" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => focusInterviewDetail(row.id, "strengths")}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          Strengths &amp; Weaknesses
                          <ChevronDown
                            className={`w-3 h-3 transition ${active && detailTab === "strengths" ? "rotate-180" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteInterview(row.id, `${displayName} • ${row.job_title || displayRole || "Interview"}`)}
                          disabled={deleteBusy && deleteTarget?.id === row.id}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60 disabled:pointer-events-none"
                        >
                          {deleteBusy && deleteTarget?.id === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Breakdown / Strengths & Weaknesses */}
        <motion.section
          ref={detailSectionRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.12 }}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Interview detail
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {detailTab === "breakdown"
                  ? "Expand each turn for evaluation, scores, and suggested answers."
                  : "Manager review dashboard — hiring verdict, skill cards, top answers, and follow-up prompts."}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 gap-1">
              <button
                type="button"
                onClick={() => setDetailTab("breakdown")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  detailTab === "breakdown"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Breakdown
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("strengths")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  detailTab === "strengths"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Strengths &amp; Weaknesses
              </button>
            </div>
          </div>
          {detailTab === "strengths" ? (
            <div className="p-6">
              <StrengthsWeaknessesPanel
                analysis={swAnalysis}
                snapshot={managerReviewSnapshot}
                busy={swBusy || recordBusy}
                error={swError}
              />
            </div>
          ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {!turns.length ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">No questions and answers in this record yet.</div>
            ) : (
              turns.map((t) => (
                <details key={t.idx} className="group open:bg-slate-50/50 dark:open:bg-slate-800/30">
                  <summary className="cursor-pointer list-none px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-indigo-500">Question {t.idx}</span>
                        {t.boundaryLabel ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 px-2 py-0.5">
                            {t.boundaryLabel}
                          </span>
                        ) : null}
                        {t.excludedFromScore ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 px-2 py-0.5">
                            EXCLUDED FROM SCORE
                          </span>
                        ) : null}
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 mt-1">{t.question || "—"}</p>
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {t.score != null ? (
                        <span className="text-xs font-black rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 px-2 py-1">
                          Score: {t.score}%
                        </span>
                      ) : null}
                      {!t.excludedFromScore ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggleQuestionScoreInclusion(t);
                          }}
                          disabled={scoreToggleBusy === t.idx || excludeBusy}
                          className="inline-flex items-center rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-950/60 disabled:opacity-60"
                        >
                          {scoreToggleBusy === t.idx ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Exclude From Score
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggleQuestionScoreInclusion(t);
                          }}
                          disabled={scoreToggleBusy === t.idx || excludeBusy}
                          className="inline-flex items-center rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 disabled:opacity-60"
                        >
                          {scoreToggleBusy === t.idx ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Include In Score
                        </button>
                      )}
                      <ChevronDown className="w-5 h-5 text-slate-400 transition group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="px-6 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Candidate answer</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{t.answer || "—"}</p>
                    </div>
                    <ProfessionalAssessmentSections turn={t} />
                    {t.excludedFromScore ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-500">Status</p>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">EXCLUDED FROM SCORE</p>
                        {t.score != null ? (
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Score: {t.score}% — this question is not included in final evaluation.
                          </p>
                        ) : null}
                        {t.excludedBy ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Excluded by: {t.excludedBy}</p>
                        ) : null}
                        {t.excludedAt ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Excluded at: {fmtWhen(t.excludedAt)}</p>
                        ) : null}
                        {t.excludedReason ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {t.excludedReason}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </details>
              ))
            )}
          </div>
          )}
        </motion.section>

        {/* AI Summary */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.14 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-500" /> AI executive summary
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{aiSummaryBody}</p>
            <div className="mt-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 px-4 py-3">
              <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300">Final verdict</p>
              <p className="mt-1 text-sm font-bold text-indigo-950 dark:text-indigo-100 space-y-2">
                <span className="block">
                  Hiring status (lists and dashboards): <span className="text-indigo-800 dark:text-indigo-200">{headerStatusBadge}</span>
                </span>
                <span className="block text-slate-700 dark:text-slate-300 font-semibold">
                  Model suggestion (this interview): {modelInterviewVerdict}
                </span>
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Highlights</h3>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Strengths</p>
              <ul className="mt-2 text-sm text-slate-700 dark:text-slate-200 space-y-1 list-disc pl-4">
                {(strengthsList.length ? strengthsList : ["—"]).slice(0, 8).map((s, i) => (
                  <li key={i}>{String(s)}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Technical / skill gaps</p>
              <ul className="mt-2 text-sm text-slate-700 dark:text-slate-200 space-y-1 list-disc pl-4">
                {(gapsList.length ? gapsList : ["—"]).slice(0, 8).map((s, i) => (
                  <li key={i}>{String(s)}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Communication</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                Communication score <span className="font-black text-indigo-600 dark:text-indigo-400">{comm}%</span> — use breakdown above for tone and clarity signals.
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
