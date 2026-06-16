import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, CircleAlert, Loader2, PauseCircle, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { InterviewStatus } from "../../types";
import { patchInterviewHrStatus } from "../../api";

// May 2026: added "On Hold" as a fourth interview-level outcome so the dropdown
// stays in lockstep with the candidate-level decision buttons on the report
// page (Shortlist / On Hold / Reject).
const OPTIONS: { value: InterviewStatus; label: string; description: string }[] = [
  { value: "Selected", label: "Selected", description: "Move forward in pipeline" },
  { value: "On Hold", label: "On Hold", description: "Park decision — keep in pipeline" },
  { value: "Pending Review", label: "Pending Review", description: "Needs HR follow-up" },
  { value: "Rejected", label: "Rejected", description: "Close this interview outcome" },
];

function normalizeIncomingStatus(raw: string): InterviewStatus {
  const s = String(raw || "").toLowerCase();
  if (s.includes("reject")) return "Rejected";
  if (s.includes("select")) return "Selected";
  if (s.includes("hold")) return "On Hold";
  return "Pending Review";
}

function metaFor(status: InterviewStatus) {
  if (status === "Selected") {
    return {
      pill: "border-emerald-300/80 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-teal-500/10 text-emerald-800 dark:text-emerald-100 dark:border-emerald-500/40 dark:from-emerald-500/25 dark:via-emerald-600/10 dark:to-teal-900/30",
      glow: "shadow-[0_0_24px_-4px_rgba(16,185,129,0.55)] dark:shadow-[0_0_28px_-2px_rgba(52,211,153,0.35)]",
      pulse: "from-emerald-400/0 via-emerald-400/30 to-emerald-400/0",
      Icon: ThumbsUp,
    };
  }
  if (status === "Rejected") {
    return {
      pill: "border-rose-300/80 bg-gradient-to-br from-rose-500/15 via-rose-400/10 to-red-500/10 text-rose-800 dark:text-rose-100 dark:border-rose-500/40 dark:from-rose-500/25 dark:via-rose-900/20 dark:to-red-950/30",
      glow: "shadow-[0_0_24px_-4px_rgba(244,63,94,0.5)] dark:shadow-[0_0_28px_-2px_rgba(251,113,133,0.35)]",
      pulse: "from-rose-400/0 via-rose-400/35 to-rose-400/0",
      Icon: ThumbsDown,
    };
  }
  if (status === "On Hold") {
    return {
      pill: "border-amber-400/80 bg-gradient-to-br from-amber-500/20 via-amber-400/15 to-orange-500/15 text-amber-900 dark:text-amber-50 dark:border-amber-400/50 dark:from-amber-500/30 dark:via-amber-700/20 dark:to-orange-900/30",
      glow: "shadow-[0_0_24px_-4px_rgba(245,158,11,0.55)] dark:shadow-[0_0_28px_-2px_rgba(251,191,36,0.4)]",
      pulse: "from-amber-400/0 via-amber-400/40 to-amber-400/0",
      Icon: PauseCircle,
    };
  }
  return {
    pill: "border-amber-300/80 bg-gradient-to-br from-amber-400/15 via-amber-300/10 to-yellow-500/10 text-amber-900 dark:text-amber-100 dark:border-amber-500/40 dark:from-amber-500/20 dark:via-amber-900/15 dark:to-yellow-950/25",
    glow: "shadow-[0_0_22px_-4px_rgba(245,158,11,0.45)] dark:shadow-[0_0_26px_-2px_rgba(251,191,36,0.3)]",
    pulse: "from-amber-400/0 via-amber-400/35 to-amber-400/0",
    Icon: CircleAlert,
  };
}

const springSoft = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.85 };

export type InterviewStatusSelectorProps = {
  interviewId: string;
  status: InterviewStatus | string;
  disabled?: boolean;
  onUpdated: (next: InterviewStatus) => void;
  onToast?: (message: string, variant?: "success" | "error") => void;
};

type MenuCoords = { left: number; top: number; width: number; maxH: number };

