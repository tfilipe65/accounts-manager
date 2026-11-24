// A single-value ring: how much of a whole something takes up (for example overheads as a share of
// sales). Draws the share and the remainder, with the percentage in the centre.

export default function DonutChart({
  value,
  color = "#2a78d6",
  label,
  size = 120,
}: {
  /** 0 to 1 (values above 1 fill the ring and are shown as-is in the centre). */
  value: number | null;
  color?: string;
  label?: string;
  size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * share} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={size / 5} fontWeight={600} fill="var(--foreground)">
          {value == null ? "—" : `${(value * 100).toFixed(1)}%`}
        </text>
      </svg>
      {label && <span className="text-center text-xs text-neutral-600">{label}</span>}
    </div>
  );
}
