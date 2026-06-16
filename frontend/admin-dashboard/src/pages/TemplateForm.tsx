import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Info,
  RotateCcw,
  Save,
  Zap,
} from "lucide-react";
import { apiGet, authFetch } from "../api/client";
import { CreatableMasterCombobox } from "../components/CreatableMasterCombobox";
import { INTELLIGENCE_SUITE_CATEGORIES } from "../constants/intelligenceSuiteCategories";
import { MAX_COUNT_MODE_QUESTIONS, clampCountModeQuestions } from "../constants/interviewLimits";

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
  difficulty?: string;
  numQ?: number;
  interviewMode?: string;
  timingMode?: "count" | "time";
  timeLimitSec?: number;
  micAlwaysOn?: boolean;
  showSpokenText?: boolean;
  enableTranscriptInput?: boolean;
  jdText?: string;
  templateInstructions?: string;
  weights?: Record<string, unknown>;
  questionType?: string;
  manualQuestions?: string[];
  generatedPrompt?: string;
  editedPrompt?: string;
  promptVersion?: number;
  promptUpdatedBy?: string;
  promptUpdatedAt?: string;
  promptHistory?: Array<Record<string, unknown>>;
  effectivePrompt?: string;
  promptPreview?: string;
  promptCharCount?: number;
};

function toCsv(list: string[] | undefined) {
  return (list || []).join(", ");
}

function clampInt(raw: any, min: number, max: number) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function toBoolean(raw: unknown, fallback = false) {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
  return Boolean(raw);
}

/** Align with backend: trim, drop empties, case-insensitive dedupe, max 120 lines. */
function normalizeManualQuestionLines(raw: string): string[] {
  const lines = String(raw || "").split(/\r?\n/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ln of lines) {
    const line = ln.trim();
    if (!line) continue;
    const low = line.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(line);
    if (out.length >= 120) break;
  }
  return out;
}

function readExpRange(j: JobConfig): { min: number; max: number } {
  const w = (j.weights || {}) as Record<string, unknown>;
  const rawMin = (j as any).expMin ?? (j as any).exp_min ?? w["expMin"] ?? w["exp_min"];
  const rawMax = (j as any).expMax ?? (j as any).exp_max ?? w["expMax"] ?? w["exp_max"];
  return { min: clampInt(rawMin ?? 0, 0, 40), max: clampInt(rawMax ?? 0, 0, 40) };
}