/** Premium status control; menu renders in a portal with fixed coords so it is never clipped by tables or overflow. */
export function InterviewStatusSelector({ interviewId, status, disabled, onUpdated, onToast }: InterviewStatusSelectorProps) {
  const reduceMotion = useReducedMotion();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [local, setLocal] = useState<InterviewStatus>(() => normalizeIncomingStatus(String(status)));
  const [saving, setSaving] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const committedRef = useRef<InterviewStatus>(normalizeIncomingStatus(String(status)));
  const onUpdatedRef = useRef(onUpdated);
  const onToastRef = useRef(onToast);

  useEffect(() => {
    onUpdatedRef.current = onUpdated;
    onToastRef.current = onToast;
  }, [onUpdated, onToast]);

  useEffect(() => {
    const n = normalizeIncomingStatus(String(status));
    setLocal(n);
    committedRef.current = n;
  }, [status]);

  const placeMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 10;
    const width = Math.max(272, r.width);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - r.bottom - margin - 12;
    const spaceAbove = r.top - margin - 12;
    const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
    if (preferBelow) {
      const top = r.bottom + margin;
      setCoords({ left, top, width, maxH: Math.max(140, spaceBelow) });
    } else {
      const maxH = Math.max(140, spaceAbove);
      const top = Math.max(12, r.top - margin - maxH);
      setCoords({ left, top, width, maxH });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placeMenu();
    const onReposition = () => placeMenu();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placeMenu]);

  const persist = useCallback(
    async (next: InterviewStatus) => {
      const prev = committedRef.current;
      if (next === prev) {
        setOpen(false);
        return;
      }
      setLocal(next);
      setSaving(true);
      setOpen(false);
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await patchInterviewHrStatus(interviewId, next);
          committedRef.current = next;
          onUpdatedRef.current(next);
          onToastRef.current?.("Status saved", "success");
          setSaving(false);
          return;
        } catch (e) {
          lastErr = e;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 380 * attempt));
        }
      }
      setLocal(prev);
      committedRef.current = prev;
      onToastRef.current?.(String((lastErr as Error)?.message || lastErr), "error");
      setSaving(false);
    },
    [interviewId],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const m = metaFor(local);
  const Icon = m.Icon;

  const onPick = (next: InterviewStatus) => {
    if (disabled || saving) return;
    if (next === local) {
      setOpen(false);
      return;
    }
    void persist(next);
  };

  const menu =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              key={`status-menu-${interviewId}`}
              id={listId}
              ref={panelRef}
              role="listbox"
              aria-label="Interview status"
              style={{
                position: "fixed",
                left: coords.left,
                top: coords.top,
                width: coords.width,
                maxHeight: coords.maxH,
                zIndex: 6000,
              }}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={springSoft}
              className="flex flex-col overflow-hidden overflow-y-auto rounded-2xl border border-white/60 bg-white/95 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/10 backdrop-blur-xl dark:border-slate-600/80 dark:bg-slate-900/95 dark:shadow-black/50 dark:ring-white/10"
            >
              <div className="sticky top-0 z-[1] border-b border-slate-200/90 bg-gradient-to-r from-indigo-500/10 via-white/90 to-violet-500/10 px-4 py-2.5 backdrop-blur-md dark:border-slate-700/90 dark:from-indigo-500/15 dark:via-slate-900/95 dark:to-violet-500/10">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  Set interview outcome
                </div>
              </div>
              <div className="p-2">
                {OPTIONS.map((opt, idx) => {
                  const om = metaFor(opt.value);
                  const active = opt.value === local;
                  const OptIcon = om.Icon;
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...springSoft, delay: reduceMotion ? 0 : idx * 0.035 }}
                      onClick={() => onPick(opt.value)}
                      className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-200/80 dark:ring-indigo-500/40"
                          : "hover:bg-slate-100/95 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <span
                        className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${om.pill} ${active ? om.glow : ""}`}
                      >
                        <OptIcon className="h-4 w-4" />
                      </span>
                      <span className="relative z-[1] min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-slate-50">{opt.label}</span>
                          {active ? <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" /> : null}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">{opt.description}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div className="inline-flex">
      <motion.button
        ref={triggerRef}
        type="button"
        disabled={disabled || saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => !disabled && !saving && setOpen((o) => !o)}
        onMouseMove={(e) => {
          if (reduceMotion || disabled) return;
          const el = e.currentTarget;
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          setTilt({ x: py * -5, y: px * 6 });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ transform: `perspective(880px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        className={`group relative inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-left backdrop-blur-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${m.pill} ${m.glow} ${
          disabled || saving ? "opacity-60 pointer-events-none" : "hover:brightness-[1.03] dark:hover:brightness-110"
        }`}
      >
        {!reduceMotion ? (
          <motion.span
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r ${m.pulse} opacity-0 group-hover:opacity-100`}
            animate={{ opacity: open ? 0.2 : [0.1, 0.18, 0.1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <span className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-xl bg-white/55 dark:bg-slate-950/45 border border-white/60 dark:border-slate-700/80 shadow-inner">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-300" /> : <Icon className="h-3.5 w-3.5" />}
        </span>
        <span className="relative z-[1] min-w-[7.5rem]">
          <span className="block text-[10px] font-black uppercase tracking-widest opacity-70">Status</span>
          <span className="block text-xs font-black tracking-tight">{local}</span>
        </span>
        <ChevronDown className={`relative z-[1] h-4 w-4 shrink-0 opacity-70 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </motion.button>
      {menu}
    </div>
  );
}

/** Lightweight glass panel wrapper for section chrome (optional composition). */
export function FloatingGlassCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-3xl border border-white/50 bg-white/70 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/5 ${className}`}
    >
      {children}
    </div>
  );
}
