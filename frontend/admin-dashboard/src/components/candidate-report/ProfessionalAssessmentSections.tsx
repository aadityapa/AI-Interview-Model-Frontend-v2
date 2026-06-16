import type { DimensionScores, EnrichedTurn } from "../../utils/reportExtract";
import { turnHasProfessionalAssessment } from "../../utils/reportExtract";

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="text-indigo-600 dark:text-indigo-300">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function DimensionGrid({ scores }: { scores: DimensionScores }) {
  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 p-4 space-y-3">
      <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wide">
        Dimension scores
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <DimensionBar label="Technical accuracy" value={scores.technicalAccuracy} />
        <DimensionBar label="Concept coverage" value={scores.conceptCoverage} />
        <DimensionBar label="Depth of explanation" value={scores.depth} />
        <DimensionBar label="Communication quality" value={scores.communication} />
        <DimensionBar label="Confidence level" value={scores.confidence} />
      </div>
    </div>
  );
}

function LegacyStrengthsWeaknesses({ turn }: { turn: EnrichedTurn }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
        <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Strengths</p>
        <ul className="mt-2 text-sm text-emerald-900 dark:text-emerald-100 list-disc pl-4 space-y-1">
          {(turn.strengths.length ? turn.strengths : ["—"]).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-3">
        <p className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-300">Weaknesses</p>
        <ul className="mt-2 text-sm text-rose-900 dark:text-rose-100 list-disc pl-4 space-y-1">
          {(turn.weaknesses.length ? turn.weaknesses : ["—"]).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProfessionalAssessmentSections({ turn }: { turn: EnrichedTurn }) {
  const professional = turnHasProfessionalAssessment(turn);
  const rating =
    turn.overallRating != null
      ? turn.overallRating
      : turn.score != null
        ? Math.round((turn.score / 10) * 10) / 10
        : null;
  const modelAnswer = turn.expectedAnswer || turn.idealAnswer;

  if (!professional) {
    return (
      <div className="space-y-4">
        {turn.feedback ? (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">AI evaluation</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{turn.feedback}</p>
          </div>
        ) : null}
        <LegacyStrengthsWeaknesses turn={turn} />
        {modelAnswer ? (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-3">
            <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300">
              Suggested ideal answer
            </p>
            <p className="mt-2 text-sm text-indigo-950 dark:text-indigo-100 whitespace-pre-wrap">{modelAnswer}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4">
        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Evaluation summary</p>
        {rating != null ? (
          <p className="mt-1 text-sm font-black text-indigo-700 dark:text-indigo-300">
            Overall rating: {rating}/10
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
          {turn.evaluationSummary || turn.feedback || "—"}
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/25 p-4">
        <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
          What candidate explained correctly
        </p>
        {turn.correctConcepts.length ? (
          <ol className="mt-3 space-y-3 list-decimal pl-5">
            {turn.correctConcepts.map((item, i) => (
              <li key={i} className="text-sm text-emerald-950 dark:text-emerald-100">
                <span className="font-bold">✅ {item.topic}</span>
                <p className="mt-0.5 text-emerald-900/90 dark:text-emerald-100/90">{item.explanation}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
            No significant technical strengths identified.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/25 p-4">
        <p className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-300">Areas for improvement</p>
        {turn.improvementAreas.length ? (
          <ol className="mt-3 space-y-3 list-decimal pl-5">
            {turn.improvementAreas.map((item, i) => (
              <li key={i} className="text-sm text-rose-950 dark:text-rose-100">
                <span className="font-bold">❌ {item.topic}</span>
                <p className="mt-0.5">{item.explanation}</p>
                {item.correction ? (
                  <p className="mt-1 text-xs text-rose-800/90 dark:text-rose-200/90">
                    <span className="font-bold">Correction: </span>
                    {item.correction}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : turn.weaknesses.length ? (
          <ul className="mt-2 text-sm text-rose-900 dark:text-rose-100 list-disc pl-4 space-y-1">
            {turn.weaknesses.map((s, i) => (
              <li key={i}>❌ {s}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-rose-900 dark:text-rose-100">—</p>
        )}
      </div>

      {modelAnswer ? (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-4">
          <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300">
            Expected interview answer (9–10/10)
          </p>
          <p className="mt-2 text-sm text-indigo-950 dark:text-indigo-100 whitespace-pre-wrap leading-relaxed">
            {modelAnswer}
          </p>
        </div>
      ) : null}

      {turn.interviewFeedback ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 p-4">
          <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Interview feedback</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {turn.interviewFeedback}
          </p>
        </div>
      ) : null}

      {turn.followUpQuestions.length ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/25 p-4">
          <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">
            Manager follow-up questions
          </p>
          <ul className="mt-2 text-sm text-amber-950 dark:text-amber-100 list-disc pl-4 space-y-1.5">
            {turn.followUpQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {turn.dimensionScores ? <DimensionGrid scores={turn.dimensionScores} /> : null}
    </div>
  );
}
