/** Safe ASCII-ish filename segments for PDF downloads. */
export function slugifyPdfPart(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "candidate";
}

export function fullReportFilename(candidateName: string): string {
  return `${slugifyPdfPart(candidateName)}-full-report.pdf`;
}

export function interviewReportFilename(candidateName: string, dateLabelForFile: string): string {
  const d = slugifyPdfPart(dateLabelForFile.replace(/,/g, ""));
  return `${slugifyPdfPart(candidateName)}-interview-${d}.pdf`;
}
