import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';

// ─── The season, as a shape ───────────────────────────────────────────────────
// A list of dates cannot show a trough. Twenty-four rows each reading "19" tell
// you nothing; one line dipping through November tells you where the season
// breaks, and the two side lines tell you WHICH squad breaks it — which is the
// number that decides whether an internal fixture can be played at all.

export interface DayPoint {
  date: string;
  label: string;
  total: number;
  brahmos: number;
  agni: number;
  hasFixture: boolean;
}

interface Props {
  data: DayPoint[];
  /** Eleven a side for an external match. */
  minTeam?: number;
  /** Eight a side is the smallest sensible internal game. */
  minPerSide?: number;
}

export function AvailabilityChart({ data, minTeam = 11, minPerSide = 8 }: Props) {
  if (data.length < 2) return null;

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 54, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="availFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} domain={[0, 'dataMax + 2']} />
          <Tooltip
            contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(0,0,0,.08)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* The two lines that actually decide a fixture. Drawn on top of the
              total, because a healthy total can still hide a side with six. */}
          <ReferenceLine y={minTeam} stroke="#f59e0b" strokeDasharray="4 4"
            label={{ value: `${minTeam} = a team`, position: 'right', fontSize: 10, fill: '#f59e0b' }} />
          <ReferenceLine y={minPerSide} stroke="#f43f5e" strokeDasharray="4 4"
            label={{ value: `${minPerSide} a side`, position: 'left', fontSize: 10, fill: '#f43f5e' }} />

          <Area type="monotone" dataKey="total" name="Free" stroke="#10b981"
            strokeWidth={2} fill="url(#availFill)" />
          <Line type="monotone" dataKey="brahmos" name="Brahmos" stroke="#7c3aed"
            strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="agni" name="Agni" stroke="#f59e0b"
            strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
