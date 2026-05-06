"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface LineChartData {
  label: string;
  value: number;
}

interface AnalyticsChartsProps {
  title: string;
  type: "bar" | "line" | "donut";
  data: BarChartData[] | LineChartData[];
  height?: number;
  className?: string;
}

const COLORS = {
  accent: "#575757",
  accentLight: "#6b6b6b",
  info: "#0891b2",
  warning: "#d97706",
  success: "#16a34a",
};

const defaultColors = [COLORS.accent, COLORS.info, COLORS.warning, COLORS.success];

export function AnalyticsCharts({
  title,
  type,
  data,
  height = 200,
  className,
}: AnalyticsChartsProps) {
  if (data.length === 0) {
    return (
      <Card variant="elevated" padding="md" className={className}>
        <h4 className="text-sm font-heading font-semibold text-foreground mb-3">{title}</h4>
        <div className="flex items-center justify-center h-40">
          <p className="text-muted font-mono text-xs">No data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="md" className={className}>
      <h4 className="text-sm font-heading font-semibold text-foreground mb-4">{title}</h4>
      {type === "bar" && <BarChart data={data as BarChartData[]} height={height} />}
      {type === "line" && <LineChart data={data as LineChartData[]} height={height} />}
      {type === "donut" && <DonutChart data={data as BarChartData[]} />}
    </Card>
  );
}

function BarChart({ data, height }: { data: BarChartData[]; height: number }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(20, Math.min(60, (300 / data.length) - 8));

  return (
    <div className="flex items-end justify-center gap-2" style={{ height }}>
      {data.map((item, i) => {
        const h = (item.value / maxVal) * (height - 30);
        const color = item.color || defaultColors[i % defaultColors.length];
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono text-muted">
              {item.value}
            </span>
            <div
              className="rounded-t-md transition-all duration-500"
              style={{
                width: barWidth,
                height: Math.max(4, h),
                background: `linear-gradient(to top, ${color}33, ${color})`,
              }}
            />
            <span className="text-[10px] font-mono text-muted truncate max-w-[60px] text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data, height }: { data: LineChartData[]; height: number }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;
  const w = 280;
  const padding = 10;

  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1 || 1)) * (w - 2 * padding),
    y: padding + ((maxVal - d.value) / range) * (height - 2 * padding - 20),
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - 20} L ${points[0].x} ${height - 20} Z`;

  return (
    <div className="flex justify-center">
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGrad)" />
        <path
          d={pathD}
          fill="none"
          stroke={COLORS.accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={COLORS.accent}
            stroke="#D8C9AE"
            strokeWidth="1.5"
          />
        ))}
        {data.map((d, i) => {
          if (data.length > 10 && i % Math.ceil(data.length / 10) !== 0) return null;
          return (
            <text
              key={i}
              x={points[i].x}
              y={height - 4}
              textAnchor="middle"
              className="fill-muted"
              fontSize="8"
              fontFamily="Space Mono, monospace"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data }: { data: BarChartData[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 70;
  const innerR = 45;

  const segments = useMemo(() => {
    let startAngle = -Math.PI / 2;
    return data.map((item, i) => {
      const angle = (item.value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const color = item.color || defaultColors[i % defaultColors.length];

      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(startAngle);
      const y4 = cy + innerR * Math.sin(startAngle);

      const d = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      startAngle = endAngle;
      return { d, color, label: item.label, value: item.value };
    });
  }, [data, total]);

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill={seg.color}
            opacity={0.8}
            className="hover:opacity-100 transition-opacity"
          />
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground"
          fontSize="18"
          fontFamily="Space Grotesk, system-ui"
          fontWeight="bold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          className="fill-muted"
          fontSize="8"
          fontFamily="Space Mono, monospace"
        >
          total
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs font-mono text-muted">
              {seg.label}: {seg.value} ({Math.round((seg.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
