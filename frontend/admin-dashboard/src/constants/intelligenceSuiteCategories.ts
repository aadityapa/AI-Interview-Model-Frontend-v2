import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Code,
  Layout,
  Layers,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  Users,
  Zap,
} from "lucide-react";

export type IntelligenceSuiteCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
};

export const INTELLIGENCE_SUITE_CATEGORIES: IntelligenceSuiteCategory[] = [
  {
    id: "fundamental",
    title: "Fundamental / Core Concept",
    icon: BookOpen,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    id: "scenario",
    title: "Scenario-Based",
    icon: Settings,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  {
    id: "debugging",
    title: "Debugging & Troubleshooting",
    icon: Terminal,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  {
    id: "hands-on",
    title: "Hands-On Implementation",
    icon: Layers,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  {
    id: "deep-dive",
    title: "Project Deep-Dive",
    icon: Search,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    id: "adaptive",
    title: "Adaptive Follow-Up",
    icon: Zap,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  {
    id: "oem",
    title: "OEM / Production-Level",
    icon: ShieldCheck,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
  },
  {
    id: "architecture",
    title: "Architecture & Design",
    icon: Layout,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
  },
  {
    id: "logic",
    title: "Coding / Logic",
    icon: Code,
    color: "text-violet-600",
    bgColor: "bg-violet-100",
  },
  {
    id: "communication",
    title: "Communication & Explanation",
    icon: MessageSquare,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    id: "behavioral",
    title: "Behavioral",
    icon: Users,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
  {
    id: "leadership",
    title: "Leadership / Managerial",
    icon: Briefcase,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
];
