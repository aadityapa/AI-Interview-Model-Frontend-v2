export function PdfScoreBar({
  value,
  tone = "indigo",
}: {
  value: number;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "violet";
}) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const bar =
    tone === "emerald"
      ? "#059669"
      : tone === "amber"
        ? "#d97706"
        : tone === "rose"
          ? "#dc2626"
          : tone === "violet"
            ? "#7c3aed"
            : "#4f46e5";
  return (
    <div
      style={{
        height: 8,
        borderRadius: 9999,
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div style={{ height: "100%", width: `${v}%`, background: bar }} />
    </div>
  );
}
