import { useState, useEffect, useMemo, memo } from "react";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Monitor, ChevronDown, ChevronUp } from "lucide-react";
import { apiGet } from "../api/client";

interface IntegrityLog {
  candidate_name: string;
  candidate_email: string;
  template_name?: string;
  role?: string;
  reason?: string;
  terminated_at?: string;
  scheduled_at: string;
  session_status: string;
  login_attempts: number;
  verified_at: string;
  interview_started_at: string;
  interview_completed_at: string;
  violation_count: number;
  tab_switch_count?: number;
  violations_log: string | object[] | null;
  active_device_id: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", icon: <Clock className="w-3.5 h-3.5" /> },
  verified: { bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-700 dark:text-blue-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  active: { bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-700 dark:text-emerald-200", icon: <Monitor className="w-3.5 h-3.5" /> },
  completed: { bg: "bg-green-50 dark:bg-green-950/50", text: "text-green-700 dark:text-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  terminated: { bg: "bg-red-50 dark:bg-red-950/50", text: "text-red-700 dark:text-red-200", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const SUMMARY_CARDS = [
  {
    label: "Total Sessions",
    card: "bg-slate-50 border-slate-200 dark:bg-slate-800/70 dark:border-slate-600",
    valueClass: "text-slate-900 dark:text-white",
    labelClass: "text-slate-600 dark:text-slate-300",
  },
  {
    label: "Active Now",
    card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-700",
    valueClass: "text-emerald-900 dark:text-emerald-100",
    labelClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    label: "Total Violations",
    card: "bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-700",
    valueClass: "text-amber-900 dark:text-amber-100",
    labelClass: "text-amber-700 dark:text-amber-300",
  },
  {
    label: "Terminated",
    card: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-700",
    valueClass: "text-red-900 dark:text-red-100",
    labelClass: "text-red-700 dark:text-red-300",
  },
] as const;

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
          <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {status}
    </span>
  );
}

function ViolationBadge({ count }: { count: number }) {
  if (!count) return <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>;
  const color =
    count >= 4
      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200"
      : count >= 2
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      <AlertTriangle className="w-3 h-3" /> {count}
    </span>
  );
}

const ViolationDetail = memo(function ViolationDetail({ log }: { log: IntegrityLog }) {
  let violations: any[] = [];
  if (typeof log.violations_log === "string" && log.violations_log) {
    try {
      violations = JSON.parse(log.violations_log);
    } catch {
      violations = [];
    }
  } else if (Array.isArray(log.violations_log)) {
    violations = log.violations_log;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div>
          <span className="text-slate-500 dark:text-slate-400 text-xs block">Tab Switches</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{log.tab_switch_count ?? log.violation_count}</span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 text-xs block">Warning History</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {(log.tab_switch_count ?? log.violation_count) > 0 ? `${Math.min(log.tab_switch_count ?? log.violation_count, 3)} warning(s)` : "No warnings"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 text-xs block">Termination Reason</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {log.reason || "—"}
          </span>
        </div>
      </div>
      {violations.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Warning Timeline</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {violations.map((v: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2"
              >
                <span className="text-red-500 dark:text-red-400 font-bold">#{i + 1}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{v.type === "termination" ? "terminated" : "tab switch"}</span>
                <span className="text-slate-400 dark:text-slate-500 flex-1">{v.details || ""}</span>
                <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export function IntegrityLogsPage() {
  const [logs, setLogs] = useState<IntegrityLog[]>([]);
  const [terminated, setTerminated] = useState<IntegrityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ logs: IntegrityLog[]; terminated?: IntegrityLog[] }>("/interview/integrity-logs");
        if (!cancelled) setLogs(Array.isArray(data.logs) ? data.logs : []);
        if (!cancelled) setTerminated(Array.isArray(data.terminated) ? data.terminated : []);
      } catch {
        if (!cancelled) setLogs([]);
        if (!cancelled) setTerminated([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "terminated") return terminated;
    if (filter === "all") return logs;
    if (filter === "violations") return logs.filter((l) => l.violation_count > 0);
    return logs.filter((l) => l.session_status === filter);
  }, [logs, terminated, filter]);

  const summaryValues = useMemo(() => {
    const all = [...logs, ...terminated];
    const totalViolations = all.reduce((s, l) => s + (l.tab_switch_count ?? l.violation_count ?? 0), 0);
    const active = logs.filter((l) => l.session_status === "active").length;
    return {
      "Total Sessions": all.length,
      "Active Now": active,
      "Total Violations": totalViolations,
      Terminated: terminated.length,
    } as Record<(typeof SUMMARY_CARDS)[number]["label"], number>;
  }, [logs, terminated]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Interview Integrity</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tab switching warnings, history, and terminations</p>
          </div>
        </div>
      </div>

      {loading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SUMMARY_CARDS.map((card) => (
            <div key={card.label} className={`rounded-xl border p-4 ${card.card}`}>
              <div className={`text-2xl font-bold ${card.valueClass}`}>{summaryValues[card.label]}</div>
              <div className={`text-xs font-medium mt-1 ${card.labelClass}`}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {["all", "active", "completed", "violations", "terminated"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">No integrity logs found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, idx) => (
            <div
              key={`${log.candidate_email}-${log.scheduled_at}-${idx}`}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="k-hover-row w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                      {log.candidate_name || "Unknown"}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {filter === "terminated"
                        ? `${log.template_name || "Interview"}${log.role ? ` • ${log.role}` : ""}`
                        : log.candidate_email}
                    </div>
                  </div>
                  <StatusBadge status={log.session_status || "pending"} />
                  <ViolationBadge count={log.tab_switch_count ?? log.violation_count} />
                  {filter === "terminated" && log.reason ? (
                    <span className="text-xs text-rose-600 dark:text-rose-300 font-semibold truncate">{log.reason}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                  <span className="text-xs hidden md:inline">{filter === "terminated" ? log.terminated_at || log.scheduled_at || "" : log.scheduled_at || ""}</span>
                  {expandedIdx === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {expandedIdx === idx && (
                <div className="px-5 pb-4">
                  <ViolationDetail log={log} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
