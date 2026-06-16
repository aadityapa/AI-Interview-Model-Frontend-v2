import {
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INDIGO = "#6366f1";

export function SkillBarChart({ data }: { data: { skill: string; score: number }[] }) {
  const chartData = (data || []).map((d) => ({
    name: d.skill.length > 18 ? `${d.skill.slice(0, 16)}…` : d.skill,
    full: d.skill,
    score: Math.max(0, Math.min(100, Math.round(Number(d.score) || 0))),
  }));
  if (!chartData.length) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        No per-skill breakdown for this interview.
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="#64748b" />
          <Tooltip
            formatter={(v: number) => [`${v}%`, "Score"]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.full as string) || ""}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          />
          <Bar dataKey="score" radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={`hsl(${235 + (i % 5) * 12}, 72%, ${52 - (i % 3) * 4}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type RadarRow = { subject: string; A: number; full: string };

export function PerformanceRadar({
  communication,
  technical,
  confidence,
  problemSolving,
  overall,
}: {
  communication: number;
  technical: number;
  confidence: number;
  problemSolving: number;
  overall: number;
}) {
  const data: RadarRow[] = [
    { subject: "Comm", A: communication, full: "Communication" },
    { subject: "Tech", A: technical, full: "Technical" },
    { subject: "Conf", A: confidence, full: "Confidence" },
    { subject: "Solve", A: problemSolving, full: "Problem solving" },
    { subject: "Overall", A: overall, full: "Overall" },
  ];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="#cbd5e1" className="dark:stroke-slate-600" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip
            formatter={(v: number, _n, item) => [`${Math.round(v)}%`, (item?.payload as RadarRow)?.full || ""]}
            contentStyle={{ borderRadius: 12 }}
          />
          <Radar name="Score" dataKey="A" stroke={INDIGO} fill={INDIGO} fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
