type DateRangePickerProps = {
  startName?: string;
  endName?: string;
  startValue?: string;
  endValue?: string;
  startLabel?: string;
  endLabel?: string;
};

export function DateRangePicker({
  startName = "startDate",
  endName = "endDate",
  startValue,
  endValue,
  startLabel = "Başlangıç",
  endLabel = "Bitiş"
}: DateRangePickerProps) {
  return (
    <>
      <label className="space-y-1">
        <span className="label">{startLabel}</span>
        <input className="field" type="date" name={startName} defaultValue={startValue} />
      </label>
      <label className="space-y-1">
        <span className="label">{endLabel}</span>
        <input className="field" type="date" name={endName} defaultValue={endValue} />
      </label>
    </>
  );
}
