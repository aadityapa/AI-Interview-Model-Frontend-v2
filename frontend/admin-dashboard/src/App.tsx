import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BarChart3, ClipboardList, LayoutTemplate, Sigma, Users, Terminal, Shield, Moon, Sun, LogOut } from "lucide-react";
import { KarnexBranding } from "./components/KarnexBranding";
import { useTheme } from "./theme/ThemeProvider";
import { performAdminLogout } from "./lib/adminLogout";
import { navButtonMotion, pageSurfaceMotion, routeSurfaceKey } from "./lib/motionPresets";
import type { CandidateReportReturnTarget } from "./pages/CandidateReportPage";

const HrDashboard = lazy(() => import("./pages/HrDashboard").then((m) => ({ default: m.HrDashboard })));
const TemplatesPage = lazy(() => import("./pages/Templates").then((m) => ({ default: m.TemplatesPage })));
const CandidatesPage = lazy(() => import("./pages/Candidates").then((m) => ({ default: m.CandidatesPage })));
const AtsPage = lazy(() => import("./pages/ATS").then((m) => ({ default: m.AtsPage })));
const TemplateFormPage = lazy(() => import("./pages/TemplateForm").then((m) => ({ default: m.TemplateFormPage })));
const CandidateInterviewsPage = lazy(() =>
  import("./pages/CandidateInterviews").then((m) => ({ default: m.CandidateInterviewsPage })),
);
const CandidateReportPage = lazy(() => import("./pages/CandidateReportPage").then((m) => ({ default: m.CandidateReportPage })));
const PromptLogsPage = lazy(() => import("./pages/PromptLogs").then((m) => ({ default: m.PromptLogsPage })));
const IntegrityLogsPage = lazy(() => import("./pages/IntegrityLogs").then((m) => ({ default: m.IntegrityLogsPage })));
const UpcomingInterviewsPage = lazy(() => import("./pages/UpcomingInterviews").then((m) => ({ default: m.UpcomingInterviewsPage })));

type View =
  | "dashboard"
  | "templates"
  | "candidates"
  | "ats"
  | "promptLogs"
  | "integrityLogs"
  | "templateForm"
  | "candidateInterviews"
  | "candidateReport"
  | "upcomingInterviews";

type NavExtras = { reportInterviewId?: string; reportReturnTo?: CandidateReportReturnTarget };

const HR_PRIMARY_NAV: { target: View; label: string; icon: LucideIcon; active: (v: View) => boolean }[] = [
  { target: "dashboard", label: "Dashboard", icon: BarChart3, active: (v) => v === "dashboard" || v === "candidateInterviews" },
  { target: "templates", label: "Templates", icon: LayoutTemplate, active: (v) => v === "templates" },
  { target: "candidates", label: "Reports", icon: Users, active: (v) => v === "candidates" || v === "candidateReport" },
  { target: "ats", label: "ATS", icon: Sigma, active: (v) => v === "ats" },
  { target: "promptLogs", label: "AI Logs", icon: Terminal, active: (v) => v === "promptLogs" },
  { target: "integrityLogs", label: "Integrity", icon: Shield, active: (v) => v === "integrityLogs" },
];

function readInitial(): {
  view: View;
  candidateId: string;
  reportInterviewId: string;
  reportReturnTo: CandidateReportReturnTarget;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view") || "";
    const cid = params.get("cid") || "";
    const iid = params.get("iid") || "";
    const ret: CandidateReportReturnTarget = params.get("ret") === "dashboard" ? "dashboard" : "candidates";
    if (v === "candidateReport" && cid) {
      return { view: "candidateReport", candidateId: cid, reportInterviewId: iid, reportReturnTo: ret };
    }
    if (v === "candidateInterviews" && cid) {
      return { view: "candidateInterviews", candidateId: cid, reportInterviewId: "", reportReturnTo: "candidates" };
    }
    if (v === "ats" || v === "templates" || v === "dashboard" || v === "candidates" || v === "promptLogs" || v === "integrityLogs" || v === "upcomingInterviews") {
      return { view: v as View, candidateId: "", reportInterviewId: "", reportReturnTo: "candidates" };
    }
  } catch (_) {}
  return { view: "dashboard", candidateId: "", reportInterviewId: "", reportReturnTo: "candidates" };
}

function pushNav(view: View, candidateId: string, extras: NavExtras = {}) {
  try {
    const params = new URLSearchParams(window.location.search);
    params.delete("iid");
    params.delete("ret");

    if (view === "candidateReport" && candidateId) {
      params.set("view", "candidateReport");
      params.set("cid", candidateId);
      if (extras.reportInterviewId) params.set("iid", extras.reportInterviewId);
      if (extras.reportReturnTo === "dashboard") params.set("ret", "dashboard");
    } else if (view === "candidateInterviews" && candidateId) {
      params.set("view", "candidateInterviews");
      params.set("cid", candidateId);
    } else {
      params.delete("cid");
      if (view && view !== "templateForm") {
        params.set("view", view);
      } else {
        params.delete("view");
      }
    }
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.pushState({}, "", url);
  } catch (_) {}
}

