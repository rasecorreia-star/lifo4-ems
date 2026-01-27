/**
 * Thermal Map Component
 * Heatmap visualization of battery temperatures across zones
 */

import React, { useMemo } from 'react';

// ============================================
// TYPES
// ============================================

interface ThermalZone {
  id: string;
  name: string;
  temp: number;
  target: number;
  health: 'optimal' | 'good' | 'fair' | 'poor' | 'critical';
  row: number;
  col: number;
}

interface ThermalGradient {
  from: string;
  to: string;
  deltaT: number;
}

interface ThermalMapProps {
  zones: ThermalZone[];
  gradients?: ThermalGradient[];
  minTemp?: number;
  maxTemp?: number;
  rows?: number;
  cols?: number;
  showLabels?: boolean;
  showGradients?: boolean;
  onZoneClick?: (zone: ThermalZone) => void;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const interpolateColor = (
  temp: number,
  minTemp: number,
  maxTemp: number
): string => {
  const normalizedTemp = (temp - minTemp) / (maxTemp - minTemp);
  const clampedTemp = Math.max(0, Math.min(1, normalizedTemp));

  // Color gradient: Blue (cold) -> Green (normal) -> Yellow -> Red (hot)
  if (clampedTemp < 0.25) {
    // Blue to Cyan
    const t = clampedTemp / 0.25;
    return `rgb(${Math.round(59 + t * (6 - 59))}, ${Math.round(130 + t * (182 - 130))}, ${Math.round(246 + t * (212 - 246))})`;
  } else if (clampedTemp < 0.5) {
    // Cyan to Green
    const t = (clampedTemp - 0.25) / 0.25;
    return `rgb(${Math.round(6 + t * (16 - 6))}, ${Math.round(182 + t * (185 - 182))}, ${Math.round(212 + t * (129 - 212))})`;
  } else if (clampedTemp < 0.75) {
    // Green to Yellow
    const t = (clampedTemp - 0.5) / 0.25;
    return `rgb(${Math.round(16 + t * (245 - 16))}, ${Math.round(185 + t * (158 - 185))}, ${Math.round(129 + t * (11 - 129))})`;
  } else {
    // Yellow to Red
    const t = (clampedTemp - 0.75) / 0.25;
    return `rgb(${Math.round(245 + t * (239 - 245))}, ${Math.round(158 + t * (68 - 158))}, ${Math.round(11 + t * (68 - 11))})`;
  }
};

const getHealthColor = (health: string): string => {
  switch (health) {
    case 'optimal':
      return '#10B981';
    case 'good':
      return '#3B82F6';
    case 'fair':
      return '#F59E0B';
    case 'poor':
      return '#F97316';
    case 'critical':
      return '#EF4444';
    default:
      return '#6B7280';
  }
};

// ============================================
// COMPONENT
// ============================================

export const ThermalMap: React.FC<ThermalMapProps> = ({
  zones,
  gradients = [],
  minTemp = 15,
  maxTemp = 50,
  rows = 4,
  cols = 4,
  showLabels = true,
  showGradients = true,
  onZoneClick,
  className = '',
}) => {
  const cellWidth = 100;
  const cellHeight = 80;
  const padding = 40;
  const width = cols * cellWidth + padding * 2;
  const height = rows * cellHeight + padding * 2 + 60; // Extra for legend

  // Create a map for quick zone lookup by position
  const zoneMap = useMemo(() => {
    const map = new Map<string, ThermalZone>();
    zones.forEach(zone => {
      map.set(`${zone.row}-${zone.col}`, zone);
    });
    return map;
  }, [zones]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (zones.length === 0) return { avg: 0, min: 0, max: 0, spread: 0 };
    const temps = zones.map(z => z.temp);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    return { avg, min, max, spread: max - min };
  }, [zones]);

  return (
    <div className={`thermal-map ${className}`} style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Thermal Map
        </h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <span>
            <strong>Avg:</strong> {stats.avg.toFixed(1)}°C
          </span>
          <span style={{ color: '#3B82F6' }}>
            <strong>Min:</strong> {stats.min.toFixed(1)}°C
          </span>
          <span style={{ color: '#EF4444' }}>
            <strong>Max:</strong> {stats.max.toFixed(1)}°C
          </span>
          <span style={{ color: '#F59E0B' }}>
            <strong>Spread:</strong> {stats.spread.toFixed(1)}°C
          </span>
        </div>
      </div>

      {/* Thermal Map SVG */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '500px',
        }}
      >
        <defs>
          {/* Gradient for color scale legend */}
          <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6"/>
            <stop offset="25%" stopColor="#06B6D4"/>
            <stop offset="50%" stopColor="#10B981"/>
            <stop offset="75%" stopColor="#F59E0B"/>
            <stop offset="100%" stopColor="#EF4444"/>
          </linearGradient>

