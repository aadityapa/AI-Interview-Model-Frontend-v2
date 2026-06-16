import type { CSSProperties } from "react";
import { fmtDateLabelPdf } from "./dateFmt";
import { InterviewPdfQuestionBlock } from "./InterviewPdfQuestionBlock";
import { PdfScoreBar } from "./PdfScoreBar";
import type { InterviewPdfData } from "../../utils/pdf/buildInterviewPdfData";

const sectionTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: 10,
  marginTop: 28,
  paddingTop: 8,
  borderTop: "2px solid #e2e8f0",
};

const card: CSSProperties = {
  border: "1px solid #e8ecf0",
  borderRadius: 10,
  padding: 16,
  marginBottom: 14,
  background: "#fff",
};

const tocSections = [
  "1. Candidate Summary",
  "2. Overall Interview Feedback",
  "3. Key Strengths",
  "4. Improvement Areas",
  "5. Skill Breakdown",
  "6. Question-by-Question Analysis",
  "7. Final Recommendation",
  "8. Next Interview Guidance",
];

function BulletList({
  items,
  tone,
}: {
  items: string[];
  tone: "strength" | "weakness";
}) {
  const color = tone === "strength" ? "#064e3b" : "#9f1239";
  const mark = tone === "strength" ? "✓" : "✗";
  return (
    <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
      {items.map((line, i) => (
        <li key={i} style={{ display: "flex", gap: 8, marginBottom: 6, color, fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800, flexShrink: 0 }}>{mark}</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function InterviewPdfTemplate({ data }: { data: InterviewPdfData }) {
  const generated = fmtDateLabelPdf(new Date().toISOString());

  return (
    <div
      style={{
        width: 794,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: 13,
        lineHeight: 1.55,
        padding: "36px 40px 48px",
      }}
    >
      {/* Brand header */}
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
          marginBottom: 8,
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", color: "#1e1b4b" }}>KARNEX</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 6 }}>
            AI Interview Assessment Report
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>A4 · Professional evaluation export</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#64748b" }}>
          <div style={{ fontWeight: 700, color: "#475569" }}>Generated</div>
          <div style={{ marginTop: 4 }}>{generated}</div>
        </div>
      </div>

      {/* Table of contents */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ ...sectionTitle, marginTop: 0, borderTop: "none", paddingTop: 0 }}>Table of contents</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", fontSize: 11, color: "#475569" }}>
          {tocSections.map((s) => (
            <div key={s}>{s}</div>
          ))}
        </div>
      </div>

      {/* Section 1 — Candidate Summary */}
      <div style={sectionTitle}>1. Candidate Summary</div>
      <div style={{ ...card, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>{data.candidateName}</div>
        <div style={{ color: "#475569", marginTop: 6 }}>{data.candidateEmail}</div>
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.12em" }}>ROLE</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{data.role || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.12em" }}>INTERVIEW DATE</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{data.interviewDate}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.12em" }}>CUSTOMER</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{data.customerName || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.12em" }}>OPPORTUNITY ID</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{data.opportunityId || "—"}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {[
            ["Overall score", data.overallScore],
            ["Technical", data.technicalScore],
            ["Communication", data.communicationScore],
            ["Problem solving", data.problemSolvingScore],
            ["Confidence", data.confidenceScore],
          ].map(([label, val]) => (
            <div key={String(label)} style={{ background: "#f8fafc", borderRadius: 8, padding: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.1em" }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{val}%</div>
              <PdfScoreBar value={Number(val)} tone="indigo" />
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 800, color: "#4338ca", letterSpacing: "0.12em" }}>FINAL RECOMMENDATION</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#312e81", marginTop: 6 }}>{data.finalRecommendationLabel}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
            Hiring status: <strong>{data.hiringStatus}</strong> · Model: <strong>{data.modelRecommendation}</strong>
          </div>
        </div>
      </div>

      {/* Section 2 — Overall Interview Feedback */}
      <div style={sectionTitle}>2. Overall Interview Feedback</div>
      <div style={card}>
        <div style={{ whiteSpace: "pre-wrap", color: "#334155", fontSize: 13, lineHeight: 1.65 }}>
          {data.overallFeedback}
        </div>
        {data.managerDashboard?.snapshot.aiVerdict &&
        data.managerDashboard.snapshot.aiVerdict !== data.overallFeedback ? (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#6366f1", letterSpacing: "0.12em" }}>AI VERDICT</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "#334155", fontSize: 12 }}>
              {data.managerDashboard.snapshot.aiVerdict}
            </div>
          </div>
        ) : null}
      </div>

      {/* Section 3 — Key Strengths */}
      <div style={sectionTitle}>3. Key Strengths</div>
      <div style={{ ...card, background: "#ecfdf5", borderColor: "#a7f3d0" }}>
        <BulletList items={data.strengths} tone="strength" />
      </div>

      {/* Section 4 — Improvement Areas */}
      <div style={sectionTitle}>4. Improvement Areas</div>
      <div style={{ ...card, background: "#fff1f2", borderColor: "#fecdd3" }}>
        <BulletList items={data.improvementAreas} tone="weakness" />
      </div>

      {/* Section 5 — Skill Breakdown */}
      <div style={sectionTitle}>5. Skill Breakdown</div>
      <div style={card}>
        {data.skillBreakdown.length ? (
          data.skillBreakdown.map((sb) => (
            <div key={sb.skill} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span>{sb.skill}</span>
                <span>{Math.round(sb.score)}%</span>
              </div>
              <PdfScoreBar value={sb.score} tone="violet" />
            </div>
          ))
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>No per-skill breakdown for this interview.</div>
        )}
      </div>

      {/* Section 6 — Question-by-Question Analysis */}
      <div style={sectionTitle}>6. Question-by-Question Analysis</div>
      <div style={card}>
        {!data.turns.length ? (
          <div style={{ color: "#64748b" }}>No question/answer payload found for this interview.</div>
        ) : (
          data.turns.map((t) => <InterviewPdfQuestionBlock key={t.idx} turn={t} />)
        )}
      </div>

      {/* Section 7 — Final Recommendation */}
      <div style={sectionTitle}>7. Final Recommendation</div>
      <div style={{ ...card, background: "#eef2ff", borderColor: "#c7d2fe" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#312e81" }}>{data.finalRecommendationLabel}</div>
        <div style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "#334155", fontSize: 12, lineHeight: 1.65 }}>
          {data.finalRecommendationReasoning}
        </div>
        {data.managerDashboard ? (
          <div style={{ marginTop: 14, fontSize: 11, color: "#4338ca", fontWeight: 700 }}>
            Manager guidance: {data.managerDashboard.snapshot.hiringRecommendation} · Confidence:{" "}
            {data.managerDashboard.snapshot.confidenceLevel}
          </div>
        ) : null}
      </div>

      {/* Manager follow-ups (aggregate) */}
      {data.managerDashboard?.followUpQuestions.length ? (
        <>
          <div style={{ ...sectionTitle, fontSize: 9, marginTop: 16, borderTop: "none" }}>
            Suggested manager follow-up questions
          </div>
          <div style={{ ...card, background: "#fffbeb", borderColor: "#fde68a" }}>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#78350f" }}>
              {data.managerDashboard.followUpQuestions.map((q, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {q}
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}

      {/* Section 8 — Next Interview Guidance */}
      <div style={sectionTitle}>8. Next Interview Guidance</div>
      <div style={card}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>FOCUS AREAS FOR NEXT ROUND</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#334155" }}>
          {data.nextInterviewFocusAreas.map((area, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {area}
            </li>
          ))}
        </ol>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: "1px solid #e2e8f0",
          fontSize: 10,
          color: "#94a3b8",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Interview ID: {data.interviewId}</span>
        <span>KARNEX · Confidential assessment document</span>
      </div>
    </div>
  );
}
