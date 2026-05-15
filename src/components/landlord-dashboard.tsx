import type {
  CashflowPoint,
  ComparisonDelta,
  RentCollectionStatusCounts,
} from '@/lib/finance/landlord-financials';

export type LandlordDashboardData = {
  monthlyRentExpected: number;
  monthlyRentCollected: number;
  outstandingBalance: number;
  overdueAmount: number;
  occupancyRate: number;
  netCashflow: number;
  activeTenants: number;
  openMaintenance: number;
  leaseExpirations: number;
  comparison: {
    rentCollected: ComparisonDelta;
    overdueAmount: ComparisonDelta;
    occupancyRate: ComparisonDelta;
    activeTenants: ComparisonDelta;
  };
  cashflowSeries: CashflowPoint[];
  rentCollectionStatus: RentCollectionStatusCounts;
};

const moneyFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return `CI$ ${moneyFmt.format(Math.round(value))}`;
}

function ChangeBadge({
  delta,
  goodWhenUp,
  format = 'percent',
}: {
  delta: ComparisonDelta;
  goodWhenUp: boolean;
  format?: 'percent' | 'count';
}) {
  const { direction, deltaPct, current, previous } = delta;
  if (direction === 'flat') {
    return (
      <p className="mt-2 text-xs text-slate-500">No change vs last month</p>
    );
  }

  const isGood = goodWhenUp ? direction === 'up' : direction === 'down';
  const colorClass = isGood ? 'text-emerald-600' : 'text-red-600';
  const arrow = direction === 'up' ? '▲' : '▼';

  let label: string;
  if (format === 'count') {
    const diff = current - previous;
    const sign = diff > 0 ? '+' : '';
    label = `${sign}${diff}`;
  } else {
    label = `${Math.abs(deltaPct).toFixed(1)}%`;
  }

  return (
    <p className={`mt-2 text-xs font-medium ${colorClass}`}>
      <span aria-hidden>{arrow}</span> {label}
      <span className="ml-1 font-normal text-slate-500">vs last month</span>
    </p>
  );
}