export function TemplateFormPage({
  jobId,
  onDone,
  onOpenHrSetup,
}: {
  jobId: string | null;
  onDone: () => void;
  onOpenHrSetup: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<JobConfig[]>([]);

  const editing = useMemo(() => jobs.find((j) => j.jobId === jobId) || null, [jobs, jobId]);

  const [jobTitle, setJobTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [optionalSkills, setOptionalSkills] = useState("");
  const [expMin, setExpMin] = useState(0);
  const [expMax, setExpMax] = useState(0);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [numQ, setNumQ] = useState(5);
  const [interviewMode, setInterviewMode] = useState<"technical" | "hr">("technical");
  const [timingMode, setTimingMode] = useState<"" | "count" | "time">("");
  const [timeLimitMin, setTimeLimitMin] = useState(20);
  const [enableTimeWarnings, setEnableTimeWarnings] = useState(true);
  const [warn5Min, setWarn5Min] = useState(5);
  const [warn2Min, setWarn2Min] = useState(2);
  const [warn1Min, setWarn1Min] = useState(1);
  const [warn30Sec, setWarn30Sec] = useState(30);
  const [micAlwaysOn, setMicAlwaysOn] = useState(false);
  const [showSpokenText, setShowSpokenText] = useState(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [initialResponseWaitSec, setInitialResponseWaitSec] = useState(5);
  const [silenceDetectionSec, setSilenceDetectionSec] = useState(3);
  const [noResponseCountdownSec, setNoResponseCountdownSec] = useState(3);
  const [autoSkipEnabled, setAutoSkipEnabled] = useState(true);
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(true);
  const [confirmationBeforeNextSec, setConfirmationBeforeNextSec] = useState(3);
  const [minimumAnswerWords, setMinimumAnswerWords] = useState(5);
  const [minimumSpeechDurationSec, setMinimumSpeechDurationSec] = useState(2);
  const [speechEnergyThreshold, setSpeechEnergyThreshold] = useState(0.038);
  const [speechConfirmMs, setSpeechConfirmMs] = useState(400);
  const [jdText, setJdText] = useState("");
  const [templateInstructions, setTemplateInstructions] = useState("");
  const [questionType, setQuestionType] = useState<"dynamic" | "manual">("dynamic");
  const [manualQuestionsText, setManualQuestionsText] = useState("");
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);
  const [sampleDomains, setSampleDomains] = useState<string[]>([]);
  const [sampleAssignments, setSampleAssignments] = useState<string[]>([]);
  const [sampleSkillsUsed, setSampleSkillsUsed] = useState<string[]>([]);
  const [suiteTargetRole, setSuiteTargetRole] = useState("");
  const [suiteSeniority, setSuiteSeniority] = useState("");
  const [suiteTechStack, setSuiteTechStack] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [adaptiveNextQuestion, setAdaptiveNextQuestion] = useState(true);
  const [promptExpanded, setPromptExpanded] = useState(true);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [promptPreview, setPromptPreview] = useState("");
  const [promptCharCount, setPromptCharCount] = useState(0);
  const [promptTokenEstimate, setPromptTokenEstimate] = useState(0);
  const [promptVersion, setPromptVersion] = useState(1);
  const [promptHistory, setPromptHistory] = useState<Array<Record<string, unknown>>>([]);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptTestBusy, setPromptTestBusy] = useState(false);
  const [promptTestQuestions, setPromptTestQuestions] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const manualQuestionCount = useMemo(
    () => normalizeManualQuestionLines(manualQuestionsText).length,
    [manualQuestionsText]
  );
  const manualQuestionLines = useMemo(
    () => normalizeManualQuestionLines(manualQuestionsText),
    [manualQuestionsText]
  );
  const assessmentDomainLabels = useMemo(
    () =>
      selectedCategoryIds.map(
        (id) => INTELLIGENCE_SUITE_CATEGORIES.find((c) => c.id === id)?.title || id,
      ),
    [selectedCategoryIds],
  );
  const createdDateLabel = useMemo(() => {
    const raw =
      String((editing as any)?.created_at_ist || (editing as any)?.createdAtIst || "").trim() ||
      String((editing as any)?.updated_at_ist || "").trim();
    if (!raw) return "—";
    const d = Date.parse(raw);
    if (!Number.isFinite(d)) return raw;
    return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [editing]);
  const countModeQuestionsToAsk = useMemo(() => {
    const n = clampCountModeQuestions(numQ, 5);
    if (questionType === "manual" && manualQuestionCount > 0) return Math.min(n, manualQuestionCount);
    return n;
  }, [numQ, questionType, manualQuestionCount]);

  const interviewDurationLabel = useMemo(() => {
    if (timingMode === "time") return `${timeLimitMin} minutes (time limit)`;
    if (timingMode === "count") return `${countModeQuestionsToAsk} questions (fixed count)`;
    return "—";
  }, [timingMode, timeLimitMin, countModeQuestionsToAsk]);

  const prevHydratedJobIdRef = useRef<string | null | undefined>(undefined);
  const promptDraftTouchedRef = useRef(false);
  const lastAutoGeneratedPromptRef = useRef("");

  const steps = [
    { id: 1 as const, label: "Basics" },
    { id: 2 as const, label: "Skills & JD" },
    { id: 3 as const, label: "Review" },
  ];

  const refresh = async () => {
    const data = await apiGet<{ jobs: JobConfig[] }>("/job/configs", { force: true });
    setJobs(Array.isArray(data.jobs) ? data.jobs : []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        await refresh();
        if (!alive) return;
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = prevHydratedJobIdRef.current;

    if (jobId == null) {
      if (prev != null) {
        setTimingMode("");
        setStep(1);
        setJobTitle("");
        setDomain("");
        setOpportunityId("");
        setCustomerName("");
        setRequiredSkills("");
        setOptionalSkills("");
        setExpMin(0);
        setExpMax(0);
        setDifficulty("medium");
        setNumQ(5);
        setInterviewMode("technical");
        setTimeLimitMin(20);
        setMicAlwaysOn(false);
        setShowSpokenText(false);
        setJdText("");
        setTemplateInstructions("");
        setQuestionType("dynamic");
        setManualQuestionsText("");
        setSelectedCategoryIds([]);
        setSuiteTargetRole("");
        setSuiteSeniority("");
        setSuiteTechStack("");
        setSampleQuestions([]);
        setSampleDomains([]);
        setSampleAssignments([]);
        setSampleSkillsUsed([]);
        setAdaptiveNextQuestion(true);
        setGeneratedPrompt("");
        setEditedPrompt("");
        setPromptPreview("");
        setPromptCharCount(0);
        setPromptTokenEstimate(0);
        setPromptVersion(1);
        setPromptHistory([]);
        setPromptTestQuestions([]);
        promptDraftTouchedRef.current = false;
        lastAutoGeneratedPromptRef.current = "";
      }
      prevHydratedJobIdRef.current = jobId;
      return;
    }

    if (!jobs.length) return;
    const j = jobs.find((x) => x.jobId === jobId) || null;
    if (!j) return;

    setJobTitle(j.jobTitle || "");
    setDomain(j.domain || "");
    setOpportunityId((j as any).opportunityId || (j as any).opportunity_id || "");
    setCustomerName((j as any).customerName || (j as any).customer_name || "");
    setRequiredSkills(toCsv(j.requiredSkills));
    setOptionalSkills(toCsv(j.optionalSkills));
    const exp = readExpRange(j);
    setExpMin(exp.min);
    setExpMax(exp.max);
    const d = String(j.difficulty || "medium").toLowerCase();
    setDifficulty(d === "easy" || d === "hard" ? (d as any) : "medium");
    setNumQ(clampCountModeQuestions(j.numQ ?? 5, 5));
    const im = String(j.interviewMode || "technical").toLowerCase();
    setInterviewMode(im === "hr" || im === "standard" ? "hr" : "technical");
    const tm = String((j as any).timingMode || (j as any).timing_mode || "count").toLowerCase();
    setTimingMode(tm === "time" ? "time" : "count");
    const tls = Number((j as any).timeLimitSec || (j as any).time_limit_sec || 0);
    setTimeLimitMin(Math.max(1, Math.min(360, Math.round((Number.isFinite(tls) ? tls : 0) / 60) || 20)));
    setMicAlwaysOn(Boolean((j as any).micAlwaysOn ?? (j as any).mic_always_on ?? false));
    setShowSpokenText(
      toBoolean((j as any).enableTranscriptInput ?? (j as any).enable_transcript_input ?? (j as any).showSpokenText ?? (j as any).show_spoken_text, false),
    );
    setJdText(j.jdText || "");
    setTemplateInstructions(
      String((j as JobConfig).templateInstructions || (j as any).template_instructions || "").trim(),
    );

    const qt = String((j as any).questionType || (j as any).question_type || "dynamic").toLowerCase();
    setQuestionType(qt === "manual" ? "manual" : "dynamic");
    const mq = (j as any).manualQuestions ?? (j as any).manual_questions;
    if (Array.isArray(mq) && mq.length) {
      setManualQuestionsText(mq.map((x: unknown) => String(x)).filter(Boolean).join("\n"));
    } else {
      setManualQuestionsText("");
    }

    const w = (j.weights || {}) as Record<string, unknown>;
    const qc = w.questionCategories;
    setSelectedCategoryIds(Array.isArray(qc) ? qc.map((x) => String(x)).filter(Boolean) : []);
    setSuiteTargetRole(typeof w.intelligenceTargetRole === "string" ? (w.intelligenceTargetRole as string) : "");
    setSuiteSeniority(typeof w.intelligenceSeniority === "string" ? (w.intelligenceSeniority as string) : "");
    setSuiteTechStack(typeof w.intelligenceTechStack === "string" ? (w.intelligenceTechStack as string) : "");
    setAdaptiveNextQuestion(toBoolean((w as any).adaptiveNextQuestion, false));
    setEnableTimeWarnings(
      w.enableTimeWarnings === undefined ? true : toBoolean(w.enableTimeWarnings, true),
    );
    const tw = (w.timeWarningSec || {}) as Record<string, unknown>;
    setWarn5Min(Math.max(1, Math.min(60, Math.round(Number(tw["5min"] ?? 300) / 60) || 5)));
    setWarn2Min(Math.max(1, Math.min(30, Math.round(Number(tw["2min"] ?? 120) / 60) || 2)));
    setWarn1Min(Math.max(1, Math.min(15, Math.round(Number(tw["1min"] ?? 60) / 60) || 1)));
    setWarn30Sec(Math.max(10, Math.min(120, Number(tw["30sec"] ?? 30) || 30)));
    setAutoAdvanceEnabled(toBoolean(w.autoAdvanceEnabled ?? w.auto_advance_enabled, false));
    setInitialResponseWaitSec(clampInt(w.initialResponseWaitSec ?? w.initial_response_wait_sec ?? 5, 2, 30));
    setSilenceDetectionSec(clampInt(w.silenceDetectionSec ?? w.silence_detection_sec ?? 3, 2, 15));
    setNoResponseCountdownSec(clampInt(w.noResponseCountdownSec ?? w.no_response_countdown_sec ?? 3, 2, 15));
    setAutoSkipEnabled(toBoolean(w.autoSkipEnabled ?? w.auto_skip_enabled, true));
    setVoiceCommandsEnabled(toBoolean(w.voiceCommandsEnabled ?? w.voice_commands_enabled, true));
    setConfirmationBeforeNextSec(clampInt(w.confirmationBeforeNextSec ?? w.confirmation_before_next_sec ?? 3, 0, 10));
    setMinimumAnswerWords(clampInt(w.minimumAnswerWords ?? w.minimum_answer_words ?? 5, 1, 30));
    setMinimumSpeechDurationSec(clampInt(w.minimumSpeechDurationSec ?? w.minimum_speech_duration_sec ?? 2, 1, 30));
    setSpeechEnergyThreshold(
      Math.max(0.01, Math.min(0.12, Number(w.speechEnergyThreshold ?? w.speech_energy_threshold ?? 0.038) || 0.038)),
    );
    setSpeechConfirmMs(clampInt(w.speechConfirmMs ?? w.speech_confirm_ms ?? 400, 300, 500));

    const savedPreview = w.previewQuestions;
    if (Array.isArray(savedPreview)) {
      setSampleQuestions(savedPreview.map((q) => String(q)).filter(Boolean).slice(0, 15));
    } else {
      setSampleQuestions([]);
    }
    const savedDomains = w.previewDomains;
    setSampleDomains(Array.isArray(savedDomains) ? savedDomains.map((d) => String(d)) : []);
    const savedAssignments = w.previewAssignments;
    setSampleAssignments(Array.isArray(savedAssignments) ? savedAssignments.map((d) => String(d || "")) : []);
    const savedSkillsUsed = w.previewSkillsUsed;
    setSampleSkillsUsed(Array.isArray(savedSkillsUsed) ? savedSkillsUsed.map((s) => String(s)) : []);
    setGeneratedPrompt(String((j as any).generatedPrompt || ""));
    const hydratedEditedPrompt = String((j as any).editedPrompt || "");
    setEditedPrompt(hydratedEditedPrompt);
    promptDraftTouchedRef.current = Boolean(hydratedEditedPrompt.trim());
    setPromptPreview(String((j as any).promptPreview || ""));
    setPromptCharCount(Number((j as any).promptCharCount || 0));
    const hist = (j as any).promptHistory;
    setPromptHistory(Array.isArray(hist) ? hist : []);
    setPromptVersion(Math.max(1, Number((j as any).promptVersion || 1)));
    setPromptTokenEstimate(Math.max(0, Math.round(Number((j as any).promptCharCount || 0) / 4)));
    setPromptTestQuestions([]);
    lastAutoGeneratedPromptRef.current = String((j as JobConfig).generatedPrompt || "").trim();

    prevHydratedJobIdRef.current = jobId;
  }, [jobId, jobs]);

  const validateStep = (targetStep: 1 | 2 | 3) => {
    if (targetStep >= 1) {
      if (!jobTitle.trim()) return "Job title is required.";
      if (!timingMode) return "Select a timing mode (question count or time limit).";
    }
    if (targetStep >= 2) {
      if (!requiredSkills.trim()) return "Required skills are required.";
      if (questionType === "manual" && manualQuestionCount < 1) {
        return "Manual Interview Questions: add at least one non-empty line (one question per line).";
      }
    }
    return "";
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step === 1 && !suiteTargetRole.trim() && jobTitle.trim()) {
      setSuiteTargetRole(jobTitle.trim());
    }
    setStep((s) => (s < 3 ? ((s + 1) as any) : s));
  };

  const back = () => {
    setError("");
    setStep((s) => (s > 1 ? ((s - 1) as any) : s));
  };

  const toggleSuiteCategory = (id: string) => {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllSuiteCategories = () => {
    if (selectedCategoryIds.length === INTELLIGENCE_SUITE_CATEGORIES.length) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(INTELLIGENCE_SUITE_CATEGORIES.map((c) => c.id));
    }
  };

  const runIntelligenceQuestionnaire = async () => {
    if (questionType === "manual") {
      setError("Switch to Dynamic Questions to generate a questionnaire.");
      return;
    }
    if (!requiredSkills.trim()) {
      setError("Required skills are required before generating a questionnaire.");
      return;
    }
    if (!selectedCategoryIds.length) {
      setError("Select at least one assessment category.");
      return;
    }
    try {
      setSampleBusy(true);
      setError("");
      const fd = new FormData();
      fd.append("requiredSkills", requiredSkills);
      fd.append("optionalSkills", optionalSkills);
      fd.append("difficulty", difficulty);
      const genCount = Math.min(15, Math.max(numQ || 5, selectedCategoryIds.length));
      fd.append("numQ", String(genCount));
      fd.append("jdText", jdText);
      fd.append("templateInstructions", templateInstructions);
      fd.append("expMin", String(expMin || 0));
      fd.append("expMax", String(expMax || 0));
      fd.append("questionCategories", JSON.stringify(selectedCategoryIds));
      fd.append("targetRole", (suiteTargetRole || jobTitle).trim());
      fd.append("seniorityLevel", suiteSeniority.trim());
      fd.append("technicalStack", suiteTechStack.trim());
      fd.append("interviewMode", interviewMode);
      fd.append("avoidHistory", JSON.stringify(sampleQuestions || []));
      fd.append("generatedPrompt", generatedPrompt);
      fd.append("editedPrompt", editedPrompt);
      const res = await authFetch("/job/template/sample-questions", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `Failed (${res.status})`);
      const list = Array.isArray(data?.questions) ? data.questions : [];
      const trimmed = list.map((q: unknown) => String(q)).filter(Boolean).slice(0, 30);
      setSampleQuestions(trimmed);
      const domains = Array.isArray(data?.domains) ? data.domains.map((d: unknown) => String(d)) : [];
      const assignments = Array.isArray(data?.domainAssignments)
        ? data.domainAssignments.map((d: unknown) => String(d || ""))
        : [];
      const skillsUsed = Array.isArray(data?.skillsUsed) ? data.skillsUsed.map((s: unknown) => String(s)) : [];
      setSampleDomains(domains);
      setSampleAssignments(assignments.slice(0, trimmed.length));
      setSampleSkillsUsed(skillsUsed);
      if (typeof data?.effectivePrompt === "string") setPromptPreview(String(data.effectivePrompt));
      if (typeof data?.charCount === "number") setPromptCharCount(Number(data.charCount || 0));
      if (typeof data?.tokenEstimate === "number") setPromptTokenEstimate(Number(data.tokenEstimate || 0));
    } catch (e: unknown) {
      setError(String((e as Error)?.message || e));
      setSampleQuestions([]);
      setSampleDomains([]);
      setSampleAssignments([]);
      setSampleSkillsUsed([]);
    } finally {
      setSampleBusy(false);
    }
  };

  const refreshPromptPreview = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setPromptBusy(true);
      const fd = new FormData();
      fd.append("jobTitle", jobTitle);
      fd.append("requiredSkills", requiredSkills);
      fd.append("optionalSkills", optionalSkills);
      fd.append("expMin", String(expMin || 0));
      fd.append("expMax", String(expMax || 0));
      fd.append("difficulty", difficulty);
      fd.append("interviewMode", interviewMode);
      fd.append("jdText", jdText);
      fd.append("templateInstructions", templateInstructions);
      fd.append("customerName", customerName);
      fd.append("opportunityId", opportunityId);
      fd.append("technologyStack", suiteTechStack);
      fd.append("generatedPrompt", generatedPrompt);
      fd.append("editedPrompt", editedPrompt);
      const res = await authFetch("/job/template/prompt-preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `Prompt preview failed (${res.status})`);
      const nextGenerated = String(data?.generatedPrompt || "");
      const nextPreview = String(data?.previewPrompt || data?.effectivePrompt || "");
      const usingCustom = Boolean(data?.usingCustomPrompt);
      setGeneratedPrompt(nextGenerated);
      setPromptPreview(nextPreview);
      setPromptCharCount(Number(data?.charCount || 0));
      setPromptTokenEstimate(Number(data?.tokenEstimate || 0));

      const prevAuto = lastAutoGeneratedPromptRef.current.trim();
      const currentEdited = editedPrompt.trim();
      const shouldSyncEditable =
        !usingCustom &&
        (!promptDraftTouchedRef.current ||
          !currentEdited ||
          (prevAuto && currentEdited === prevAuto));

      if (shouldSyncEditable) {
        setEditedPrompt(nextGenerated);
        promptDraftTouchedRef.current = false;
      } else if (usingCustom) {
        promptDraftTouchedRef.current = true;
      }
      lastAutoGeneratedPromptRef.current = nextGenerated;
    } catch (e) {
      if (!opts?.silent) setError(String((e as Error)?.message || e));
    } finally {
      if (!opts?.silent) setPromptBusy(false);
    }
  };

  const resetPromptToDefault = async () => {
    const ok = window.confirm("Reset custom prompt changes?");
    if (!ok) return;
    setEditedPrompt(generatedPrompt || "");
    promptDraftTouchedRef.current = false;
    setPromptVersion((v) => Math.max(1, v + 1));
    await refreshPromptPreview();
  };

  const testPrompt = async () => {
    try {
      setPromptTestBusy(true);
      setError("");
      const fd = new FormData();
      fd.append("requiredSkills", requiredSkills);
      fd.append("optionalSkills", optionalSkills);
      fd.append("difficulty", difficulty);
      fd.append("jdText", jdText);
      fd.append("templateInstructions", templateInstructions);
      fd.append("expMin", String(expMin || 0));
      fd.append("expMax", String(expMax || 0));
      fd.append("interviewMode", interviewMode);
      fd.append("targetRole", suiteTargetRole || jobTitle);
      fd.append("technicalStack", suiteTechStack);
      fd.append("generatedPrompt", generatedPrompt);
      fd.append("editedPrompt", editedPrompt);
      const testCount = Math.min(20, Math.max(15, numQ || 15));
      fd.append("numQ", String(testCount));
      const res = await authFetch("/job/template/test-prompt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `Prompt test failed (${res.status})`);
      const list = Array.isArray(data?.sampleQuestions)
        ? data.sampleQuestions.map((q: unknown) => String(q)).filter(Boolean)
        : data?.sampleQuestion
          ? [String(data.sampleQuestion)]
          : [];
      const trimmed = list.map((q) => String(q)).filter(Boolean).slice(0, 20);
      setPromptTestQuestions(trimmed);
      // Persist these as the template's preview questions on Save (so candidates
      // can be served a randomized subset during live interviews).
      if (questionType !== "manual") {
        setSampleQuestions(trimmed);
      }
      setPromptPreview(String(data?.effectivePrompt || promptPreview));
      setPromptCharCount(Number(data?.charCount || promptCharCount));
      setPromptTokenEstimate(Number(data?.tokenEstimate || promptTokenEstimate));
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setPromptTestBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 3 || questionType === "manual") return;
    const t = window.setTimeout(() => {
      refreshPromptPreview({ silent: true });
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    jobTitle,
    requiredSkills,
    optionalSkills,
    expMin,
    expMax,
    difficulty,
    interviewMode,
    jdText,
    templateInstructions,
    customerName,
    opportunityId,
    suiteTechStack,
    generatedPrompt,
    editedPrompt,
  ]);

  const save = async () => {
    const err = validateStep(2);
    if (err) {
      setError(err);
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      setError("");
      const fd = new FormData();
      if (jobId) fd.append("jobId", jobId);
      fd.append("jobTitle", jobTitle);
      fd.append("domain", domain);
      fd.append("opportunityId", opportunityId);
      fd.append("customerName", customerName);
      fd.append("requiredSkills", requiredSkills);
      fd.append("optionalSkills", optionalSkills);
      fd.append("expMin", String(expMin || 0));
      fd.append("expMax", String(expMax || 0));
      fd.append("difficulty", difficulty);
      const saveNumQ =
        timingMode === "count"
          ? countModeQuestionsToAsk
          : questionType === "manual" && manualQuestionCount > 0
            ? manualQuestionCount
            : clampCountModeQuestions(numQ, 5);
      fd.append("numQ", String(saveNumQ));
      fd.append("followupMode", "false");
      fd.append("interviewMode", interviewMode);
      fd.append("timingMode", timingMode || "count");
      fd.append("timeLimitSec", String(Math.max(0, Math.round((timeLimitMin || 0) * 60))));
      fd.append("micAlwaysOn", micAlwaysOn ? "true" : "false");
      fd.append("showSpokenText", showSpokenText ? "true" : "false");
      fd.append("enableTranscriptInput", showSpokenText ? "true" : "false");
      fd.append("jdText", jdText);
      fd.append("templateInstructions", templateInstructions);
      fd.append("questionType", questionType);
      fd.append("manualQuestions", JSON.stringify(normalizeManualQuestionLines(manualQuestionsText)));
      const prevEdited = String((editing as any)?.editedPrompt || "").trim();
      const prevGenerated = String((editing as any)?.generatedPrompt || "").trim();
      const prevEffective = prevEdited || prevGenerated;
      const sanitizedEdited = editedPrompt.trim();
      const generatedTrimmed = String(generatedPrompt || "").trim();
      const persistEdited = sanitizedEdited && sanitizedEdited !== generatedTrimmed ? sanitizedEdited : "";
      const currentEffective = persistEdited || generatedTrimmed;
      const promptChanged = currentEffective !== prevEffective;
      const nextPromptVersion = Math.max(1, promptChanged ? promptVersion + 1 : promptVersion);
      const nextPromptHistory = persistEdited && promptChanged
        ? [
            ...promptHistory,
            {
              version: nextPromptVersion,
              updated_at: new Date().toISOString(),
              edited_prompt: persistEdited.slice(0, 12000),
            },
          ].slice(-50)
        : promptHistory.slice(-50);
      fd.append("generatedPrompt", generatedPrompt);
      fd.append("editedPrompt", persistEdited);
      fd.append("promptVersion", String(nextPromptVersion));
      fd.append("promptHistory", JSON.stringify(nextPromptHistory));
      const prior =
        editing?.weights && typeof editing.weights === "object" ? { ...(editing.weights as Record<string, unknown>) } : {};
      const mergedWeights: Record<string, unknown> = {
        ...prior,
        questionCategories: selectedCategoryIds,
        intelligenceTargetRole: suiteTargetRole.trim(),
        intelligenceSeniority: suiteSeniority.trim(),
        intelligenceTechStack: suiteTechStack.trim(),
        adaptiveNextQuestion: adaptiveNextQuestion,
        expMin,
        expMax,
        previewQuestions: questionType === "manual" ? [] : sampleQuestions,
        previewDomains: questionType === "manual" ? [] : sampleDomains,
        previewAssignments: questionType === "manual" ? [] : sampleAssignments,
        previewSkillsUsed: questionType === "manual" ? [] : sampleSkillsUsed,
        enableTimeWarnings: enableTimeWarnings,
        timeWarningSec: {
          "5min": Math.max(60, Math.round(warn5Min * 60)),
          "2min": Math.max(60, Math.round(warn2Min * 60)),
          "1min": Math.max(30, Math.round(warn1Min * 60)),
          "30sec": Math.max(10, Math.min(120, warn30Sec)),
        },
        timeWarningsTts: true,
        autoAdvanceEnabled,
        initialResponseWaitSec,
        silenceDetectionSec,
        noResponseCountdownSec,
        autoSkipEnabled,
        voiceCommandsEnabled,
        confirmationBeforeNextSec,
        minimumAnswerWords,
        minimumSpeechDurationSec,
        speechEnergyThreshold,
        speechConfirmMs,
      };
      fd.append("weights", JSON.stringify(mergedWeights));
      const res = await authFetch("/job/config", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `Save failed (${res.status})`);
      setPromptVersion(nextPromptVersion);
      setPromptHistory(nextPromptHistory);
      await refresh();
      onDone();
    } catch (e: unknown) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDone}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition text-sm font-semibold text-slate-700 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <a
              onClick={(e) => {
                e.preventDefault();
                onOpenHrSetup();
              }}
              href="/?focus=template"
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition text-sm font-semibold text-slate-700 inline-flex items-center gap-2"
            >
              HR Setup <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight">
            {jobId ? "Edit Template" : "Create Template"}
          </h1>
          <p className="text-slate-500 mt-1">Templates power HR setup (skills/role/JD) and ATS scoring.</p>
        </div>
        <div className="flex items-center gap-2">
          {step > 1 ? (
            <button
              onClick={back}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 transition"
              disabled={busy || loading}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : null}
          {step < 3 ? (
            <button
              onClick={next}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-60"
              disabled={busy || loading}
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={save}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-60"
              disabled={busy || loading}
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-6 bg-white border border-rose-200 rounded-2xl p-6 text-rose-700">
          <div className="font-extrabold">Template error</div>
          <div className="mt-2 text-sm text-rose-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight">Template wizard</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {editing ? `Editing ${editing.jobTitle}` : "Create a job template HR can reuse."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {steps.map((s, idx) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${
                      active
                        ? "bg-white border-indigo-200 text-indigo-700 shadow-sm"
                        : done
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 text-center">{idx + 1}</span>}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-4">
          {/* spacer for layout consistency */}
        </div>

          {step === 1 ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Job title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. Python Developer"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Domain (optional)</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. Automotive / FinTech / Enterprise"
              />
            </div>
            <CreatableMasterCombobox
              kind="opportunity"
              label="Opportunity ID"
              value={opportunityId}
              onChange={setOpportunityId}
              placeholder="Search or create opportunity ID"
            />
            <CreatableMasterCombobox
              kind="customer"
              label="Customer Name"
              value={customerName}
              onChange={setCustomerName}
              placeholder="Search or create customer"
            />
            <div>
              <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty((e.target.value as any) || "medium")}
                className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Interview mode</label>
              <select
                value={interviewMode}
                onChange={(e) => setInterviewMode((e.target.value as "technical" | "hr") || "technical")}
                className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="technical">Technical Interview</option>
                <option value="hr">HR Interview</option>
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
              <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Timing</div>
              <div className="mt-3">
                <label className="text-[11px] font-extrabold tracking-widest uppercase text-slate-500">Mode</label>
                <select
                  value={timingMode}
                  onChange={(e) => {
                    const v = e.target.value as "" | "count" | "time";
                    setTimingMode(v === "count" || v === "time" ? v : "");
                  }}
                  className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select timing mode…</option>
                  <option value="count">Ask by question count (fixed)</option>
                  <option value="time">Ask by time limit</option>
                </select>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-extrabold tracking-widest uppercase text-slate-500">Questions count</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_COUNT_MODE_QUESTIONS}
                    value={numQ}
                    onChange={(e) => setNumQ(clampCountModeQuestions(e.target.value, numQ))}
                    disabled={timingMode !== "count"}
                    className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-extrabold tracking-widest uppercase text-slate-500">Time limit (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    value={timeLimitMin}
                    onChange={(e) => setTimeLimitMin(clampInt(e.target.value, 1, 360))}
                    disabled={timingMode !== "time"}
                    className="mt-2 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {!timingMode
                  ? "Choose how the interview ends: fixed number of questions, or a time limit."
                  : timingMode === "time"
                    ? `Candidates will be auto-submitted after ${timeLimitMin} minutes.`
                    : questionType === "manual"
                      ? manualQuestionCount > 0
                        ? `Ask ${countModeQuestionsToAsk} questions from your manual list (${manualQuestionCount} in pool, up to ${MAX_COUNT_MODE_QUESTIONS} per interview).`
                        : "Add manual questions in step 2, then set how many to ask per interview."
                      : `Candidates will answer exactly ${numQ} questions (max ${MAX_COUNT_MODE_QUESTIONS}).`}
              </div>
              {timingMode === "time" ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[11px] font-extrabold tracking-widest uppercase text-slate-500">
                        Time warnings
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Non-blocking banners before auto-submit (default ON).
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableTimeWarnings((v) => !v)}
                      className={`h-9 px-3 rounded-xl border text-sm font-semibold transition ${
                        enableTimeWarnings
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      {enableTimeWarnings ? "ON" : "OFF"}
                    </button>
                  </div>
                  {enableTimeWarnings ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">5 min warn</label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={warn5Min}
                          onChange={(e) => setWarn5Min(clampInt(e.target.value, 1, 60))}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">2 min warn</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={warn2Min}
                          onChange={(e) => setWarn2Min(clampInt(e.target.value, 1, 30))}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">1 min warn</label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={warn1Min}
                          onChange={(e) => setWarn1Min(clampInt(e.target.value, 1, 15))}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">30 sec warn</label>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={warn30Sec}
                          onChange={(e) => setWarn30Sec(clampInt(e.target.value, 10, 120))}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/*
              "Mic always on" UI removed (May 2026 spec): the candidate microphone now starts
              automatically after the AI finishes each question. We still send `micAlwaysOn=false`
              to the backend so legacy DB columns and API contracts remain valid.
            */}

            <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2 bg-slate-50/40">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Enable Transcript Input</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">{showSpokenText ? "ON" : "OFF"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpokenText((v) => !v)}
                  className={`h-9 px-3 rounded-xl border text-sm font-semibold transition ${
                    showSpokenText
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Toggle
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                When ON, the candidate sees the live transcript panel. Turn OFF to hide the transcript section entirely.
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200 p-4 md:col-span-2 bg-indigo-50/30">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-extrabold tracking-widest uppercase text-indigo-600">Smart Auto-Advance</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">
                    {autoAdvanceEnabled ? "ON — voice-driven flow" : "OFF — manual Send / Skip"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoAdvanceEnabled((v) => !v)}
                  className={`h-9 px-3 rounded-xl border text-sm font-semibold transition ${
                    autoAdvanceEnabled
                      ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  {autoAdvanceEnabled ? "ON" : "OFF"}
                </button>
              </div>
              {autoAdvanceEnabled ? (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Initial wait (sec)</label>
                    <input type="number" min={2} max={30} value={initialResponseWaitSec}
                      onChange={(e) => setInitialResponseWaitSec(clampInt(e.target.value, 2, 30))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Silence detect (sec)</label>
                    <input type="number" min={2} max={15} value={silenceDetectionSec}
                      onChange={(e) => setSilenceDetectionSec(clampInt(e.target.value, 2, 15))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">No-response countdown</label>
                    <input type="number" min={2} max={15} value={noResponseCountdownSec}
                      onChange={(e) => setNoResponseCountdownSec(clampInt(e.target.value, 2, 15))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Confirm before next</label>
                    <input type="number" min={0} max={10} value={confirmationBeforeNextSec}
                      onChange={(e) => setConfirmationBeforeNextSec(clampInt(e.target.value, 0, 10))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Min answer words</label>
                    <input type="number" min={1} max={30} value={minimumAnswerWords}
                      onChange={(e) => setMinimumAnswerWords(clampInt(e.target.value, 1, 30))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Min speech (sec)</label>
                    <input type="number" min={1} max={30} value={minimumSpeechDurationSec}
                      onChange={(e) => setMinimumSpeechDurationSec(clampInt(e.target.value, 1, 30))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Speech energy threshold</label>
                    <input type="number" min={0.01} max={0.12} step={0.001} value={speechEnergyThreshold}
                      onChange={(e) => setSpeechEnergyThreshold(Math.max(0.01, Math.min(0.12, Number(e.target.value) || 0.038)))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Speech confirm (ms)</label>
                    <input type="number" min={300} max={500} value={speechConfirmMs}
                      onChange={(e) => setSpeechConfirmMs(clampInt(e.target.value, 300, 500))}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200" />
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={() => setAutoSkipEnabled((v) => !v)}
                      className={`w-full h-10 rounded-lg border text-xs font-bold ${autoSkipEnabled ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-slate-50 border-slate-200"}`}>
                      Auto-skip: {autoSkipEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={() => setVoiceCommandsEnabled((v) => !v)}
                      className={`w-full h-10 rounded-lg border text-xs font-bold ${voiceCommandsEnabled ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200"}`}>
                      Voice commands: {voiceCommandsEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  When ON, the interview detects speech and silence to auto-submit answers and auto-skip silent questions.
                </p>
              )}
            </div>

          </div>
        ) : step === 2 ? (
          <div className="mt-6 space-y-5">
            <div>
              <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Years of experience</div>
              <p className="text-xs text-slate-500 mt-1 mb-2">Used for question generation and saved on the template.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Experience min</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={expMin}
                    onChange={(e) => setExpMin(clampInt(e.target.value, 0, 40))}
                    className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Experience max</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={expMax}
                    onChange={(e) => setExpMax(clampInt(e.target.value, 0, 40))}
                    className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
            </div>

            {/* Row 1: Skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Required skills</label>
                <input
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                  className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="e.g. python, fastapi, sql"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Optional skills</label>
                <input
                  value={optionalSkills}
                  onChange={(e) => setOptionalSkills(e.target.value)}
                  className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="e.g. docker, aws"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Question Type</label>
              <select
                value={questionType}
                onChange={(e) => {
                  const v = e.target.value === "manual" ? "manual" : "dynamic";
                  setQuestionType(v);
                  setError("");
                }}
                className="mt-1.5 w-full md:max-w-md h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="dynamic">Dynamic Questions</option>
                <option value="manual">Manual Questions</option>
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                Dynamic uses AI-generated questions from skills and assessment domains. Manual uses only the questions you list
                below.
              </p>
            </div>

            {/* Row 2: Target Role / Seniority / Tech Stack */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Target role</label>
                <input
                  value={suiteTargetRole}
                  onChange={(e) => setSuiteTargetRole(e.target.value)}
                  className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="e.g. Python Developer"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Seniority level</label>
                <select
                  value={suiteSeniority}
                  onChange={(e) => setSuiteSeniority(e.target.value)}
                  className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select…</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">Tech stack (optional)</label>
                <input
                  value={suiteTechStack}
                  onChange={(e) => setSuiteTechStack(e.target.value)}
                  className="mt-1.5 w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="e.g. React, Node.js, AWS"
                />
              </div>
            </div>

            {questionType === "dynamic" ? (
              <>
            {/* Row 3: Domain selection header + actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Assessment Domains
                  {selectedCategoryIds.length > 0 && (
                    <span className="ml-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {selectedCategoryIds.length} selected
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Select domains to shape question generation alongside your skills.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSuiteCategories}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                >
                  {selectedCategoryIds.length === INTELLIGENCE_SUITE_CATEGORIES.length ? "Clear all" : "Select all"}
                </button>
                <button
                  type="button"
                  onClick={runIntelligenceQuestionnaire}
                  disabled={selectedCategoryIds.length === 0 || !requiredSkills.trim() || sampleBusy}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    selectedCategoryIds.length > 0 && requiredSkills.trim() && !sampleBusy
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {sampleBusy ? "Generating…" : "Generate Questions"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Row 4: Compact domain grid — 4 cols */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {INTELLIGENCE_SUITE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleSuiteCategory(cat.id)}
                    className={`group flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/60 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    <div
                      className={`shrink-0 p-1.5 rounded-lg transition-all ${
                        isSelected ? "bg-blue-600 text-white" : `${cat.bgColor} ${cat.color}`
                      }`}
                    >
                      <Icon className="w-4 h-4 stroke-[2.25]" />
                    </div>
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span className={`text-xs font-bold leading-tight truncate ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                        {cat.title}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />}
                    </div>
                  </button>
                );
              })}
            </div>

              </>
            ) : (
              <div>
                <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">
                  Manual Interview Questions
                </label>
                <textarea
                  value={manualQuestionsText}
                  onChange={(e) => setManualQuestionsText(e.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="mt-1.5 w-full min-h-[220px] max-h-[480px] overflow-y-auto p-3 rounded-xl border border-slate-200 bg-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y whitespace-pre-wrap"
                  placeholder={"Paste interview questions here.\nOne question per line."}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  {manualQuestionCount} question{manualQuestionCount === 1 ? "" : "s"} (empty lines ignored, duplicates removed, up to 120
                  saved). Each candidate interview gets the same pool in a <span className="font-semibold text-slate-600">different order</span>{" "}
                  so parallel sessions do not all see question 1 first.
                </p>
              </div>
            )}

            {/* Row 5: JD text (moved up, before Generated Preview) */}
            <div>
              <label className="text-xs font-extrabold tracking-widest uppercase text-slate-500">JD text (optional)</label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={4}
                className="mt-1.5 w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
                placeholder="Paste job description here…"
              />
            </div>

            {/* Row 6: AI-Generated Interview Questions (API Response) */}
            {questionType === "dynamic" && sampleQuestions.length > 0 && (
              <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold tracking-tight text-slate-900">
                        AI-Generated Interview Questions
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {sampleQuestions.length} question{sampleQuestions.length === 1 ? "" : "s"} ready
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700">
                      Will be asked in the live interview
                    </span>
                  </div>
                </div>

                <ol className="space-y-2.5">
                  {sampleQuestions.map((q: string, idx: number) => {
                    const assignedDomain = sampleAssignments[idx] || "";
                    return (
                      <li
                        key={idx}
                        className="flex gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition"
                      >
                        <span className="shrink-0 w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 leading-relaxed">{String(q)}</p>
                          {assignedDomain ? (
                            <span className="inline-block mt-1.5 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              {assignedDomain}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {sampleSkillsUsed.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Skills covered:</span>
                    {sampleSkillsUsed.map((sk) => (
                      <span
                        key={sk}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : step === 3 && questionType === "manual" ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 p-6 bg-white shadow-sm">
              <div className="text-sm font-extrabold tracking-tight text-slate-900">Manual template review</div>
              <p className="mt-1 text-xs text-slate-500">Recruiter-friendly summary — no AI prompt configuration.</p>
              <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Template name</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{jobTitle || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target role</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{suiteTargetRole || jobTitle || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Seniority</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{suiteSeniority || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Opportunity ID</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{opportunityId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer name</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{customerName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Question count</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {timingMode === "count" ? countModeQuestionsToAsk : manualQuestionCount}
                    {timingMode === "count" && manualQuestionCount > countModeQuestionsToAsk
                      ? ` (from ${manualQuestionCount} in pool)`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interview mode</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {interviewMode === "hr" ? "HR Interview" : "Technical Interview"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interview duration</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{interviewDurationLabel}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Assessment domains</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {assessmentDomainLabels.length ? assessmentDomainLabels.join(", ") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created date</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{createdDateLabel}</dd>
                </div>
              </dl>
            </div>
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 p-5 bg-slate-50/60">
              <div className="text-sm font-extrabold tracking-tight text-slate-900">What gets saved</div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                This manual template stores your question list, role metadata, timing settings, and scheduling references.
                Candidates receive exactly the questions listed — no AI generation at runtime.
              </p>
            </div>
            <div className="lg:col-span-12 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-extrabold tracking-tight text-emerald-950">Manual interview questions</div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-800">
                  Total questions: {manualQuestionCount}
                </div>
              </div>
              {manualQuestionLines.length ? (
                <ul className="mt-4 space-y-2 max-h-[480px] overflow-auto pr-1">
                  {manualQuestionLines.map((q, idx) => (
                    <li
                      key={`${idx}-${q.slice(0, 32)}`}
                      className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                      <span className="leading-relaxed">
                        <span className="font-bold text-emerald-900 mr-1">Q{idx + 1}.</span>
                        {q}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-amber-800">No manual questions added yet. Go back to step 2 to add your list.</p>
              )}
            </div>
          </div>
        ) : step === 3 ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 p-5 bg-slate-50/40">
              <div className="text-sm font-extrabold tracking-tight">Summary</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div><span className="font-semibold text-slate-900">Title:</span> {jobTitle || "—"}</div>
                <div><span className="font-semibold text-slate-900">Domain:</span> {domain || "—"}</div>
                <div><span className="font-semibold text-slate-900">Opportunity ID:</span> {opportunityId || "—"}</div>
                <div><span className="font-semibold text-slate-900">Customer:</span> {customerName || "—"}</div>
                <div className="pt-1">
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Template Instructions</label>
                  <textarea
                    value={templateInstructions}
                    onChange={(e) => setTemplateInstructions(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[88px]"
                    placeholder="e.g. Focus on CAN/LIN and UDS diagnostics; use practical embedded scenarios; avoid generic theory."
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Shown in the AI prompt as <span className="font-mono">Template Instructions</span>. Updates the live prompt preview below when you edit.
                  </p>
                </div>
                <div><span className="font-semibold text-slate-900">Difficulty:</span> {difficulty}</div>
                <div><span className="font-semibold text-slate-900">Questions:</span> {numQ}</div>
                <div>
                  <span className="font-semibold text-slate-900">Timing:</span>{" "}
                  {!timingMode
                    ? "—"
                    : timingMode === "time"
                      ? `${timeLimitMin} min limit`
                      : `Fixed question count (${numQ})`}
                </div>
                <div><span className="font-semibold text-slate-900">Mic:</span> Auto-activated after each question</div>
                <div><span className="font-semibold text-slate-900">Transcript input:</span> {showSpokenText ? "Enabled" : "Hidden"}</div>
                <div><span className="font-semibold text-slate-900">Interview mode:</span> {interviewMode === "hr" ? "HR Interview" : "Technical Interview"}</div>
                <div><span className="font-semibold text-slate-900">Required skills:</span> {requiredSkills || "—"}</div>
                <div><span className="font-semibold text-slate-900">Optional skills:</span> {optionalSkills || "—"}</div>
                <div>
                  <span className="font-semibold text-slate-900">Experience range:</span>{" "}
                  {expMax > 0 ? `${expMin}–${expMax} years` : expMin > 0 ? `${expMin}+ years` : "Any / not set"}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Question type:</span> Dynamic Questions
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Intelligence suite:</span>{" "}
                  {selectedCategoryIds.length
                    ? `${selectedCategoryIds.length} domain(s) — ${suiteTargetRole || jobTitle || "—"}`
                    : "—"}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Adaptive next question:</span>{" "}
                  {adaptiveNextQuestion ? "Enabled" : "Disabled"}
                </div>
                {suiteSeniority ? (
                  <div>
                    <span className="font-semibold text-slate-900">Seniority:</span> {suiteSeniority}
                  </div>
                ) : null}
                {suiteTechStack ? (
                  <div>
                    <span className="font-semibold text-slate-900">Stack emphasis:</span> {suiteTechStack}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-extrabold tracking-tight">What gets saved</div>
              <div className="mt-2 text-sm text-slate-500">
                This template stores interview setup fields, template instructions for AI prompts, opportunity/customer references, and interview configuration.
              </div>
            </div>

            <div className="lg:col-span-12 rounded-2xl border border-slate-200 bg-slate-900 text-slate-100 p-5">
              <button
                type="button"
                onClick={() => setPromptExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-extrabold tracking-tight">AI Prompt Configuration</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Review and customize the exact prompt used for AI question generation.
                  </div>
                </div>
                <div className="text-slate-300">{promptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
              </button>

              {promptExpanded ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-slate-400">
                      Characters: <span className="font-semibold text-slate-200">{promptCharCount}</span> | Tokens (est):{" "}
                      <span className="font-semibold text-slate-200">{promptTokenEstimate}</span> | Version:{" "}
                      <span className="font-semibold text-slate-200">{promptVersion}</span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={adaptiveNextQuestion}
                        onChange={(e) => setAdaptiveNextQuestion(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                      />
                      Adaptive next-question mode
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText((promptPreview || editedPrompt || generatedPrompt || "").trim())}
                        className="h-8 px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Prompt
                      </button>
                      <button
                        type="button"
                        onClick={resetPromptToDefault}
                        className="h-8 px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                      </button>
                      <button
                        type="button"
                        onClick={testPrompt}
                        disabled={promptTestBusy}
                        className="h-8 px-3 rounded-lg border border-indigo-400/40 bg-indigo-500/20 hover:bg-indigo-500/30 text-xs font-semibold text-indigo-100"
                      >
                        {promptTestBusy ? "Generating 15–20…" : "Test Prompt (15–20)"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Editable Prompt</div>
                    <textarea
                      value={editedPrompt}
                      onChange={(e) => {
                        promptDraftTouchedRef.current = true;
                        setEditedPrompt(e.target.value);
                      }}
                      rows={12}
                      spellCheck={false}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[220px] max-h-[560px] overflow-auto"
                      placeholder={generatedPrompt || "Generating default prompt..."}
                    />
                    <div className="mt-1.5 text-[11px] text-slate-400">
                      Leave blank to use the generated default prompt. Custom prompt is sanitized and size-limited before save.
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Live Prompt Preview</div>
                    <pre className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-6 font-mono text-slate-200 overflow-auto max-h-[340px] whitespace-pre-wrap">
                      {promptBusy ? "Refreshing prompt preview..." : promptPreview || generatedPrompt || "No prompt yet."}
                    </pre>
                  </div>

                  {promptTestQuestions.length > 0 ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-[11px] uppercase tracking-widest font-bold text-emerald-300">
                          Sample Output ({promptTestQuestions.length} questions)
                        </div>
                        <div className="text-[10px] text-emerald-200/80">Preview only — not saved to the template</div>
                      </div>
                      <ol className="space-y-2 text-sm text-emerald-100 list-decimal list-inside max-h-[360px] overflow-auto">
                        {promptTestQuestions.map((q, idx) => (
                          <li key={`${idx}-${q.slice(0, 24)}`} className="leading-relaxed">
                            {q}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

