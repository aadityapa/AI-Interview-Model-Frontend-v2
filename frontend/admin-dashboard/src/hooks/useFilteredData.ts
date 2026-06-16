import { useMemo } from "react";
import type { Candidate, Session } from "../types";
import { includesTerm } from "../utils/filterUtils";

export function useFilteredCandidates(candidates: Candidate[], searchTerm: string) {
  return useMemo(() => {
    const t = (searchTerm || "").trim();
    return (candidates || []).filter((c) => includesTerm(`${c.name} ${c.role}`, t));
  }, [candidates, searchTerm]);
}

export function useFilteredSessions(sessions: Session[], searchTerm: string) {
  return useMemo(() => {
    const t = (searchTerm || "").trim();
    return (sessions || []).filter((s) => includesTerm(`${s.name} ${s.category}`, t));
  }, [sessions, searchTerm]);
}

