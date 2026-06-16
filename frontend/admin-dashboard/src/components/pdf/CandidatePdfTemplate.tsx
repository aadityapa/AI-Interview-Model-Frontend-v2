import type { CSSProperties } from "react";
import type { CandidateInterviewHistory, CandidateInterviewSummary, InterviewRecord } from "../../types";
import { fmtDateLabelPdf } from "./dateFmt";
import { PdfScoreBar } from "./PdfScoreBar";

export type CandidatePdfAnalytics = {
  totalInterviews: number;
  avgScore: number;
  avgComm: number;
  avgTech: number;
  avgConf: number;
  bestScore: number;
  latestStatus: string;
  skillBreakdown: { skill: string; score: number }[];
};

function turnsFromRecord(record: InterviewRecord | null): { idx: number; q: string; a: string }[] {
  if (!record) return [];
  const qs = (record.questions || []).map((x) => String(x || ""));
  const ans = (record.answers || []).map((x) => String(x || ""));
  const max = Math.max(qs.length, ans.length);
  const out: { idx: number; q: string; a: string }[] = [];
  for (let i = 0; i < max; i++) out.push({ idx: i + 1, q: qs[i] || "", a: ans[i] || "" });
  return out.filter((t) => t.q || t.a);
}

const h2: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: 10,
  marginTop: 26,
  marginBottom: 14,
};

const card: CSSProperties = {
  border: "1px solid #e8ecf0",
  borderRadius: 10,
  padding: 16,
  marginBottom: 14,
  background: "#fff",
};

