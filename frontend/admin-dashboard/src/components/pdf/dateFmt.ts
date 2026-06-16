const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function safeParseDate(value: string): number {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : 0;
}

export function fmtDateLabelPdf(date: string): string {
  if (!date) return "—";
  const t = safeParseDate(date);
  if (!t) return date;
  const d = new Date(t);
  const dd = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT[d.getMonth()] || "";
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  return `${dd} ${month} ${yyyy}, ${hh}:${minutes} ${meridiem}`;
}