function KpiCard({
  label,
  value,
  delta,
  goodWhenUp,
  format = 'percent',
  accent,
  icon,
}: {
  label: string;
  value: string;
  delta: ComparisonDelta;
  goodWhenUp: boolean;
  format?: 'percent' | 'count';
  accent: 'emerald' | 'red' | 'sky' | 'violet';
  icon: string;
}) {
  const accentClass = {
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
  }[accent];

  return (
    <div className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${accentClass}`}
          aria-hidden
        >
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <ChangeBadge delta={delta} goodWhenUp={goodWhenUp} format={format} />
    </div>
  );
}

const STATUS_PALETTE = {
  paid: '#10b981',
  pending: '#f59e0b',
  overdue: '#ef4444',
  partial: '#94a3b8',
};

function RentCollectionStatusCard({ counts }: { counts: RentCollectionStatusCounts }) {
  const { paid, pending, overdue, partial, total } = counts;
  const radius = 60;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;

  const segments =
    total === 0
      ? []
      : [
          { key: 'paid', value: paid, color: STATUS_PALETTE.paid },
          { key: 'pending', value: pending, color: STATUS_PALETTE.pending },
          { key: 'overdue', value: overdue, color: STATUS_PALETTE.overdue },
          { key: 'partial', value: partial, color: STATUS_PALETTE.partial },
        ];

  let cumulative = 0;
  const arcs = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const fraction = segment.value / total;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const rotation = (cumulative / total) * 360 - 90;
      cumulative += segment.value;
      return { ...segment, dash, gap, rotation };
    });

  function pct(value: number) {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  return (
    <section className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
      <h3 className="font-semibold text-slate-950">Rent Collection Status</h3>
      <div className="mt-4 grid grid-cols-[160px_1fr] items-center gap-4">
        <div className="relative">
          <svg viewBox="0 0 160 160" className="h-40 w-40">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={stroke}
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeLinecap="butt"
                transform={`rotate(${arc.rotation} 80 80)`}
              />
            ))}
            <text
              x="80"
              y="76"
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: '11px' }}
            >
              Total
            </text>
            <text
              x="80"
              y="96"
              textAnchor="middle"
              className="fill-slate-950"
              style={{ fontSize: '22px', fontWeight: 600 }}
            >
              {total}
            </text>
          </svg>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_PALETTE.paid }}
                aria-hidden
              />
              <span className="text-slate-700">Paid</span>
            </span>
            <span className="text-slate-500">
              <span className="font-medium text-slate-900">{paid}</span>{' '}
              ({pct(paid)}%)
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_PALETTE.pending }}
                aria-hidden
              />
              <span className="text-slate-700">Pending</span>
            </span>
            <span className="text-slate-500">
              <span className="font-medium text-slate-900">{pending}</span>{' '}
              ({pct(pending)}%)
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_PALETTE.overdue }}
                aria-hidden
              />
              <span className="text-slate-700">Overdue</span>
            </span>
            <span className="text-slate-500">
              <span className="font-medium text-slate-900">{overdue}</span>{' '}
              ({pct(overdue)}%)
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_PALETTE.partial }}
                aria-hidden
              />
              <span className="text-slate-700">Partial</span>
            </span>
            <span className="text-slate-500">
              <span className="font-medium text-slate-900">{partial}</span>{' '}
              ({pct(partial)}%)
            </span>
          </li>
        </ul>
      </div>
      {total === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          No payments are scheduled for the current month yet.
        </p>
      )}
    </section>
  );
}

function CashflowChartCard({
  series,
  currentTotal,
}: {
  series: CashflowPoint[];
  currentTotal: number;
}) {
  const width = 600;
  const height = 220;
  const padLeft = 56;
  const padRight = 12;
  const padTop = 20;
  const padBottom = 28;

  const max = Math.max(1, ...series.map((point) => point.rentCollected));

  // Nice rounded ceiling for y-axis
  const ceiling = (() => {
    if (max <= 1000) return 1000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  })();

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((ceiling / yTicks) * i),
  );

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW;
  const pointFor = (point: CashflowPoint, index: number) => {
    const x = padLeft + stepX * index;
    const y =
      padTop + innerH - (point.rentCollected / ceiling) * innerH;
    return { x, y };
  };

  const points = series.map(pointFor);
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  function formatTick(value: number) {
    if (value >= 1000) return `${Math.round(value / 1000)}K`;
    return `${value}`;
  }

  return (
    <section className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-950">
          Cash Flow <span className="text-xs font-normal text-slate-500">(last 6 months)</span>
        </h3>
        <p className="text-lg font-semibold text-brand-navy">
          {formatMoney(currentTotal)}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-56 w-full"
        role="img"
        aria-label="Cash flow over the last 6 months"
      >
        <defs>
          <linearGradient id="cashflowGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {tickValues.map((value, i) => {
          const y = padTop + innerH - (value / ceiling) * innerH;
          return (
            <g key={`tick-${i}`}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: '10px' }}
              >
                {formatTick(value)}
              </text>
            </g>
          );
        })}

        {areaPath && (
          <path d={areaPath} fill="url(#cashflowGradient)" stroke="none" />
        )}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((point, i) => (
          <circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r={3.5}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={1.5}
          >
            <title>
              {series[i].label}: {formatMoney(series[i].rentCollected)}
            </title>
          </circle>
        ))}

        {series.map((point, i) => {
          const x = padLeft + stepX * i;
          return (
            <text
              key={`xlabel-${i}`}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: '11px' }}
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </section>
  );
}

function SecondaryStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function LandlordDashboardOverview({
  metrics,
}: {
  metrics: LandlordDashboardData;
}) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Monthly Rent Collected"
          value={formatMoney(metrics.monthlyRentCollected)}
          delta={metrics.comparison.rentCollected}
          goodWhenUp
          accent="emerald"
          icon="$"
        />
        <KpiCard
          label="Overdue Amount"
          value={formatMoney(metrics.overdueAmount)}
          delta={metrics.comparison.overdueAmount}
          goodWhenUp={false}
          accent="red"
          icon="!"
        />
        <KpiCard
          label="Occupancy Rate"
          value={`${metrics.occupancyRate}%`}
          delta={metrics.comparison.occupancyRate}
          goodWhenUp
          accent="sky"
          icon="◉"
        />
        <KpiCard
          label="Active Tenants"
          value={String(metrics.activeTenants)}
          delta={metrics.comparison.activeTenants}
          goodWhenUp
          format="count"
          accent="violet"
          icon="◉"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        <RentCollectionStatusCard counts={metrics.rentCollectionStatus} />
        <CashflowChartCard
          series={metrics.cashflowSeries}
          currentTotal={metrics.monthlyRentCollected}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SecondaryStatCard
          label="Monthly Rent Expected"
          value={formatMoney(metrics.monthlyRentExpected)}
        />
        <SecondaryStatCard
          label="Outstanding Balance"
          value={formatMoney(metrics.outstandingBalance)}
          hint="Across current-month payments"
        />
        <SecondaryStatCard
          label="Net Cashflow"
          value={formatMoney(metrics.netCashflow)}
          hint="Collected − expenses, this month"
        />
        <SecondaryStatCard
          label="Open Maintenance"
          value={String(metrics.openMaintenance)}
        />
        <SecondaryStatCard
          label="Lease Expirations"
          value={String(metrics.leaseExpirations)}
          hint="Within the next 60 days"
        />
      </section>
    </div>
  );
}
