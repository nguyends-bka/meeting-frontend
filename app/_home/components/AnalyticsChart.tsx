import React, { useMemo, useState } from 'react';
import { Card, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';

const { Text } = Typography;

interface AnalyticsChartProps {
  allMeetings: HomeMeetingRow[];
}

export default function AnalyticsChart({ allMeetings }: AnalyticsChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; x: number; y: number; val: number } | null>(null);

  const chartData = useMemo(() => {
    // Generate last 7 days
    const last7Days = Array.from({ length: 7 }).map((_, i) => dayjs().subtract(6 - i, 'day'));
    
    return last7Days.map((day) => {
      // Count meetings on this day
      const count = allMeetings.filter((m) => dayjs(m.createdAt).isSame(day, 'day')).length;
      return {
        label: day.format('DD/MM'),
        value: count,
      };
    });
  }, [allMeetings]);

  const maxVal = useMemo(() => {
    const vals = chartData.map((d) => d.value);
    return Math.max(...vals, 4); // default scale to at least 4 meetings
  }, [chartData]);

  const totalMeetings = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);

  // Dimension settings for SVG viewBox
  const svgWidth = 500;
  const svgHeight = 120;
  const paddingX = 30;
  const paddingY = 20;

  const points = useMemo(() => {
    const widthAvailable = svgWidth - paddingX * 2;
    const heightAvailable = svgHeight - paddingY * 2;

    return chartData.map((d, index) => {
      const x = paddingX + (index / (chartData.length - 1)) * widthAvailable;
      const y = svgHeight - paddingY - (d.value / maxVal) * heightAvailable;
      return { x, y, val: d.value, label: d.label };
    });
  }, [chartData, maxVal]);

  // Construct SVG path for line
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((path, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  // Construct SVG path for area fill
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const bottomY = svgHeight - paddingY;
    return `${linePath} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  }, [points, linePath]);

  return (
    <Card
      variant="borderless"
      className="home-card"
      style={{ marginBottom: 24 }}
      styles={{ body: { padding: 20 } }}
      title={<span className="home-section-title"><LineChartOutlined style={{ color: '#2563eb' }} /> Tần suất họp (7 ngày)</span>}
    >
      {totalMeetings === 0 ? (
        <div className="chart-empty">
          <LineChartOutlined />
          <Text type="secondary">Chưa có cuộc họp nào trong 7 ngày qua</Text>
        </div>
      ) : (
      <>
      <div className="chart-container-svg">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Color gradient under the curve */}
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            {/* Grid Line Gradient */}
            <linearGradient id="gridLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="url(#gridLineGradient)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={paddingX} y1={(svgHeight - paddingY * 2) / 2 + paddingY} x2={svgWidth - paddingX} y2={(svgHeight - paddingY * 2) / 2 + paddingY} stroke="url(#gridLineGradient)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#e2e8f0" strokeWidth={1.5} />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#chartAreaGradient)" />

          {/* Line Path */}
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            className="chart-svg-path"
          />

          {/* Dots on points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth={2.5}
                className="chart-dot"
                onMouseEnter={() => setHoveredPoint({ index: i, x: p.x, y: p.y, val: p.val })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {/* X Axis Labels */}
              <text
                x={p.x}
                y={svgHeight - 4}
                textAnchor="middle"
                fill="#64748b"
                fontSize={10}
                fontWeight={600}
              >
                {p.label}
              </text>
            </g>
          ))}

          {/* Hover Tooltip inside SVG */}
          {hoveredPoint && (
            <g>
              <rect
                x={Math.max(10, hoveredPoint.x - 45)}
                y={Math.max(5, hoveredPoint.y - 32)}
                width={90}
                height={22}
                rx={6}
                fill="#0f172a"
                opacity={0.9}
              />
              <text
                x={Math.max(10, hoveredPoint.x - 45) + 45}
                y={Math.max(5, hoveredPoint.y - 32) + 14}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={10}
                fontWeight={700}
              >
                {hoveredPoint.val} cuộc họp
              </text>
            </g>
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Số cuộc họp thống kê thực tế theo từng ngày
        </Text>
      </div>
      </>
      )}
    </Card>
  );
}
