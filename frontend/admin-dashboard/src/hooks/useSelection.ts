import { useCallback, useState } from "react";

export function useSelection<T extends string>() {
  const [selectedId, setSelectedId] = useState<T | null>(null);
  const clear = useCallback(() => setSelectedId(null), []);
  return { selectedId, setSelectedId, clear };
}

