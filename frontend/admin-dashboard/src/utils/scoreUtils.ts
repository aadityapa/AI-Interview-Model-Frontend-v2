import type { AtsStatus, Candidate, Interview, Session } from "../types";


export function normalizeScore(score: number): number {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function weightedCandidateScore(interviews: Interview[]): number {
  if (!interviews?.length) return 0;
  // Newer interviews count slightly more (simple deterministic weighting)
  const sorted = [...interviews].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let wSum = 0;
  let total = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const w = 1 + Math.max(0, 0.12 * (sorted.length - 1 - i));
    wSum += w;
    total += w * normalizeScore(sorted[i].score);
  }
  return wSum > 0 ? Math.round(total / wSum) : 0;
}

export function atsStatusFromScore(score: number): AtsStatus {
  const s = normalizeScore(score);
  if (s >= 85) return "Strong Match";
  if (s >= 70) return "Moderate Match";
  return "Weak Match";
}

function templateKey(i: Interview): string {
  return (i.templateId || i.templateTitle || i.sessionName || i.id || "").trim();
}

function sessionMatchesInterview(sessionId: string, i: Interview): boolean {
  if (!sessionId) return false;
  if (i.templateId && i.templateId === sessionId) return true;
  if (i.templateTitle && i.templateTitle === sessionId) return true;
  if (i.id === sessionId) return true;
  if (templateKey(i) === sessionId) return true;
  return false;
}

export function sessionBenchmark(sessionId: string, candidates: Candidate[]) {
  type Attendee = { candidate: Candidate; interview: Interview };
  const attendeesMap = new Map<string, Attendee>();

  for (const candidate of candidates) {
    let best: Interview | null = null;
    for (const interview of candidate.interviews || []) {
      if (!sessionMatchesInterview(sessionId, interview)) continue;
      if (!best) {
        best = interview;
        continue;
      }
      const bestDate = String(best.date || "");
      const curDate = String(interview.date || "");
      if (curDate > bestDate) best = interview;
      else if (curDate === bestDate && normalizeScore(interview.score) > normalizeScore(best.score)) best = interview;
    }
    if (best) attendeesMap.set(candidate.id, { candidate, interview: best });
  }

  const attendees = Array.from(attendeesMap.values());
  const scores = attendees.map((a) => normalizeScore(a.interview.score));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const sortedByScore = [...attendees].sort((a, b) => normalizeScore(b.interview.score) - normalizeScore(a.interview.score));
  const top = sortedByScore[0];
  const difficultyIndex = Math.max(1, Math.min(5, Math.round(1 + (100 - avg) / 20)));
  return {
    attendees,
    averageScore: avg,
    topPerformer: top ? top.candidate.name : "",
    difficultyIndex,
  };
}

export function ensureSessionsFromCandidates(candidates: Candidate[], fallback: Session[]): Session[] {
  const useFallback = (fallback || []).every((s) => Boolean(s.id) && (s.category || "").toLowerCase() !== "technical");

  if (useFallback && (fallback || []).length) {
    return [...fallback].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  const map = new Map<string, Session & { _candidates: Set<string> }>();
  for (const c of candidates || []) {
    for (const i of c.interviews || []) {
      const key = templateKey(i);
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: i.templateId || key,
          name: i.templateTitle || i.sessionName || "Untitled Template",
          date: i.date,
          category: "Template",
          opportunityId: i.opportunityId || "",
          customerName: i.customerName || "",
          candidate_count: 0,
          _candidates: new Set([c.id]),
        });
      } else {
        existing._candidates.add(c.id);
        if (String(i.date || "") > String(existing.date || "")) existing.date = i.date;
        if (!existing.opportunityId && i.opportunityId) existing.opportunityId = i.opportunityId;
        if (!existing.customerName && i.customerName) existing.customerName = i.customerName;
      }
    }
  }

  for (const s of fallback || []) {
    if (!map.has(s.id) && (s.category || "").toLowerCase() === "template") {
      map.set(s.id, { ...s, _candidates: new Set<string>(), candidate_count: s.candidate_count || 0 });
    }
  }

  return Array.from(map.values())
    .map((s) => {
      const count = s.candidate_count && s.candidate_count > 0 ? s.candidate_count : s._candidates.size;
      const { _candidates: _omit, ...clean } = s;
      void _omit;
      return { ...clean, candidate_count: count } as Session;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