function PageFallback() {
  return (
    <div className="flex min-h-[42vh] w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
        Loading…
      </div>
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const initial = readInitial();
  const [view, setView] = useState<View>(initial.view);
  const [candidateId, setCandidateId] = useState<string>(initial.candidateId);
  const [reportInterviewId, setReportInterviewId] = useState<string>(initial.reportInterviewId);
  const [reportReturnTo, setReportReturnTo] = useState<CandidateReportReturnTarget>(initial.reportReturnTo);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const surfaceKey = routeSurfaceKey(view, candidateId);
  const pageMotion = pageSurfaceMotion(surfaceKey, !!reduceMotion);
  const navMotion = navButtonMotion(!!reduceMotion);

  useEffect(() => {
    const onPop = () => {
      const next = readInitial();
      setView(next.view);
      setCandidateId(next.candidateId);
      setReportInterviewId(next.reportInterviewId);
      setReportReturnTo(next.reportReturnTo);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goView = (v: View, cid = "") => {
    setView(v);
    setCandidateId(cid);
    setReportInterviewId("");
    setReportReturnTo("candidates");
    pushNav(v, cid);
  };

  const goCandidateReport = (cid: string, interviewId?: string, ret: CandidateReportReturnTarget = "candidates") => {
    setView("candidateReport");
    setCandidateId(cid);
    setReportInterviewId(interviewId || "");
    setReportReturnTo(ret);
    pushNav("candidateReport", cid, { reportInterviewId: interviewId, reportReturnTo: ret });
  };

  const openHrFlow = (focus: "template" | "invite") => {
    const origin = window.location.origin;
    const url = `${origin}/?focus=${encodeURIComponent(focus)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <KarnexBranding size="sm" />

          <nav className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-inner flex-1 justify-center min-w-0">
            {HR_PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.active(view);
              return (
                <motion.button
                  key={item.target}
                  type="button"
                  {...navMotion}
                  onClick={() => goView(item.target)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                    isActive
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </motion.button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void performAdminLogout()}
              className="inline-flex h-10 items-center gap-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-900 hover:text-rose-700 dark:hover:text-rose-300 transition text-sm font-semibold"
              title="Log out and return to login"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ClipboardList className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="font-semibold">HR/Admin</span>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={<PageFallback />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={surfaceKey}
            className="min-h-[calc(100vh-4rem)]"
            variants={pageMotion.variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageMotion.transition}
          >
            {view === "dashboard" ? (
              <HrDashboard
                onCreateTemplate={() => {
                  setEditingJobId(null);
                  setView("templateForm");
                }}
                onInviteCandidate={() => openHrFlow("invite")}
                onViewCandidateReport={(cid, iid) => goCandidateReport(cid, iid, "dashboard")}
                onViewAllCandidates={() => goView("candidates")}
                onViewAllUpcoming={() => goView("upcomingInterviews")}
              />
            ) : view === "candidateReport" && candidateId ? (
              <CandidateReportPage
                candidateId={candidateId}
                initialInterviewId={reportInterviewId}
                returnTo={reportReturnTo}
                onBack={() => goView(reportReturnTo === "dashboard" ? "dashboard" : "candidates")}
              />
            ) : view === "candidateInterviews" ? (
              <CandidateInterviewsPage
                candidateId={candidateId}
                onBack={() => goView("dashboard")}
                onOpenCandidateReport={(iid) => goCandidateReport(candidateId, iid, "dashboard")}
              />
            ) : view === "templates" ? (
              <TemplatesPage
                onCreateTemplate={() => {
                  setEditingJobId(null);
                  setView("templateForm");
                }}
                onEditTemplate={(jobId) => {
                  setEditingJobId(jobId);
                  setView("templateForm");
                }}
              />
            ) : view === "candidates" ? (
              <CandidatesPage onOpenCandidateReport={(cid, iid) => goCandidateReport(cid, iid, "candidates")} />
            ) : view === "templateForm" ? (
              <TemplateFormPage jobId={editingJobId} onDone={() => setView("templates")} onOpenHrSetup={() => openHrFlow("template")} />
            ) : view === "promptLogs" ? (
              <PromptLogsPage />
            ) : view === "integrityLogs" ? (
              <IntegrityLogsPage />
            ) : view === "upcomingInterviews" ? (
              <UpcomingInterviewsPage onBack={() => goView("dashboard")} />
            ) : (
              <AtsPage />
            )}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
