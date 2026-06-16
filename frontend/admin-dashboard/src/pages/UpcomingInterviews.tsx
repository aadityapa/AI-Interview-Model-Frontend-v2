import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Search, Trash2 } from "lucide-react";
import { deleteSchedule, getSchedules, type InterviewSchedule } from "../api";

const PAGE_SIZE = 10;

function safeTime(value: string) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : 0;
}

function fmtWhen(value: string) {
  const t = safeTime(value);
  if (!t) return value || "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(t));
}

function statusLabel(row: InterviewSchedule) {
  return String(row.session_status || row.status || "scheduled");
}

export function UpcomingInterviewsPage({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<InterviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<InterviewSchedule | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getSchedules());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return (rows || [])
      .filter((row) => {
        const t = safeTime(row.scheduled_at_local);
        if (filter === "upcoming" && (!t || t < now)) return false;
        if (filter !== "all" && filter !== "upcoming" && statusLabel(row).toLowerCase() !== filter) return false;
        if (!q) return true;
        return [
          row.candidate_name,
          row.candidate_email,
          row.job_title,
          row.template_name,
          row.role,
          row.opportunityId,
          row.customerName,
          statusLabel(row),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (sort === "asc" ? safeTime(a.scheduled_at_local) - safeTime(b.scheduled_at_local) : safeTime(b.scheduled_at_local) - safeTime(a.scheduled_at_local)));
  }, [rows, search, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const copyLink = async (row: InterviewSchedule) => {
    const link = row.invite_url || (row.invite_token ? `${window.location.origin}/?invite=${row.invite_token}` : "");
    if (!link) {
      setToast("No invite link available");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setToast("Interview link copied");
    } catch {
      setToast(link);
    }
    window.setTimeout(() => setToast(""), 2000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError("");
    try {
      await deleteSchedule(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      setToast("Interview deleted");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {deleteTarget ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={deleteBusy ? undefined : () => setDeleteTarget(null)} />
          <div className="absolute inset-x-0 top-24 mx-auto w-[min(460px,calc(100%-2rem))] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-lg font-extrabold text-slate-900">Delete interview?</div>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this interview/report?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="h-10 px-4 rounded-xl border border-slate-200 font-semibold" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="h-10 px-4 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-60" disabled={deleteBusy} onClick={confirmDelete}>
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </button>
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">Upcoming Interviews</h1>
          <p className="text-slate-500 mt-1">Search, sort, share, and manage scheduled candidate interviews.</p>
        </div>
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidate, template, status..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold">
          <option value="upcoming">Upcoming</option>
          <option value="all">All</option>
          <option value="scheduled">Scheduled</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="terminated">Terminated</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value === "desc" ? "desc" : "asc")} className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold">
          <option value="asc">Soonest first</option>
          <option value="desc">Latest first</option>
        </select>
      </div>

      {toast ? <div className="mt-3 text-sm font-semibold text-emerald-700">{toast}</div> : null}
      {error ? <div className="mt-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <div className="mt-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-slate-500">Loading upcoming interviews...</div>
        ) : !pageRows.length ? (
          <div className="p-10 text-center">
            <div className="font-extrabold text-slate-900">No interviews found</div>
            <div className="mt-1 text-sm text-slate-500">Scheduled interviews matching your filters will appear here.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Candidate</th>
                  <th className="px-5 py-3 text-left">Template / role</th>
                  <th className="px-5 py-3 text-left">Opportunity ID</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Scheduled time</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="k-hover-row hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{row.candidate_name || "Candidate"}</div>
                      <div className="text-xs text-slate-500">{row.candidate_email || "-"}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-semibold">{row.template_name || row.job_title || row.role || "Interview"}</td>
                    <td className="px-5 py-4 text-slate-600">{row.opportunityId || "—"}</td>
                    <td className="px-5 py-4 text-slate-600">{row.customerName || "—"}</td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{fmtWhen(row.scheduled_at_local)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold">
                        {statusLabel(row)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => copyLink(row)} className="h-9 px-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                          <Copy className="w-3.5 h-3.5" /> Link
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(row)} className="h-9 px-3 rounded-xl border border-rose-200 font-semibold text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
          <span className="text-slate-500 font-semibold">{filtered.length} interview{filtered.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button className="h-9 px-3 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span className="text-xs font-bold text-slate-500">Page {page} / {totalPages}</span>
            <button className="h-9 px-3 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
