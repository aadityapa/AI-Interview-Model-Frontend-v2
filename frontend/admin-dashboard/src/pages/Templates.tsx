import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { apiDelete, apiGet } from "../api/client";

type JobConfig = {
  jobId: string;
  jobTitle: string;
  domain?: string;
  opportunityId?: string;
  customerName?: string;
  requiredSkills?: string[];
  optionalSkills?: string[];
  expMin?: number;
  expMax?: number;
  generatedPrompt?: string;
  editedPrompt?: string;
  weights?: Record<string, unknown>;
};

export function TemplatesPage({
  onCreateTemplate,
  onEditTemplate,
}: {
  onCreateTemplate: () => void;
  onEditTemplate: (jobId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<JobConfig[]>([]);
  const [deletingId, setDeletingId] = useState<string>("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<{ jobs: JobConfig[] }>("/job/configs", { force: true });
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...(jobs || [])].sort((a, b) => String(a.jobTitle || "").localeCompare(String(b.jobTitle || "")));
  }, [jobs]);

  const deleteTemplate = async (jobId: string) => {
    const ok = window.confirm("Delete this template? This cannot be undone.");
    if (!ok) return;
    try {
      setDeletingId(jobId);
      setError("");
      await apiDelete<{ status: string; jobId: string }>(`/job/config/${encodeURIComponent(jobId)}`);
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Interview Templates</h1>
          <p className="text-slate-500 mt-1">Create and manage job templates used in HR setup and ATS scoring.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 transition disabled:opacity-60"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 text-indigo-600" />
            Refresh
          </button>
          <button
            onClick={onCreateTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 bg-white border border-rose-200 rounded-2xl p-6 text-rose-700">
          <div className="font-extrabold">Templates error</div>
          <div className="mt-2 text-sm text-rose-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="md:col-span-2 xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-8 text-slate-500">
            Loading templates…
          </div>
        ) : !sorted.length ? (
          <div className="md:col-span-2 xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight">No templates yet</div>
                <div className="mt-1 text-sm text-slate-500">
                  Create your first job template. HR will be able to choose it in the HR Setup screen.
                </div>
                <button
                  onClick={onCreateTemplate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Create Template
                </button>
              </div>
            </div>
          </div>
        ) : (
          sorted.map((j) => (
            <div key={j.jobId} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition-shadow hover:border-slate-300">
              {(() => {
                const hasCustomPrompt = Boolean(String(j.editedPrompt || "").trim());
                const adaptiveEnabled = Boolean((j.weights || {})["adaptiveNextQuestion"]);
                return (
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        hasCustomPrompt
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {hasCustomPrompt ? "Custom Prompt" : "Default Prompt"}
                    </span>
                    {adaptiveEnabled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Adaptive
                      </span>
                    ) : null}
                  </div>
                );
              })()}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-extrabold tracking-tight text-slate-900 truncate">{j.jobTitle || "Untitled"}</div>
                  <div className="mt-1 text-xs text-slate-500 truncate">{j.domain || "No domain"}</div>
                  <div className="mt-3 text-xs text-slate-500 space-y-1">
                    <div><span className="font-bold text-slate-700">Opportunity:</span> {j.opportunityId || "—"}</div>
                    <div><span className="font-bold text-slate-700">Customer:</span> {j.customerName || "—"}</div>
                    <div><span className="font-bold text-slate-700">Required:</span> {(j.requiredSkills || []).slice(0, 8).join(", ") || "—"}</div>
                    <div><span className="font-bold text-slate-700">Optional:</span> {(j.optionalSkills || []).slice(0, 8).join(", ") || "—"}</div>
                    <div><span className="font-bold text-slate-700">Experience:</span> {j.expMin ?? 0}–{j.expMax ?? 0} yrs</div>
                  </div>
                </div>
                <button
                  onClick={() => onEditTemplate(j.jobId)}
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold text-slate-700 inline-flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4 text-indigo-600" />
                  Edit
                </button>
              </div>

              <div className="mt-4 text-xs text-slate-400">
                Job ID: <span className="font-mono">{j.jobId}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
              <a
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition"
                href="/?focus=template"
                target="_blank"
                rel="noreferrer"
              >
                Use in HR Setup <ArrowUpRight className="w-4 h-4" />
              </a>
                <button
                  onClick={() => deleteTemplate(j.jobId)}
                  disabled={deletingId === j.jobId}
                  className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 transition flex items-center justify-center text-slate-600 hover:text-rose-700 disabled:opacity-60"
                  title="Delete template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

