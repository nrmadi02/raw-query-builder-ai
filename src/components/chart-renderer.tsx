"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "oklch(0.6 0.15 250)",
  "oklch(0.65 0.15 160)",
  "oklch(0.7 0.15 30)",
  "oklch(0.6 0.2 300)",
  "oklch(0.55 0.15 60)",
];

interface ChartRendererProps {
  data: Record<string, unknown>[];
  chartType: string;
}

function detectColumns(data: Record<string, unknown>[]) {
  if (data.length === 0) return { labelKey: "", valueKey: "" };

  const keys = Object.keys(data[0]);
  let labelKey = "";
  let valueKey = "";

  for (const key of keys) {
    const sample = data[0][key];
    if (!labelKey && typeof sample === "string") {
      labelKey = key;
    } else if (!valueKey && typeof sample === "number") {
      valueKey = key;
    }
    if (labelKey && valueKey) break;
  }

  // Fallback: use first two columns
  if (!labelKey && keys.length > 0) labelKey = keys[0];
  if (!valueKey && keys.length > 1) valueKey = keys[1];

  return { labelKey, valueKey };
}

export default function ChartRenderer({ data, chartType }: ChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No data to display
      </div>
    );
  }

  if (chartType === "table") {
    return <TableView data={data} />;
  }

  const { labelKey, valueKey } = detectColumns(data);
  if (!labelKey || !valueKey) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Could not detect label and value columns
      </div>
    );
  }

  const chartData = useMemo(
    () =>
      data.slice(0, 20).map((row) => ({
        name: String(row[labelKey] ?? ""),
        value: Number(row[valueKey]) || 0,
      })),
    [data, labelKey, valueKey],
  );

  return (
    <div className="p-4">
      <ResponsiveContainer width="100%" height={350}>
        {chartType === "bar" ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke={COLORS[1]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        ) : chartType === "pie" ? (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              nameKey="name"
              label={(entry) => entry.name}
              labelLine={true}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  );
}

function TableView({ data }: { data: Record<string, unknown>[] }) {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  const displayData = data.slice(0, 20);

  return (
    <div className="p-4 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-2 border-b font-medium text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 whitespace-nowrap">
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 20 && (
        <p className="text-xs text-muted-foreground mt-2">
          Showing 20 of {data.length} rows
        </p>
      )}
    </div>
  );
}
