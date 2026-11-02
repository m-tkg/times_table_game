interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: NoInfer<T>; label: string }>;
  onChange(value: NoInfer<T>): void;
  hint?: string;
}

export function Segmented<T extends string | number>({ label, value, options, onChange, hint }: SegmentedProps<T>) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="segmented">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
