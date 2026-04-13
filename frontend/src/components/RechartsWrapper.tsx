"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface ChartDataItem {
  date: string;
  tasks: number;
  volume: number;
  reputation: number;
  [key: string]: any;
}

interface RechartsWrapperProps {
  data: ChartDataItem[];
  xKey: string;
  yKey: string;
  title: string;
  unit?: string;
  chartType?: "line" | "area" | "bar";
  height?: number;
}

export default function RechartsWrapper({
  data,
  xKey,
  yKey,
  title,
  unit,
  chartType = "line",
  height = 250
}: RechartsWrapperProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data;
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No data available
      </div>
    );
  }

  const domainY = [0, Math.max(...chartData.map(d => d[yKey])) * 1.1];

  return (
    <div className="w-full">
      <h3 className="font-silkscreen text-lg text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {chartType === "line" && (
          <LineChart data={chartData}>
            <XAxis dataKey={xKey} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis 
              domain={domainY} 
              tick={{ fill: "#9ca3af", fontSize: 12 }} 
              label={{ 
                angle: -90, 
                position: "insideLeft", 
                offset: -10, 
                children: unit || "",
                fill: "#9ca3af",
                fontSize: 12
              }} 
            >
              <YAxis.orientation="right" domain={domainY} tick={{ fill: "visible" }} />
            </YAxis>
            <Tooltip 
              wrapperStyle={{ outline: "none" }}
              contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid #374151", borderRadius: 4, padding: 8 }}
              labelStyle={{ color: "#f3f4f6", fontSize: 12 }}
              formatter={(value) => unit ? `${value} ${unit}` : value}
            >
              <Tooltip.labelStyle={{ color: "#9ca3af", fontSize: 12 }} />
            </Tooltip>
            <Legend verticalAlign="top" height={36} /> 
            <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        )}
        
        {chartType === "area" && (
          <AreaChart data={chartData}>
            <XAxis dataKey={xKey} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis 
              domain={domainY} 
              tick={{ fill: "#9ca3af", fontSize: 12 }} 
              label={{ 
                angle: -90, 
                position: "insideLeft", 
                offset: -10, 
                children: unit || "",
                fill: "#9ca3af",
                fontSize: 12
              }} 
            >
              <YAxis.orientation="right" domain={domainY} tick={{ fill: "visible" }} />
            </YAxis>
            <Tooltip 
              wrapperStyle={{ outline: "none" }}
              contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid #374151", borderRadius: 4, padding: 8 }}
              labelStyle={{ color: "#f3f4f6", fontSize: 12 }}
              formatter={(value) => unit ? `${value} ${unit}` : value}
            >
              <Tooltip.labelStyle={{ color: "#9ca3af", fontSize: 12 }} />
            </Tooltip>
            <Legend verticalAlign="top" height={36} />
            <Area type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} fillOpacity={0.6} dot={{ r: 4 }} />
          </AreaChart>
        )}
        
        {chartType === "bar" && (
          <BarChart data={chartData}>
            <XAxis dataKey={xKey} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis 
              domain={domainY} 
              tick={{ fill: "#9ca3af", fontSize: 12 }} 
              label={{ 
                angle: -90, 
                position: "insideLeft", 
                offset: -10, 
                children: unit || "",
                fill: "#9ca3af",
                fontSize: 12
              }} 
            >
              <YAxis.orientation="right" domain={domainY} tick={{ fill: "visible" }} />
            </YAxis>
            <Tooltip 
              wrapperStyle={{ outline: "none" }}
              contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid #374151", borderRadius: 4, padding: 8 }}
              labelStyle={{ color: "#f3f4f6", fontSize: 12 }}
              formatter={(value) => unit ? `${value} ${unit}` : value}
            >
              <Tooltip.labelStyle={{ color: "#9ca3af", fontSize: 12 }} />
            </Tooltip>
            <Legend verticalAlign="top" height={36} />
            <Bar dataKey={yKey} barSize={20} radius={[4, 4, 0, 0]} 
              fill={{ 
                prism: chartData.map((_, i) => 
                  `url(#colorGradient${i})` 
              })} 
            >
              {/* Define gradients for bars */}
              <defs>
                {chartData.map((_, i) => (
                  <linearGradient key={`grad-${i}`} id={`colorGradient${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][i % 4] || '#6b7280'} />
                    <stop offset="100%" stopColor={['#dc2626', '#d97706', '#2563eb', '#059669'][i % 4] || '#4b5563'} />
                  </linearGradient>
                ))}
              </defs>
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}