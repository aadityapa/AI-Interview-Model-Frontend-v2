import { memo } from "react";
import { Calendar, LayoutTemplate, Loader2, Trash2, Users } from "lucide-react";
import type { Candidate, Interview, Session } from "../types";
import { ScoreBadge } from "./ScoreBadge";
import { StatusPill } from "./StatusPill";
import { sessionBenchmark } from "../utils/scoreUtils";
import { CrmMetaLine } from "./CrmMetaLine";

function SessionDetailImpl({
  session,
  candidates,
  onOpenCandidate,
  onRequestDeleteInterview,
  deleteBusyInterviewId = "",
}: {
  session: Session;
  candidates: Candidate[];
  onOpenCandidate: (candidateId: string) => void;
  onRequestDeleteInterview?: (candidate: Candidate, interview: Interview) => void;
  deleteBusyInterviewId?: string;
}) {
  const bench = sessionBenchmark(session.id, candidates);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 text-3xl font-black border border-violet-100">
            <LayoutTemplate className="w-10 h-10" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-violet-500 tracking-widest">Interview Template</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{session.name}</h2>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-violet-600 font-bold text-sm uppercase tracking-wider bg-violet-50 px-3 py-1 rounded-full">
                {session.category || "Template"}
              </span>
              <span className="text-slate-400 text-sm font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Latest activity: {session.date || "—"}
              </span>
            </div>
            <CrmMetaLine
              opportunityId={session.opportunityId}
              customerName={session.customerName}
              className="mt-3"
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-slate-700">{bench.attendees.length}</p>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Candidates who gave this interview</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> Candidates for this Template
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                <th className="px-8 py-4">Candidate Name</th>
                <th className="px-8 py-4">Current Role</th>
                <th className="px-8 py-4 text-center">Score</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Evaluation</th>
                {onRequestDeleteInterview ? <th className="px-8 py-4 text-right">Delete</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bench.attendees.map(({ candidate, interview }) => (
                <tr key={candidate.id} className="group k-hover-row hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200 group-hover:bg-violet-100 group-hover:text-violet-600 group-hover:border-violet-200 transition-colors">
                        {candidate.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{candidate.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{candidate.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-slate-500">{candidate.role}</td>
                  <td className="px-8 py-6 text-center">
                    <ScoreBadge score={interview.score} />
                  </td>
                  <td className="px-8 py-6">
                    <StatusPill status={interview.status} />
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => onOpenCandidate(candidate.id)}
                      className="text-violet-600 hover:text-violet-800 text-[10px] font-black uppercase tracking-widest border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-all"
                    >
                      Full Profile
                    </button>
                  </td>
                  {onRequestDeleteInterview ? (
                    <td className="px-8 py-6 text-right">
                      <button
                        type="button"
                        onClick={() => onRequestDeleteInterview(candidate, interview)}
                        disabled={deleteBusyInterviewId === interview.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-all hover:bg-rose-50 hover:text-rose-800 disabled:opacity-60 disabled:pointer-events-none"
                        title="Delete this interview/report"
                      >
                        {deleteBusyInterviewId === interview.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!bench.attendees.length ? (
                <tr>
                  <td className="px-8 py-8 text-slate-400" colSpan={onRequestDeleteInterview ? 6 : 5}>
                    No attendees found for this session.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mini analytics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Session Benchmark</p>
          <p className="text-2xl font-black text-slate-800">{bench.averageScore}%</p>
          <p className="text-xs text-slate-500 mt-1">Average across all participants</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Top Performer</p>
          <p className="text-2xl font-black text-emerald-500">{bench.topPerformer || "-"}</p>
          <p className="text-xs text-slate-500 mt-1">Highest score in this batch</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Difficulty Index</p>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <div key={star} className={`h-2 flex-1 rounded-full ${star <= bench.difficultyIndex ? "bg-indigo-500" : "bg-slate-100"}`} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Lower avg score ⇒ higher difficulty</p>
        </div>
      </div>
    </div>
  );
}

export const SessionDetail = memo(
  SessionDetailImpl,
  (prev, next) =>
    prev.session === next.session &&
    prev.candidates === next.candidates &&
    prev.onOpenCandidate === next.onOpenCandidate &&
    prev.onRequestDeleteInterview === next.onRequestDeleteInterview &&
    prev.deleteBusyInterviewId === next.deleteBusyInterviewId
);

