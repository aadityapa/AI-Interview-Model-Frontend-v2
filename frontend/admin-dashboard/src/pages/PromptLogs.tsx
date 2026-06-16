import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Trash2,
  RefreshCw,
  Coins,
  Activity,
  TrendingUp,
} from "lucide-react";
import type {
  PromptLog,
  PromptLogFilters,
  PromptLogQueryParams,
  TokenUsageStats,
} from "../api/promptLogs";
import {
  getPromptLogs,
  getPromptLogById,
  getPromptLogFilters,
  getTokenUsageStats,
  cleanupPromptLogs,
  exportPromptLogs,
} from "../api/promptLogs";

type Tab = "logs" | "stats";

const CALL_TYPE_LABELS: Record<string, string> = {
  generate_questions: "Question Generation",
  generate_one_per_skill: "Per-Skill Questions",
  generate_followup: "Follow-up Question",
  evaluate_turn: "Turn Evaluation",
  evaluate_turn_retry: "Turn Eval (retry)",
  evaluate_interview: "Interview Evaluation",
  evaluate_communication: "Communication Eval",
  extract_text_from_image: "Image OCR",
  ats_score_llm: "ATS LLM Score",
  ats_embedding: "ATS Embedding",
};

function callTypeLabel(ct: string): string {
  return CALL_TYPE_LABELS[ct] || ct;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3 h-3" /> Success
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "indigo" }: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    red: "bg-red-50 text-red-600 border-red-200",
    violet: "bg-violet-50 text-violet-600 border-violet-200",
    sky: "bg-sky-50 text-sky-600 border-sky-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.indigo}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      {sub && <div className="text-xs mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

