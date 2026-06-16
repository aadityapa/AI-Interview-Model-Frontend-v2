import { Dashboard as CandidateSessionDashboard } from "./Dashboard";

export function CandidatesPage({
  onOpenCandidateReport,
}: {
  onOpenCandidateReport?: (candidateId: string, interviewId?: string) => void;
}) {
  return <CandidateSessionDashboard onOpenCandidateReport={onOpenCandidateReport} />;
}
