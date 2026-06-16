import { ChevronRight, Search, Users } from "lucide-react";
import type { GroupedReportBucket, ReportSortMode } from "../utils/reportGrouping";

const SORT_OPTIONS: { value: ReportSortMode; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "highestScore", label: "Highest Score" },
  { value: "mostCandidates", label: "Most Candidates" },
  { value: "alphabetical", label: "Alphabetical" },
];

export function ReportGroupSidebar({
  title,
  searchPlaceholder,
  groups,
  searchTerm,
  onSearchTerm,
  sortMode,
  onSortMode,
  selectedId,
  onSelect,
}: {
  title: string;
  searchPlaceholder: string;
  groups: GroupedReportBucket[];
  searchTerm: string;
  onSearchTerm: (v: string) => void;
  sortMode: ReportSortMode;
  onSortMode: (v: ReportSortMode) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[750px]">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => onSortMode(e.target.value as ReportSortMode)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={`Sort ${title}`}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {groups.map((group) => {
          const isSelected = selectedId === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={`w-full text-left p-3 rounded-xl transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100/40"
                  : "k-hover-row hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm leading-tight truncate">{group.label}</h3>
                  <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${isSelected ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>
                    {group.totalInterviews} interviews
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 opacity-60 ${isSelected ? "translate-x-1 opacity-100" : ""}`} />
              </div>
              <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300"}`}>
                <Users className="w-3 h-3" />
                {group.totalCandidates}
              </div>
            </button>
          );
        })}
        {!groups.length ? (
          <div className="p-6 text-slate-400 dark:text-slate-500 text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> No grouped reports found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
