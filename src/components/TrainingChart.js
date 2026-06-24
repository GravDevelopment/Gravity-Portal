import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

const PALETTE = [
  '#d2232a', '#2563eb', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];

function fmtMonth(str) {
  const [y, m] = str.split('-');
  return new Date(y, m - 1).toLocaleString('en-ZA', { month: 'short', year: '2-digit' });
}

function buildData(records, groupBy) {
  const byMonth = {};
  const keys = new Set();

  records.forEach(r => {
    if (!r.submittedDate) return;
    const month = r.submittedDate.slice(0, 7);
    const key = groupBy === 'status' ? r.status
              : groupBy === 'course' ? r.course
              : groupBy === 'venue'  ? r.venue
              : 'Total';
    keys.add(key);
    if (!byMonth[month]) byMonth[month] = { month };
    byMonth[month][key] = (byMonth[month][key] || 0) + 1;
  });

  return {
    data: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    keys: [...keys].sort(),
  };
}

export const GROUP_OPTIONS = [
  { value: 'all',    label: 'All' },
  { value: 'status', label: 'By Status' },
  { value: 'region', label: 'By Region' },
  { value: 'course', label: 'By Course' },
];

export default function TrainingChart({ records, groupBy = 'status' }) {
  const { isDark } = useTheme();
  const { data, keys } = buildData(records, groupBy);

  const gridColor     = isDark ? '#3f3f46' : '#e5e7eb';
  const textColor     = isDark ? '#a1a1aa' : '#6b7280';
  const tooltipBg     = isDark ? '#27272a' : '#ffffff';
  const tooltipBorder = isDark ? '#3f3f46' : '#e5e7eb';

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={fmtMonth}
            tick={{ fontSize: 12, fill: textColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: textColor }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 8,
              fontSize: 13,
            }}
            labelFormatter={fmtMonth}
            cursor={{ stroke: gridColor }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 16 }}
            formatter={val => <span style={{ color: textColor }}>{val}</span>}
          />
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: PALETTE[i % PALETTE.length] }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
