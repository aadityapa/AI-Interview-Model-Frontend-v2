type AtsResult = {
  atsScore?: number;
  grade?: string;
  hireProbability?: string;
  strongSkills?: string[];
  missingSkills?: string[];
  recommendation?: string;
  meta?: any;
};
import { useMemo, useState } from "react";
import { Calculator, FileText, Sparkles, UploadCloud, X } from "lucide-react";
import { authFetch } from "../api/client";

function formatBytes(bytes: number) {
  const b = Number(bytes || 0);
  if (!Number.isFinite(b) || b <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function AtsPage() {
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AtsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);

  const canCompute = useMemo(() => Boolean(jdFile && cvFile && !busy), [jdFile, cvFile, busy]);

  const compute = async () => {
    if (!jdFile || !cvFile) return;
    setBusy(true);
    try {
      setError("");
      setPreview(null);
      const fd = new FormData();
      fd.append("jd_file", jdFile);
      fd.append("cv_file", cvFile);
      fd.append("model", "gpt-4o-mini");
      const res = await authFetch("/ats/score/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `ATS failed (${res.status})`);
      setPreview(data as AtsResult);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">ATS Scoring</h1>
          <p className="text-slate-500 mt-1">Upload JD and CV to compute ATS score</p>
        </div>
        <div className="flex items-center gap-2">
          {(jdFile || cvFile) && !busy ? (
            <button
              onClick={() => {
                setJdFile(null);
                setCvFile(null);
                setPreview(null);
                setError("");
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4 text-slate-500" />
              Clear
            </button>
          ) : null}
          <button
            onClick={compute}
            disabled={!canCompute}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {busy ? "Computing…" : "Compute ATS Score"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 bg-white border border-rose-200 rounded-2xl p-6 text-rose-700">
          <div className="font-extrabold">ATS error</div>
          <div className="mt-2 text-sm text-rose-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight">Upload documents</div>
              <div className="text-xs text-slate-500 mt-0.5">Upload JD and CV. The server extracts text and scores using OpenAI when available.</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40 hover:bg-slate-50/60 transition-colors">
              <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Job Description (JD)</div>
              <label className="mt-3 block">
                <input
                  type="file"
                  onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-indigo-700"
                />
              </label>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="truncate">{jdFile ? jdFile.name : "No file selected"}</span>
                {jdFile ? <span className="text-slate-400">• {formatBytes(jdFile.size)}</span> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40 hover:bg-slate-50/60 transition-colors">
              <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Candidate CV</div>
              <label className="mt-3 block">
                <input
                  type="file"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-indigo-700"
                />
              </label>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="truncate">{cvFile ? cvFile.name : "No file selected"}</span>
                {cvFile ? <span className="text-slate-400">• {formatBytes(cvFile.size)}</span> : null}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-500">
              Tip: Use PDF/DOCX/TXT/Images. Larger docs may take longer.
            </div>
            <div className="text-[11px] text-slate-400">
              Endpoint: <span className="font-mono">/ats/score/upload</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight">Results</div>
              <div className="text-xs text-slate-500 mt-0.5">ATS score and key gaps</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile label="ATS score" value={preview?.atsScore !== undefined ? String(preview.atsScore) : "—"} icon={<Calculator className="w-5 h-5" />} />
            <StatTile label="Grade" value={preview?.grade || "—"} icon={<Sparkles className="w-5 h-5" />} />
            <StatTile label="Hire probability" value={preview?.hireProbability || "—"} icon={<Sparkles className="w-5 h-5" />} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="bg-slate-50/40 border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Strong skills</div>
              <div className="mt-2 text-sm text-slate-700">
                {(preview?.strongSkills || []).length ? (preview?.strongSkills || []).join(", ") : "—"}
              </div>
            </div>
            <div className="bg-slate-50/40 border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Missing skills</div>
              <div className="mt-2 text-sm text-slate-700">
                {(preview?.missingSkills || []).length ? (preview?.missingSkills || []).join(", ") : "—"}
              </div>
            </div>
            {preview?.recommendation ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Recommendation</div>
                <div className="mt-2 text-sm text-slate-700">{preview.recommendation}</div>
              </div>
            ) : null}
            {preview?.meta?.mode ? (
              <div className="text-[11px] text-slate-400">
                Mode: <span className="font-semibold text-slate-600">{String(preview.meta.mode)}</span>
                {preview.meta.model ? (
                  <>
                    {" "}
                    • Model: <span className="font-semibold text-slate-600">{String(preview.meta.model)}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

