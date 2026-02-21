/**
 * Latency Gauge Component
 * Visual gauge for displaying real-time latency metrics with SLA thresholds
 */

import React, { useMemo } from 'react';

// ============================================
// TYPES
// ============================================

interface LatencyGaugeProps {
  label: string;
  currentValue: number;
  targetValue: number;
  maxValue?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
  trend?: 'improving' | 'stable' | 'degrading';
  className?: string;
}

type GaugeStatus = 'good' | 'warning' | 'critical';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatus(current: number, target: number): GaugeStatus {
  const ratio = current / target;
  if (ratio <= 0.8) return 'good';
  if (ratio <= 1.0) return 'warning';
  return 'critical';
}

function getStatusColor(status: GaugeStatus): string {
  switch (status) {
    case 'good':
      return '#10B981';  // Green
    case 'warning':
      return '#F59E0B';  // Amber
    case 'critical':
      return '#EF4444';  // Red
  }
}

function getBackgroundColor(status: GaugeStatus): string {
  switch (status) {
    case 'good':
      return 'rgba(16, 185, 129, 0.1)';
    case 'warning':
      return 'rgba(245, 158, 11, 0.1)';
    case 'critical':
      return 'rgba(239, 68, 68, 0.1)';
  }
}

function getTrendIcon(trend: 'improving' | 'stable' | 'degrading'): string {
  switch (trend) {
    case 'improving':
      return '↓';
    case 'stable':
      return '→';
    case 'degrading':
      return '↑';
  }
}

function getTrendColor(trend: 'improving' | 'stable' | 'degrading'): string {
  switch (trend) {
    case 'improving':
      return '#10B981';
    case 'stable':
      return '#6B7280';
    case 'degrading':
      return '#EF4444';
  }
}

// ============================================
// COMPONENT
// ============================================

export const LatencyGauge: React.FC<LatencyGaugeProps> = ({
  label,
  currentValue,
  targetValue,
  maxValue,
  unit = 'ms',
  size = 'md',
  showTrend = false,
  trend = 'stable',
  className = '',
}) => {
  const effectiveMax = maxValue || targetValue * 2;
  const status = getStatus(currentValue, targetValue);
  const statusColor = getStatusColor(status);
  const bgColor = getBackgroundColor(status);

  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm':
        return { width: 120, height: 80, strokeWidth: 8, fontSize: 14 };
      case 'lg':
        return { width: 200, height: 120, strokeWidth: 14, fontSize: 22 };
      default:
        return { width: 160, height: 100, strokeWidth: 10, fontSize: 18 };
    }
  }, [size]);

  // Calculate arc parameters
  const { width, height, strokeWidth, fontSize } = dimensions;
  const radius = (width - strokeWidth) / 2;
  const centerX = width / 2;
  const centerY = height - 10;

  // Arc goes from -180° to 0° (bottom half of circle)
  const startAngle = -180;
  const endAngle = 0;
  const angleRange = endAngle - startAngle;

  // Calculate the angle for current value
  const valuePercent = Math.min(currentValue / effectiveMax, 1);
  const valueAngle = startAngle + valuePercent * angleRange;

  // Calculate the angle for target threshold
  const targetPercent = targetValue / effectiveMax;
  const targetAngle = startAngle + targetPercent * angleRange;

  // Convert angle to coordinates
  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    };
  };

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const current = polarToCartesian(valueAngle);
  const target = polarToCartesian(targetAngle);

  // Create arc path
  const createArc = (startPoint: { x: number; y: number }, endPoint: { x: number; y: number }, largeArc: number) => {
    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
  };

  const backgroundArc = createArc(start, end, 0);
  const valueArc = createArc(start, current, valuePercent > 0.5 ? 1 : 0);

  return (
    <div
      className={`latency-gauge ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: bgColor,
        border: `1px solid ${statusColor}20`,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: fontSize * 0.7,
          fontWeight: 500,
          color: '#6B7280',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>

      {/* Gauge SVG */}
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d={valueArc}
          fill="none"
          stroke={statusColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />

        {/* Target threshold marker */}
        <circle
          cx={target.x}
          cy={target.y}
          r={strokeWidth / 2 + 2}
          fill="white"
          stroke="#374151"
          strokeWidth={2}
        />

        {/* Current value text */}
        <text
          x={centerX}
          y={centerY - 15}
          textAnchor="middle"
          style={{
            fontSize: fontSize * 1.2,
            fontWeight: 700,
            fill: statusColor,
          }}
        >
          {currentValue.toFixed(0)}
          <tspan style={{ fontSize: fontSize * 0.6 }}>{unit}</tspan>
        </text>
      </svg>

      {/* Target info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '8px',
          fontSize: fontSize * 0.65,
          color: '#6B7280',
        }}
      >
        <span>Target: {targetValue}{unit}</span>
        {showTrend && (
          <span
            style={{
              color: getTrendColor(trend),
              fontWeight: 600,
            }}
          >
            {getTrendIcon(trend)}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div
        style={{
          marginTop: '8px',
          padding: '4px 12px',
          borderRadius: '9999px',
          backgroundColor: statusColor,
          color: 'white',
          fontSize: fontSize * 0.6,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {status === 'good' ? 'Within SLA' : status === 'warning' ? 'At Risk' : 'Violation'}
      </div>
    </div>
  );
};

// ============================================
// LATENCY GAUGES GRID
// ============================================

interface LatencyGaugesGridProps {
  gauges: Array<{
    label: string;
    current: number;
    target: number;
    trend?: 'improving' | 'stable' | 'degrading';
  }>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LatencyGaugesGrid: React.FC<LatencyGaugesGridProps> = ({
  gauges,
  size = 'md',
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
      }}
    >
      {gauges.map((gauge, index) => (
        <LatencyGauge
          key={index}
          label={gauge.label}
          currentValue={gauge.current}
          targetValue={gauge.target}
          size={size}
          showTrend={!!gauge.trend}
          trend={gauge.trend}
        />
      ))}
    </div>
  );
};

export default LatencyGauge;
