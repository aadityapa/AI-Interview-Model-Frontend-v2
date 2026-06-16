/** Opportunity ID + customer name from the linked job template. */
export function CrmMetaLine({
  opportunityId,
  customerName,
  className = "",
  compact = false,
}: {
  opportunityId?: string;
  customerName?: string;
  className?: string;
  compact?: boolean;
}) {
  const opp = String(opportunityId || "").trim();
  const cust = String(customerName || "").trim();
  if (!opp && !cust) return null;

  const labelCls = compact ? "font-bold text-slate-500" : "font-bold text-slate-600 dark:text-slate-400";
  const valueCls = compact ? "text-slate-600" : "text-slate-700 dark:text-slate-300";

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
      {opp ? (
        <span className={valueCls}>
          <span className={labelCls}>Opportunity ID:</span> {opp}
        </span>
      ) : null}
      {cust ? (
        <span className={valueCls}>
          <span className={labelCls}>Customer:</span> {cust}
        </span>
      ) : null}
    </div>
  );
}
