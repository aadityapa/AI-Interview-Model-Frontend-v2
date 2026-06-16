import { createRoot } from "react-dom/client";
import { getCandidateInterviewDetail } from "../../api";
import { CandidatePdfTemplate, type CandidatePdfAnalytics } from "../../components/pdf/CandidatePdfTemplate";
import type { CandidateInterviewHistory, CandidateInterviewSummary, InterviewRecord } from "../../types";
import { exportElementToPdf } from "./exportElementToPdf";
import { fullReportFilename } from "./filename";

function mountHost(): { host: HTMLDivElement; inner: HTMLDivElement } {
  const host = document.createElement("div");
  host.setAttribute("data-pdf-export-host", "true");
  host.style.position = "fixed";
  host.style.left = "-14000px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  const inner = document.createElement("div");
  host.appendChild(inner);
  document.body.appendChild(host);
  return { host, inner };
}

async function flushRender(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export async function generateCandidatePdf(
  candidateId: string,
  bundle: {
    candidate: CandidateInterviewHistory["candidate"];
    interviews: CandidateInterviewSummary[];
    analytics: CandidatePdfAnalytics;
  }
): Promise<void> {
  const { host, inner } = mountHost();
  const root = createRoot(inner);
  try {
    const entries = await Promise.all(
      bundle.interviews.map(async (it) => {
        try {
          const rec = await getCandidateInterviewDetail(candidateId, it.id);
          return [it.id, rec] as const;
        } catch {
          return [it.id, null] as const;
        }
      })
    );
    const qaByInterviewId = new Map<string, InterviewRecord | null>(entries);

    root.render(
      <CandidatePdfTemplate
        candidate={bundle.candidate}
        interviews={bundle.interviews}
        analytics={bundle.analytics}
        qaByInterviewId={qaByInterviewId}
      />
    );
    await flushRender();
    const el = inner.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("PDF template failed to render.");
    await exportElementToPdf(el, fullReportFilename(bundle.candidate.name));
  } finally {
    root.unmount();
    document.body.removeChild(host);
  }
}
