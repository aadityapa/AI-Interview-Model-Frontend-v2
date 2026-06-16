import { Search, Users, ChevronRight } from "lucide-react";
import type { Candidate } from "../types";

export function CandidateSidebar({
  candidates,
  searchTerm,
  onSearchTerm,
  selectedId,
  onSelect,
}: {
  candidates: Candidate[];
  searchTerm: string;
  onSearchTerm: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Candidate Directory</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all ${
              selectedId === candidate.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "k-hover-row hover:bg-slate-50 text-slate-600"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                  selectedId === candidate.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {candidate.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight truncate">{candidate.name}</h3>
                <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70 truncate">{candidate.role}</p>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 opacity-40 ${selectedId === candidate.id ? "translate-x-1 opacity-100" : ""}`} />
          </button>
        ))}
        {!candidates.length ? (
          <div className="p-6 text-slate-400 text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> No candidates found.
          </div>
        ) : null}
      </div>
    </div>
  );
}