export function CandidatePdfTemplate({
  candidate,
  interviews,
  analytics,
  qaByInterviewId,
}: {
  candidate: CandidateInterviewHistory["candidate"];
  interviews: CandidateInterviewSummary[];
  analytics: CandidatePdfAnalytics;
  qaByInterviewId: Map<string, InterviewRecord | null>;
}) {
  const latest = interviews[0];
  const latestWhen = latest
    ? fmtDateLabelPdf(latest.scheduled_at_local || latest.created_at_ist || latest.created_at)
    : "—";

  return (
    <div
      style={{
        width: 794,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: 13,
        lineHeight: 1.55,
        padding: "36px 40px 40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          padding: 20,
          borderRadius: 12,
          background: "#fff",
          border: "1px solid #e8ecf0",
          borderTop: "3px solid #4f46e5",
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", color: "#1e1b4b" }}>KARNEX</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 6 }}>Complete candidate evaluation report</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#64748b" }}>
          <div style={{ fontWeight: 700, color: "#475569" }}>Generated</div>
          <div style={{ marginTop: 4 }}>{fmtDateLabelPdf(new Date().toISOString())}</div>
        </div>
      </div>

      <h2 style={{ ...h2, marginTop: 22 }}>Header</h2>
      <div style={{ ...card, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>{candidate.name}</div>
          <div style={{ color: "#475569", marginTop: 8 }}>{candidate.email}</div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.12em" }}>INTERVIEW TEMPLATE</div>
            <div style={{ color: "#1e293b", marginTop: 6, fontWeight: 600, fontSize: 14, lineHeight: 1.45 }}>{candidate.role}</div>
          </div>
          {candidate.skills?.length ? (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {candidate.skills.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>STATUS</div>
            <div style={{ fontWeight: 800 }}>{String(candidate.status || "—")}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>AVG SCORE</div>
            <div style={{ fontWeight: 800 }}>{Math.round(candidate.avg_score)}%</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>BEST</div>
            <div style={{ fontWeight: 800 }}>{analytics.bestScore}%</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>INTERVIEWS</div>
            <div style={{ fontWeight: 800 }}>{candidate.total_interviews}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>LATEST SESSION</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{latestWhen}</div>
          </div>
        </div>
      </div>

      {/* Overview — per interview */}
      <h2 style={h2}>Overview (all interviews)</h2>
      {interviews.map((it) => (
        <div key={it.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{fmtDateLabelPdf(it.scheduled_at_local || it.created_at_ist || it.created_at)}</div>
              {it.job_title ? (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: 600 }}>Template: {it.job_title}</div>
              ) : null}
            </div>
            <div style={{ fontWeight: 900 }}>{Math.round(it.score)}% overall</div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Status: {String(it.status || "—")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>COMMUNICATION</div>
              <div style={{ fontWeight: 800 }}>{Math.round(it.communication_score)}%</div>
              <PdfScoreBar value={it.communication_score} tone="violet" />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>TECHNICAL</div>
              <div style={{ fontWeight: 800 }}>{Math.round(it.technical_score)}%</div>
              <PdfScoreBar value={it.technical_score} tone="indigo" />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>CONFIDENCE</div>
              <div style={{ fontWeight: 800 }}>{Math.round(it.confidence_score)}%</div>
              <PdfScoreBar value={it.confidence_score} tone="emerald" />
            </div>
          </div>
          <div style={{ marginTop: 10, fontWeight: 800, color: "#4338ca" }}>Overall score: {Math.round(it.score)}%</div>
          {it.recommendation ? <div style={{ marginTop: 6, fontWeight: 700 }}>HR recommendation: {it.recommendation}</div> : null}
          {it.summary ? <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#334155" }}>{it.summary}</div> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#047857" }}>STRENGTHS</div>
              {it.strengths?.length ? (
                <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  {it.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12 }}>—</div>
              )}
            </div>
            <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#be123c" }}>WEAKNESSES</div>
              {it.weaknesses?.length ? (
                <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  {it.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12 }}>—</div>
              )}
            </div>
          </div>
        </div>
      ))}

      <h2 style={h2}>Questions &amp; answers (all interviews)</h2>
      {interviews.map((it) => {
        const rec = qaByInterviewId.get(it.id) ?? null;
        const turns = turnsFromRecord(rec);
        return (
          <div key={`qa-${it.id}`} style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              {fmtDateLabelPdf(it.scheduled_at_local || it.created_at_ist || it.created_at)}
              {it.job_title ? (
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", marginTop: 4 }}>Template: {it.job_title}</span>
              ) : null}
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginTop: 4 }}>Interview {it.id}</span>
            </div>
            {!turns.length ? (
              <div style={{ color: "#64748b" }}>No Q/A payload for this interview.</div>
            ) : (
              turns.map((t) => (
                <div key={t.idx} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8" }}>Q{t.idx}</div>
                  <div style={{ fontWeight: 700 }}>{t.q || "—"}</div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", marginTop: 8 }}>Answer</div>
                  <div style={{ whiteSpace: "pre-wrap", color: "#334155" }}>{t.a.trim() ? t.a : "No answer provided"}</div>
                </div>
              ))
            )}
          </div>
        );
      })}

      <h2 style={h2}>Analytics (aggregated)</h2>
      <div style={{ ...card, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Skill performance</div>
          {!analytics.skillBreakdown.length ? (
            <div style={{ color: "#64748b" }}>No per-skill breakdown.</div>
          ) : (
            analytics.skillBreakdown.map((s) => (
              <div key={s.skill} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span>{s.skill}</span>
                  <span>{s.score}%</span>
                </div>
                <PdfScoreBar value={s.score} tone="violet" />
              </div>
            ))
          )}
        </div>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Score averages</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>COMMUNICATION</div>
              <div style={{ fontWeight: 900 }}>{analytics.avgComm}%</div>
              <PdfScoreBar value={analytics.avgComm} tone="violet" />
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>TECHNICAL</div>
              <div style={{ fontWeight: 900 }}>{analytics.avgTech}%</div>
              <PdfScoreBar value={analytics.avgTech} tone="indigo" />
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>CONFIDENCE</div>
              <div style={{ fontWeight: 900 }}>{analytics.avgConf}%</div>
              <PdfScoreBar value={analytics.avgConf} tone="emerald" />
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b" }}>BEST SCORE</div>
              <div style={{ fontWeight: 900 }}>{analytics.bestScore}%</div>
              <PdfScoreBar value={analytics.bestScore} tone="amber" />
            </div>
          </div>
          <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 900 }}>Final recommendation</div>
            <div style={{ marginTop: 6 }}>{interviews[0]?.recommendation || analytics.latestStatus || "Pending review"}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
              Based on {analytics.totalInterviews} interview{analytics.totalInterviews === 1 ? "" : "s"}.
            </div>
          </div>
        </div>
      </div>

      <h2 style={h2}>Timeline</h2>
      <div style={card}>
        {interviews.map((it) => (
          <div key={`tl-${it.id}`} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 9999, background: "#4f46e5", marginTop: 6, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800 }}>{fmtDateLabelPdf(it.scheduled_at_local || it.created_at_ist || it.created_at)}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {it.job_title ? <span style={{ fontWeight: 600 }}>{it.job_title} · </span> : null}
                Score {Math.round(it.score)}% • {String(it.status || "")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
