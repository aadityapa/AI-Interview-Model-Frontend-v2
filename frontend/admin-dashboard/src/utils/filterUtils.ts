export function includesTerm(hay: string, term: string): boolean {
  const h = (hay || "").toLowerCase();
  const t = (term || "").toLowerCase().trim();
  if (!t) return true;
  return h.includes(t);
}

