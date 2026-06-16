import type { StrengthsWeaknessesAnalysis, StrengthsWeaknessesQuestionItem } from "../types/strengthsWeaknesses";
import { normalizeAnalysisForManagerReview } from "./strengthsWeaknessesDisplay";

export type ManagerDashboardSnapshot = {
  candidateName: string;
  role: string;
  scorePercent: number;
  recommendation: string;
  interviewDate: string;
  aiVerdict: string;
  communicationScore?: number;
  technicalScore?: number;
};

export type SkillCard = {
  id: string;
  title: string;
  levelLabel: string;
  tone: "green" | "yellow" | "red";
  summary: string;
  bullets: string[];
};

export type HighlightAnswer = {
  rank: number;
  question_index: number;
  question: string;
  reason: string;
  score_display?: string;
};

export type ManagerDashboardView = {
  snapshot: ManagerDashboardSnapshot & {
    confidenceLevel: "High" | "Moderate" | "Low";
    hiringRecommendation: string;
  };
  strengthCards: SkillCard[];
  improvementCards: SkillCard[];
  topBest: HighlightAnswer[];
  topWeakest: HighlightAnswer[];
  followUpQuestions: string[];
  questions: StrengthsWeaknessesQuestionItem[];
};

const SKILL_THEMES: Array<{ id: string; title: string; keywords: string[]; kind: "strength" | "improvement" }> = [
  {
    id: "can",
    title: "CAN Protocol",
    keywords: ["can", "bus-off", "bus off", "ack", "arbitration", "synchron", "form error", "node state", "dbc"],
    kind: "strength",
  },
  {
    id: "uds",
    title: "UDS Diagnostics",
    keywords: ["uds", "diagnostic", "session control", "validation", "did", "dtc", "obd"],
    kind: "improvement",
  },
  {
    id: "comm",
    title: "Communication",
    keywords: ["communication", "clarity", "explained", "articulat"],
    kind: "strength",
  },
  {
    id: "trouble",
    title: "Troubleshooting",
    keywords: ["troubleshoot", "debug", "fault", "error handl", "root cause"],
    kind: "strength",
  },
  {
    id: "prod",
    title: "Production-Level Debugging",
    keywords: ["production", "real-world", "example", "hands-on", "field"],
    kind: "improvement",
  },
  {
    id: "validation",
    title: "Validation Strategy",
    keywords: ["validation", "testing", "test case", "scenario", "coverage"],
    kind: "improvement",
  },
];

function textMatchesTheme(text: string, keywords: string[]): boolean {
  const low = text.toLowerCase();
  return keywords.some((k) => low.includes(k));
}

function avgScore(items: StrengthsWeaknessesQuestionItem[]): number | null {
  const scores = items.map((q) => q.score).filter((s): s is number => s != null && Number.isFinite(s));
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function levelFromScore(avg: number | null, strengthCount: number, weaknessCount: number): { label: string; tone: "green" | "yellow" | "red" } {
  if (avg != null && avg >= 7.5 && weaknessCount <= strengthCount) return { label: "Strong", tone: "green" };
  if (avg != null && avg >= 6.5) return { label: "Good", tone: "green" };
  if (avg != null && avg >= 5) return { label: "Moderate", tone: "yellow" };
  return { label: "Needs Improvement", tone: "red" };
}

function buildSkillCards(questions: StrengthsWeaknessesQuestionItem[]): { strength: SkillCard[]; improvement: SkillCard[] } {
  const strength: SkillCard[] = [];
  const improvement: SkillCard[] = [];

  for (const theme of SKILL_THEMES) {
    const matched = questions.filter(
      (q) =>
        textMatchesTheme(q.question, theme.keywords) ||
        q.question_strengths.some((s) => textMatchesTheme(s, theme.keywords)) ||
        q.question_weaknesses.some((w) => textMatchesTheme(w, theme.keywords)),
    );
    if (!matched.length) continue;

    const bullets: string[] = [];
    for (const q of matched) {
      const pool = theme.kind === "strength" ? q.question_strengths : q.question_weaknesses;
      for (const b of pool) {
        const t = b.replace(/^[✓✗]\s*/, "").trim();
        if (t && t !== "None identified" && !bullets.includes(t)) bullets.push(t);
      }
    }
    if (!bullets.length) {
      for (const q of matched) {
        const short = q.question.length > 48 ? `${q.question.slice(0, 45)}…` : q.question;
        bullets.push(theme.kind === "strength" ? `Solid response on: ${short}` : `Gap identified on: ${short}`);
      }
    }

    const avg = avgScore(matched);
    const sCount = matched.reduce((n, q) => n + q.question_strengths.length, 0);
    const wCount = matched.reduce((n, q) => n + q.question_weaknesses.length, 0);
    const lvl = levelFromScore(avg, sCount, wCount);

    const card: SkillCard = {
      id: theme.id,
      title: theme.title,
      levelLabel: theme.kind === "improvement" && lvl.tone === "green" ? "Moderate" : lvl.label,
      tone: theme.kind === "improvement" ? (lvl.tone === "green" ? "yellow" : lvl.tone) : lvl.tone,
      summary:
        theme.kind === "strength"
          ? `Candidate demonstrated ${lvl.label.toLowerCase()} understanding in this area.`
          : `Candidate ${lvl.label.toLowerCase()} in this area.`,
      bullets: bullets.slice(0, 5),
    };

    if (theme.kind === "strength" && card.tone !== "red") strength.push(card);
    else improvement.push(card);
  }

  if (!strength.length) {
    strength.push({
      id: "foundation",
      title: "Technical Foundation",
      levelLabel: "Good",
      tone: "green",
      summary: "Candidate showed workable knowledge across assessed topics.",
      bullets: questions
        .flatMap((q) => q.question_strengths)
        .filter((b) => b && b !== "None identified")
        .slice(0, 4),
    });
  }
  if (!improvement.length) {
    improvement.push({
      id: "depth",
      title: "Technical Depth",
      levelLabel: "Moderate",
      tone: "yellow",
      summary: "Some answers could go deeper with examples and production context.",
      bullets: questions
        .flatMap((q) => q.question_weaknesses)
        .slice(0, 4),
    });
  }

  return { strength: strength.slice(0, 4), improvement: improvement.slice(0, 4) };
}

function highlightReason(q: StrengthsWeaknessesQuestionItem, kind: "best" | "weak"): string {
  if (kind === "best") {
    const s = q.question_strengths[0];
    if (s && s !== "None identified") return s.replace(/^[✓✗]\s*/, "");
    return "Strong explanation and accurate protocol understanding.";
  }
  const w = q.question_weaknesses[0];
  if (w) return w.replace(/^[✓✗]\s*/, "");
  return "Answer lacked sufficient technical depth.";
}

function buildHighlights(questions: StrengthsWeaknessesQuestionItem[], kind: "best" | "weak"): HighlightAnswer[] {
  const pool = questions.filter((q) => !q.skipped && q.score != null);
  const sorted = [...pool].sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return kind === "best" ? sb - sa : sa - sb;
  });
  return sorted.slice(0, 5).map((q, i) => ({
    rank: i + 1,
    question_index: q.question_index,
    question: q.question,
    reason: highlightReason(q, kind),
    score_display: q.score_display,
  }));
}

