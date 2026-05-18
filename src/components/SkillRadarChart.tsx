import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { RadarScores } from '../utils/playerRating';

interface Props {
  radar: RadarScores;
  color?: string;
  size?: number;
  showLabels?: boolean;
  animated?: boolean;
}

export function SkillRadarChart({
  radar,
  color = '#34d399',
  size = 240,
  showLabels = true,
}: Props) {
  const data = [
    { subject: 'Batting', value: radar.batting },
    { subject: 'Bowling', value: radar.bowling },
    { subject: 'Fielding', value: radar.fielding },
    { subject: 'Consistency', value: radar.consistency },
    { subject: 'Impact', value: radar.impact },
  ];

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(150,150,150,0.2)" strokeWidth={1} />
        {showLabels && (
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
          />
        )}
        <Radar
          name="Skills"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
        <Tooltip
          formatter={(value: number | string | undefined) => [value ?? '', 'Score']}
          contentStyle={{
            backgroundColor: 'rgba(17,24,39,0.9)',
            border: 'none',
            borderRadius: '8px',
            color: '#f9fafb',
            fontSize: '12px',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
