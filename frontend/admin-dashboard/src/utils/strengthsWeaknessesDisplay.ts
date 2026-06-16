import type { StrengthsWeaknessesAnalysis, StrengthsWeaknessesQuestionItem } from "../types/strengthsWeaknesses";

const SKIP_ANSWERS = new Set(["skip", "skipped", "[skipped]"]);
const PLACEHOLDER = new Set(["", "-", "—", "n/a", "none"]);

function cleanBullets(items: string[] | undefined): string[] {
  return (items || [])
    .map((x) => String(x || "").trim())
    .filter((t) => t && !PLACEHOLDER.has(t.toLowerCase()));
}

function isSkipped(answer: string): boolean {
  return SKIP_ANSWERS.has(String(answer || "").trim().toLowerCase());
}

/** Client-side display guard for legacy cached analysis (v1). */
export function normalizeQuestionForManagerReview(q: StrengthsWeaknessesQuestionItem): StrengthsWeaknessesQuestionItem {
  const skipped = q.skipped ?? isSkipped(q.answer);
  let strengths = cleanBullets(q.question_strengths);
  let weaknesses = cleanBullets(q.question_weaknesses);
  const score = q.score ?? null;

  if (skipped) {
    strengths = ["None identified"];
    weaknesses = [
      "Question was skipped",
      "Knowledge area not demonstrated",
      "Unable to evaluate practical understanding",
    ];
  } else {
    if (!strengths.length) {
      strengths =
        score != null && score >= 7
          ? ["Demonstrated solid understanding of the topic"]
          : q.answer
            ? ["Some relevant points were mentioned"]
            : ["Limited response — partial signal only"];
    }
    if (!weaknesses.length) {
      weaknesses =
        score != null && score >= 7
          ? ["Could provide more production-level examples", "Could discuss performance considerations"]
          : q.answer
            ? ["Answer lacked sufficient technical depth", "Key concepts were missing or incomplete"]
            : ["No substantive answer provided"];
    }
  }

  return {
    ...q,
    skipped,
    question_strengths: strengths.slice(0, 4),
    question_weaknesses: weaknesses.slice(0, 4),
  };
}

export function normalizeAnalysisForManagerReview(
  analysis: StrengthsWeaknessesAnalysis | null,
): StrengthsWeaknessesAnalysis | null {
  if (!analysis?.questions?.length) return analysis;

  const questions = analysis.questions.map(normalizeQuestionForManagerReview);
  const overall_strengths = cleanBullets(
    analysis.overall_key_strengths?.length
      ? analysis.overall_key_strengths
      : analysis.overall_strengths,
  );
  const overall_weaknesses = cleanBullets(
    analysis.overall_improvement_areas?.length
      ? analysis.overall_improvement_areas
      : analysis.overall_weaknesses,
  );

  let discussion_points = analysis.discussion_points || [];
  if (!discussion_points.length) {
    discussion_points = questions
      .filter((q) => {
        if (q.skipped) return true;
        if (q.score != null && q.score < 6) return true;
        return cleanBullets(q.question_weaknesses).length >= 2;
      })
      .slice(0, 12)
      .map((q) => ({
        question_index: q.question_index,
        reason: q.skipped
          ? "Question was skipped — revisit in follow-up."
          : q.score != null && q.score < 6
            ? "Weak technical depth detected."
            : "Multiple improvement areas identified.",
      }));
  }

  return {
    ...analysis,
    questions,
    overall_strengths: overall_strengths.length ? overall_strengths : ["Demonstrated foundational knowledge in assessed areas"],
    overall_weaknesses: overall_weaknesses.length
      ? overall_weaknesses
      : ["Some topics need deeper follow-up in the next interview round"],
    overall_key_strengths: overall_strengths.length ? overall_strengths : ["Demonstrated foundational knowledge in assessed areas"],
    overall_improvement_areas: overall_weaknesses.length
      ? overall_weaknesses
      : ["Some topics need deeper follow-up in the next interview round"],
    discussion_points,
  };
}