function buildFollowUpQuestions(
  questions: StrengthsWeaknessesQuestionItem[],
  improvementCards: SkillCard[],
  topWeakest: HighlightAnswer[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (q: string) => {
    const t = q.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };

  for (const w of topWeakest.slice(0, 3)) {
    add(`Explain your approach to: ${w.question.replace(/\?+$/, "")}?`);
  }

  for (const card of improvementCards.filter((c) => c.tone === "red").slice(0, 2)) {
    if (card.id === "uds") add("How would you structure a UDS validation flow on a new ECU?");
    else if (card.id === "prod") add("How would you debug an intermittent CAN communication failure in production?");
    else if (card.id === "validation") add("How would you validate DBC signals before vehicle integration?");
    else add(`Deep-dive on ${card.title}: describe a real project example.`);
  }

  for (const q of questions.filter((x) => x.skipped).slice(0, 2)) {
    add(`Revisit skipped topic: ${q.question.replace(/\?+$/, "")}?`);
  }

  if (!out.length) {
    add("How would you debug intermittent CAN communication failure?");
    add("Explain diagnostic session control in UDS.");
    add("How would you validate DBC signals before release?");
  }

  return out.slice(0, 6);
}

function confidenceLevel(score: number, tech?: number): "High" | "Moderate" | "Low" {
  const t = tech ?? score;
  if (score >= 70 && t >= 60) return "High";
  if (score >= 50) return "Moderate";
  return "Low";
}

function hiringRecommendation(score: number, recommendation: string): string {
  const r = recommendation.toLowerCase();
  if (r.includes("reject") || r.includes("weak")) return "Hold — verify gaps before proceeding";
  if (r.includes("hire") || r.includes("select") || r.includes("consider") || r.includes("shortlist")) {
    return score >= 65 ? "Proceed to L2" : "Proceed with caution — schedule technical deep-dive";
  }
  if (score >= 72) return "Proceed to L2";
  if (score >= 55) return "Further evaluation recommended";
  return "Hold — additional assessment advised";
}

function splitAiVerdict(raw: string): string {
  const t = raw.trim();
  if (!t || t === "—") {
    return "Good technical foundation with areas to validate in follow-up.\nNeeds improvement in weaker topics identified below.";
  }
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}\n${parts.slice(1).join(" ")}`;
  return t;
}

export function buildManagerDashboardView(
  analysis: StrengthsWeaknessesAnalysis | null,
  snapshot: ManagerDashboardSnapshot,
): ManagerDashboardView | null {
  const normalized = normalizeAnalysisForManagerReview(analysis);
  if (!normalized?.questions?.length) return null;

  const questions = normalized.questions;
  const { strength: strengthCards, improvement: improvementCards } = buildSkillCards(questions);
  const topBest = buildHighlights(questions, "best");
  const topWeakest = buildHighlights(questions, "weak");
  const followUpQuestions = buildFollowUpQuestions(questions, improvementCards, topWeakest);

  return {
    snapshot: {
      ...snapshot,
      confidenceLevel: confidenceLevel(snapshot.scorePercent, snapshot.technicalScore),
      hiringRecommendation: hiringRecommendation(snapshot.scorePercent, snapshot.recommendation),
      aiVerdict: splitAiVerdict(snapshot.aiVerdict),
    },
    strengthCards,
    improvementCards,
    topBest,
    topWeakest,
    followUpQuestions,
    questions,
  };
}