          {/* Glow filter for hot cells */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect
          x="0" y="0"
          width={width}
          height={height - 60}
          fill="#F9FAFB"
          rx="12"
        />

        {/* Grid cells */}
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const zone = zoneMap.get(`${row}-${col}`);
            const x = padding + col * cellWidth;
            const y = padding + row * cellHeight;

            if (!zone) {
              return (
                <rect
                  key={`empty-${row}-${col}`}
                  x={x + 2}
                  y={y + 2}
                  width={cellWidth - 4}
                  height={cellHeight - 4}
                  fill="#E5E7EB"
                  rx="8"
                />
              );
            }

            const color = interpolateColor(zone.temp, minTemp, maxTemp);
            const isHot = zone.temp > maxTemp * 0.8;

            return (
              <g
                key={zone.id}
                style={{ cursor: onZoneClick ? 'pointer' : 'default' }}
                onClick={() => onZoneClick?.(zone)}
              >
                {/* Cell background */}
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={cellWidth - 4}
                  height={cellHeight - 4}
                  fill={color}
                  rx="8"
                  filter={isHot ? 'url(#glow)' : undefined}
                  style={{ transition: 'fill 0.3s ease' }}
                />

                {/* Health indicator */}
                <circle
                  cx={x + cellWidth - 12}
                  cy={y + 12}
                  r="5"
                  fill={getHealthColor(zone.health)}
                  stroke="white"
                  strokeWidth="1"
                />

                {/* Temperature */}
                <text
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fontWeight="700"
                  fill="white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {zone.temp.toFixed(1)}°
                </text>

                {/* Zone name */}
                {showLabels && (
                  <text
                    x={x + cellWidth / 2}
                    y={y + cellHeight - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgba(255,255,255,0.9)"
                  >
                    {zone.name}
                  </text>
                )}

                {/* Target indicator */}
                <text
                  x={x + 8}
                  y={y + 16}
                  fontSize="9"
                  fill="rgba(255,255,255,0.8)"
                >
                  ⎯ {zone.target}°
                </text>
              </g>
            );
          })
        )}

        {/* Gradient arrows between zones */}
        {showGradients && gradients.map((gradient, index) => {
          const fromZone = zones.find(z => z.id === gradient.from);
          const toZone = zones.find(z => z.id === gradient.to);
          if (!fromZone || !toZone) return null;

          const fromX = padding + fromZone.col * cellWidth + cellWidth / 2;
          const fromY = padding + fromZone.row * cellHeight + cellHeight / 2;
          const toX = padding + toZone.col * cellWidth + cellWidth / 2;
          const toY = padding + toZone.row * cellHeight + cellHeight / 2;

          const gradientColor = gradient.deltaT > 5 ? '#EF4444' :
                               gradient.deltaT > 3 ? '#F59E0B' : '#10B981';

          return (
            <g key={`gradient-${index}`}>
              <line
                x1={fromX} y1={fromY}
                x2={toX} y2={toY}
                stroke={gradientColor}
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.6"
                markerEnd="url(#arrowhead)"
              />
              <text
                x={(fromX + toX) / 2}
                y={(fromY + toY) / 2 - 5}
                textAnchor="middle"
                fontSize="9"
                fill={gradientColor}
                fontWeight="600"
              >
                Δ{gradient.deltaT.toFixed(1)}°
              </text>
            </g>
          );
        })}

        {/* Color Scale Legend */}
        <g transform={`translate(${padding}, ${height - 50})`}>
          <rect
            x="0" y="0"
            width={width - padding * 2}
            height="12"
            fill="url(#tempGradient)"
            rx="6"
          />
          <text x="0" y="28" fontSize="11" fill="#6B7280">
            {minTemp}°C
          </text>
          <text x={(width - padding * 2) / 2} y="28" textAnchor="middle" fontSize="11" fill="#6B7280">
            Temperature Scale
          </text>
          <text x={width - padding * 2} y="28" textAnchor="end" fontSize="11" fill="#6B7280">
            {maxTemp}°C
          </text>
        </g>
      </svg>

      {/* Zone Details (when clicked) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '8px',
        marginTop: '16px',
      }}>
        {zones.map(zone => (
          <div
            key={zone.id}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: `${getHealthColor(zone.health)}10`,
              border: `1px solid ${getHealthColor(zone.health)}30`,
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#1F2937' }}>{zone.name}</div>
            <div style={{ color: '#6B7280' }}>
              {zone.temp.toFixed(1)}° / {zone.target}°
            </div>
            <div style={{
              color: getHealthColor(zone.health),
              textTransform: 'capitalize',
              fontSize: '11px',
            }}>
              {zone.health}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MINI THERMAL MAP
// ============================================

interface MiniThermalMapProps {
  zones: { temp: number; row: number; col: number }[];
  rows?: number;
  cols?: number;
  minTemp?: number;
  maxTemp?: number;
  width?: number;
  height?: number;
  className?: string;
}

export const MiniThermalMap: React.FC<MiniThermalMapProps> = ({
  zones,
  rows = 4,
  cols = 4,
  minTemp = 20,
  maxTemp = 45,
  width = 120,
  height = 80,
  className = '',
}) => {
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const zoneMap = new Map<string, { temp: number }>();
  zones.forEach(zone => {
    zoneMap.set(`${zone.row}-${zone.col}`, zone);
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      style={{ borderRadius: '4px', overflow: 'hidden' }}
    >
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const zone = zoneMap.get(`${row}-${col}`);
          const color = zone
            ? interpolateColor(zone.temp, minTemp, maxTemp)
            : '#E5E7EB';

          return (
            <rect
              key={`${row}-${col}`}
              x={col * cellWidth}
              y={row * cellHeight}
              width={cellWidth - 1}
              height={cellHeight - 1}
              fill={color}
            />
          );
        })
      )}
    </svg>
  );
};

export default ThermalMap;