function PromptDetail({ log, onClose }: { log: PromptLog; onClose: () => void }) {
  const sections: { title: string; content: string; lang?: string }[] = [
    { title: "System Prompt", content: log.system_prompt || "(none)" },
    { title: "User Prompt", content: log.user_prompt || "(none)" },
    { title: "Final Compiled Prompt", content: log.final_prompt || "(none)" },
    { title: "Request Payload", content: log.request_payload || "{}", lang: "json" },
    { title: "API Response", content: log.response_payload || "(none)", lang: "json" },
    ...(log.error_log ? [{ title: "Error Log", content: log.error_log }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 border border-slate-200">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Prompt Log Detail</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="font-mono">{log.id}</span>
              <StatusBadge status={log.status} />
              <span>{callTypeLabel(log.call_type)}</span>
              <span>{log.model}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Meta info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              ["Candidate", log.candidate_name || "-"],
              ["Role", log.candidate_role || "-"],
              ["Interview ID", log.interview_id || "-"],
              ["Template", log.template_name || "-"],
              ["Difficulty", log.difficulty || "-"],
              ["Skills", log.selected_skills || "-"],
              ["Model", log.model || "-"],
              ["Temperature", log.temperature != null ? String(log.temperature) : "-"],
              ["Prompt Tokens", String(log.prompt_tokens || 0)],
              ["Completion Tokens", String(log.completion_tokens || 0)],
              ["Total Tokens", String(log.total_tokens || 0)],
              ["Response Time", `${log.response_time_ms || 0}ms`],
              ["Date", log.created_date_ist || "-"],
              ["Time", log.created_time_ist || "-"],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="text-xs font-semibold text-slate-400 uppercase">{label}</div>
                <div className="text-slate-700 truncate" title={val}>{val}</div>
              </div>
            ))}
          </div>

          {/* Prompt sections */}
          {sections.map((sec) => (
            <div key={sec.title} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-200">
                {sec.title}
              </div>
              <pre className="px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-h-[400px] overflow-auto font-mono bg-white">
                {sec.content}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<PromptLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PromptLogFilters | null>(null);
  const [selectedLog, setSelectedLog] = useState<PromptLog | null>(null);
  const [params, setParams] = useState<PromptLogQueryParams>({
    limit: 25,
    offset: 0,
    sort_by: "created_at_ist",
    sort_order: "desc",
  });
  const [searchInput, setSearchInput] = useState("");

  const fetchLogs = useCallback(async (p: PromptLogQueryParams) => {
    setLoading(true);
    try {
      const [res, f] = await Promise.all([getPromptLogs(p), filters ? Promise.resolve(filters) : getPromptLogFilters()]);
      setLogs(res.logs);
      setTotal(res.total);
      if (!filters) setFilters(f as PromptLogFilters);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLogs(params); }, [params]);

  const setFilter = (key: keyof PromptLogQueryParams, val: string) => {
    setParams((p) => ({ ...p, [key]: val || undefined, offset: 0 }));
  };

  const page = Math.floor((params.offset || 0) / (params.limit || 25));
  const totalPages = Math.ceil(total / (params.limit || 25));

  const handleSearch = () => {
    setParams((p) => ({ ...p, search: searchInput || undefined, offset: 0 }));
  };

  const openDetail = async (id: string) => {
    try {
      const res = await getPromptLogById(id);
      setSelectedLog(res.log);
    } catch { /* ignore */ }
  };

  const handleExport = async () => {
    try {
      await exportPromptLogs({
        call_type: params.call_type,
        date_from: params.date_from,
        date_to: params.date_to,
      });
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by candidate, template, prompt..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch} className="px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Search
            </button>
          </div>

          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            value={params.call_type || ""}
            onChange={(e) => setFilter("call_type", e.target.value)}
          >
            <option value="">All Types</option>
            {(filters?.call_types || []).map((ct) => (
              <option key={ct} value={ct}>{callTypeLabel(ct)}</option>
            ))}
          </select>

          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            value={params.model || ""}
            onChange={(e) => setFilter("model", e.target.value)}
          >
            <option value="">All Models</option>
            {(filters?.models || []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            value={params.status || ""}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>

          <input
            type="date"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
            value={params.date_from || ""}
            onChange={(e) => setFilter("date_from", e.target.value)}
            title="From Date"
          />
          <input
            type="date"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
            value={params.date_to || ""}
            onChange={(e) => setFilter("date_to", e.target.value)}
            title="To Date"
          />

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Model</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Candidate</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Tokens</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Response</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 inline-block animate-spin mr-2" />Loading...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No prompt logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="k-hover-row hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <div>{log.created_date_ist}</div>
                      <div className="text-slate-400">{log.created_time_ist}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                        {callTypeLabel(log.call_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{log.model || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[160px] truncate" title={log.candidate_name}>
                      {log.candidate_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                      {log.total_tokens ? log.total_tokens.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {log.response_time_ms ? `${log.response_time_ms}ms` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openDetail(log.id)}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition"
                        title="View Full Prompt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing {(params.offset || 0) + 1}–{Math.min((params.offset || 0) + (params.limit || 25), total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setParams((p) => ({ ...p, offset: Math.max(0, (p.offset || 0) - (p.limit || 25)) }))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 font-semibold">
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setParams((p) => ({ ...p, offset: (p.offset || 0) + (p.limit || 25) }))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedLog && <PromptDetail log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<TokenUsageStats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTokenUsageStats(days)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [days]);

  const handleCleanup = async () => {
    if (!confirm("Remove old prompt logs (file + DB)? This cannot be undone.")) return;
    setCleaningUp(true);
    try {
      const res = await cleanupPromptLogs();
      alert(`Cleanup complete. Files removed: ${res.file_dirs_removed}, DB rows removed: ${res.db_rows_removed}`);
    } catch (e: any) {
      alert(`Cleanup failed: ${e.message}`);
    } finally {
      setCleaningUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading statistics...
      </div>
    );
  }

  const s = stats?.total_summary || { total_calls: 0, total_prompt_tokens: 0, total_completion_tokens: 0, total_tokens: 0, avg_response_ms: 0, failed_calls: 0 };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-600">Period:</label>
          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
        <button
          onClick={handleCleanup}
          disabled={cleaningUp}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" /> {cleaningUp ? "Cleaning..." : "Cleanup Old Logs"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Zap} label="Total Calls" value={s.total_calls.toLocaleString()} color="indigo" />
        <StatCard icon={Coins} label="Total Tokens" value={s.total_tokens.toLocaleString()} color="violet" />
        <StatCard icon={TrendingUp} label="Prompt Tokens" value={s.total_prompt_tokens.toLocaleString()} color="sky" />
        <StatCard icon={Activity} label="Completion Tokens" value={s.total_completion_tokens.toLocaleString()} color="emerald" />
        <StatCard icon={Clock} label="Avg Response" value={`${Math.round(s.avg_response_ms)}ms`} color="amber" />
        <StatCard icon={AlertTriangle} label="Failed Calls" value={s.failed_calls} color="red" />
      </div>

      {/* By call type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700">Token Usage by Call Type</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Type</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Calls</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Tokens</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Avg Tokens</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Avg ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(stats?.by_call_type || []).map((row) => (
                <tr key={row.call_type} className="k-hover-row hover:bg-slate-50/50">
                  <td className="px-4 py-2 text-xs font-semibold text-indigo-700">{callTypeLabel(row.call_type)}</td>
                  <td className="px-4 py-2 text-right text-xs">{row.call_count}</td>
                  <td className="px-4 py-2 text-right text-xs font-semibold">{row.tokens.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-xs">{Math.round(row.avg_tokens)}</td>
                  <td className="px-4 py-2 text-right text-xs text-slate-500">{Math.round(row.avg_response_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700">Token Usage by Model</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Model</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Calls</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(stats?.by_model || []).map((row) => (
                <tr key={row.model} className="k-hover-row hover:bg-slate-50/50">
                  <td className="px-4 py-2 text-xs font-mono text-slate-700">{row.model || "(unknown)"}</td>
                  <td className="px-4 py-2 text-right text-xs">{row.call_count}</td>
                  <td className="px-4 py-2 text-right text-xs font-semibold">{row.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most expensive + slowest */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-amber-50">
            <h3 className="text-sm font-bold text-amber-800">Most Expensive Prompts (by tokens)</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(stats?.most_expensive || []).map((row, i) => (
              <div key={row.id} className="px-4 py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-amber-700 mr-2">#{i + 1}</span>
                  <span className="font-semibold text-slate-700">{callTypeLabel(row.call_type)}</span>
                  {row.candidate_name && <span className="text-slate-400 ml-2">{row.candidate_name}</span>}
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-700">{row.total_tokens.toLocaleString()} tokens</span>
                  <span className="text-slate-400 ml-2">{row.response_time_ms}ms</span>
                </div>
              </div>
            ))}
            {(stats?.most_expensive || []).length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400 text-xs">No data</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-red-50">
            <h3 className="text-sm font-bold text-red-800">Slowest API Calls (by response time)</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(stats?.slowest_calls || []).map((row, i) => (
              <div key={row.id} className="px-4 py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-red-700 mr-2">#{i + 1}</span>
                  <span className="font-semibold text-slate-700">{callTypeLabel(row.call_type)}</span>
                  {row.candidate_name && <span className="text-slate-400 ml-2">{row.candidate_name}</span>}
                </div>
                <div className="text-right">
                  <span className="font-bold text-red-700">{row.response_time_ms.toLocaleString()}ms</span>
                  <span className="text-slate-400 ml-2">{row.total_tokens} tokens</span>
                </div>
              </div>
            ))}
            {(stats?.slowest_calls || []).length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400 text-xs">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Daily usage */}
      {(stats?.by_date || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700">Daily Usage</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Date</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Calls</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Total Tokens</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                const maxT = Math.max(...(stats?.by_date || []).map((d) => d.tokens), 1);
                return (stats?.by_date || []).map((row) => (
                  <tr key={row.date} className="k-hover-row hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-xs font-mono text-slate-700">{row.date}</td>
                    <td className="px-4 py-2 text-right text-xs">{row.call_count}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold">{row.tokens.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <div className="h-4 rounded-full bg-indigo-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.max(2, (row.tokens / maxT) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PromptLogsPage() {
  const [tab, setTab] = useState<Tab>("logs");

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">AI Prompt Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Debug, monitor, and optimize OpenAI API usage</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setTab("logs")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              tab === "logs" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Filter className="w-4 h-4" /> Logs
          </button>
          <button
            onClick={() => setTab("stats")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              tab === "stats" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
        </div>
      </div>

      {tab === "logs" ? <LogsTab /> : <StatsTab />}
    </div>
  );
}
