import { memo } from "react";
import { ClipboardList, LayoutTemplate, Search, Users } from "lucide-react";
import type { Session } from "../types";

function SessionSidebarImpl({
  sessions,
  searchTerm,
  onSearchTerm,
  selectedId,
  onSelect,
}: {
  sessions: Session[];
  searchTerm: string;
  onSearchTerm: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Templates</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((session) => {
          const count = Number(session.candidate_count ?? 0);
          const isSelected = selectedId === session.id;
          return (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition-all ${
                isSelected ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "k-hover-row hover:bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-indigo-500"
                  }`}
                >
                  <LayoutTemplate className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm leading-tight truncate">{session.name}</h3>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70 truncate">
                    {session.opportunityId ? `Opp: ${session.opportunityId}` : session.customerName ? session.customerName : `Latest • ${session.date || "—"}`}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600"
                }`}
                title="Candidates who took this template"
              >
                <Users className="w-3 h-3" />
                {count}
              </span>
            </button>
          );
        })}
        {!sessions.length ? (
          <div className="p-6 text-slate-400 text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> No templates found.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const SessionSidebar = memo(SessionSidebarImpl);

