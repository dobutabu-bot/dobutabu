export type ReminderAlertTone = "green" | "rose" | "amber" | "neutral";

type ReminderAlertCardProps = {
  label: string;
  value: string;
  tone: ReminderAlertTone;
};

export function ReminderAlertCard({ label, value, tone }: ReminderAlertCardProps) {
  const toneClass = {
    green: "border-slate-950 bg-slate-950 text-white",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-slate-200 bg-slate-50 text-slate-950"
  }[tone];

  return (
    <div className={`rounded-lg border p-3 shadow-soft ${toneClass}`}>
      <p className="text-xs font-medium uppercase opacity-75">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
