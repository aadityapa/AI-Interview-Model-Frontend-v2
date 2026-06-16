import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import type { StrengthsWeaknessesAnalysis } from "../../types/strengthsWeaknesses";
import {
  buildManagerDashboardView,
  type ManagerDashboardSnapshot,
  type SkillCard,
} from "../../utils/managerDashboardView";

function BulletList({ items, tone }: { items: string[]; tone: "strength" | "weakness" | "neutral" }) {
  const Icon = tone === "strength" ? Check : tone === "weakness" ? X : Target;
  const iconCls =
    tone === "strength" ? "text-emerald-500" : tone === "weakness" ? "text-rose-500" : "text-slate-400";
  const textCls =
    tone === "strength"
      ? "text-emerald-900 dark:text-emerald-100"
      : tone === "weakness"
        ? "text-rose-900 dark:text-rose-100"
        : "text-slate-700 dark:text-slate-200";
  return (
    <ul className="space-y-1.5">
      {items.map((line, i) => (
        <li key={i} className={`flex items-start gap-2 text-sm leading-snug ${textCls}`}>
          <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${iconCls}`} aria-hidden />
          <span>{line.replace(/^[✓✗]\s*/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function toneStyles(tone: SkillCard["tone"]) {
  if (tone === "green") {
    return {
      border: "border-emerald-200/90 dark:border-emerald-800",
      bg: "bg-emerald-50/70 dark:bg-emerald-950/35",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (tone === "yellow") {
    return {
      border: "border-amber-200/90 dark:border-amber-800",
      bg: "bg-amber-50/70 dark:bg-amber-950/35",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
      dot: "bg-amber-500",
    };
  }
  return {
    border: "border-rose-200/90 dark:border-rose-800",
    bg: "bg-rose-50/70 dark:bg-rose-950/35",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
    dot: "bg-rose-500",
  };
}

function SkillCardView({ card }: { card: SkillCard }) {
  const s = toneStyles(card.tone);
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-4 flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} aria-hidden />
          <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">{card.title}</h4>
        </div>
        <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${s.badge}`}>
          {card.levelLabel}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">{card.summary}</p>
      {card.bullets.length > 0 ? <BulletList items={card.bullets} tone={card.tone === "red" ? "weakness" : "strength"} /> : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 mb-4">
      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
        <Icon className="w-4 h-4" aria-hidden />
      </div>
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function confidenceBadge(level: "High" | "Moderate" | "Low") {
  if (level === "High") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";
  if (level === "Moderate") return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
  return "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200";
}

export function StrengthsWeaknessesPanel({
  analysis,
  snapshot,
  busy,
  error,
}: {
  analysis: StrengthsWeaknessesAnalysis | null;
  snapshot: ManagerDashboardSnapshot;
  busy?: boolean;
  error?: string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const dashboard = useMemo(() => buildManagerDashboardView(analysis, snapshot), [analysis, snapshot]);

  if (busy) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        Loading manager review dashboard…
      </div>
    );
  }
  if (error) {
    return <div className="p-8 text-center text-rose-600 dark:text-rose-400 text-sm">{error}</div>;
  }
  if (!dashboard) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
        No evaluation data yet for this interview. Complete the interview and wait for the AI report.
      </div>
    );
  }

  const { snapshot: snap, strengthCards, improvementCards, topBest, topWeakest, followUpQuestions, questions } =
    dashboard;
  const verdictLines = snap.aiVerdict.split("\n").filter(Boolean);

  return (
    <div className="space-y-8">
      {/* SECTION 1 — Candidate Snapshot */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 p-5 sm:p-6">
        <SectionHeader icon={User} title="Candidate Snapshot" subtitle="20-second hiring decision at a glance" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Candidate</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{snap.candidateName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</p>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{snap.role}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{snap.scorePercent}%</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommendation</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{snap.hiringRecommendation}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confidence Level</p>
            <span
              className={`inline-block mt-1 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${confidenceBadge(snap.confidenceLevel)}`}
            >
              {snap.confidenceLevel}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interview Date</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{snap.interviewDate}</p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-indigo-200/80 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 p-4">
          <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
            <p className="text-[10px] font-black uppercase tracking-widest">AI Verdict</p>
          </div>
          <div className="mt-2 space-y-1">
            {verdictLines.map((line, i) => (
              <p key={i} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 — Strength Summary */}
      <section>
        <SectionHeader icon={TrendingUp} title="Strength Summary" subtitle="Skill areas where the candidate performed well" />
        <div className="grid sm:grid-cols-2 gap-3">
          {strengthCards.map((card) => (
            <SkillCardView key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* SECTION 3 — Improvement Areas */}
      <section>
        <SectionHeader icon={TrendingDown} title="Improvement Areas" subtitle="Topics to probe in the next round" />
        <div className="grid sm:grid-cols-2 gap-3">
          {improvementCards.map((card) => (
            <SkillCardView key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* SECTION 4 & 5 — Top answers */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <SectionHeader icon={Award} title="Top 5 Best Answers" />
          <div className="space-y-3">
            {topBest.length ? (
              topBest.map((item) => (
                <div
                  key={item.question_index}
                  className="rounded-xl border border-emerald-200/80 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/25 p-4"
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Best Answer #{item.rank}
                    {item.score_display ? ` · ${item.score_display}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{item.question}</p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">Reason: </span>
                    {item.reason}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No scored answers available yet.</p>
            )}
          </div>
        </section>

        <section>
          <SectionHeader icon={AlertTriangle} title="Top 5 Weakest Answers" />
          <div className="space-y-3">
            {topWeakest.length ? (
              topWeakest.map((item) => (
                <div
                  key={item.question_index}
                  className="rounded-xl border border-rose-200/80 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/25 p-4"
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Weak Answer #{item.rank}
                    {item.score_display ? ` · ${item.score_display}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{item.question}</p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Reason: </span>
                    {item.reason}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No weak-answer signal yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* SECTION 6 — Follow-up questions */}
      <section className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/25 p-5">
        <SectionHeader
          icon={MessageSquareQuote}
          title="Follow-up Questions for Manager"
          subtitle="Suggested prompts for HR or L2 technical interview"
        />
        <ol className="space-y-2.5 list-none">
          {followUpQuestions.map((q, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm text-slate-800 dark:text-slate-200 bg-white/70 dark:bg-slate-900/50 rounded-lg px-3 py-2.5 border border-indigo-100 dark:border-indigo-900"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center">
                {i + 1}
              </span>
              <span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">Ask candidate: </span>
                {q}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* SECTION 7 — Question-by-question (collapsed by default) */}
      <section>
        <SectionHeader
          icon={Target}
          title="Question-by-Question Review"
          subtitle="Expand only when you need per-question detail — all data preserved below"
        />
        <div className="space-y-2">
          {questions.map((q) => {
            const open = openIdx === q.question_index;
            return (
              <motion.div
                key={q.question_index}
                layout
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : q.question_index)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Question {q.question_index}
                        {q.score_display ? ` · ${q.score_display}` : ""}
                      </span>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {q.question || "—"}
                      </p>
                    </div>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
                    >
                      <div className="px-4 py-3 grid sm:grid-cols-2 gap-2.5 bg-slate-50/40 dark:bg-slate-950/30">
                        <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/80 bg-emerald-50/80 dark:bg-emerald-950/40 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Strengths
                          </p>
                          <BulletList items={q.question_strengths} tone="strength" />
                        </div>
                        <div className="rounded-lg border border-rose-200/80 dark:border-rose-900/80 bg-rose-50/80 dark:bg-rose-950/40 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                            Weaknesses
                          </p>
                          <BulletList items={q.question_weaknesses} tone="weakness" />
                        </div>
                        {q.score_display ? (
                          <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Score</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{q.score_display}</p>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
