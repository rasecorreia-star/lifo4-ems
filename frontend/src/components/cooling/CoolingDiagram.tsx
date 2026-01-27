/**
 * Cooling Diagram Component
 * Visual representation of the liquid cooling system
 */

import React from 'react';

// ============================================
// TYPES
// ============================================

interface CoolantData {
  inletTemp: number;
  outletTemp: number;
  deltaT: number;
  flowRate: number;
  pressure: number;
  level: number;
}

interface PumpData {
  id: string;
  name: string;
  state: 'off' | 'starting' | 'running' | 'stopping' | 'fault' | 'maintenance';
  speed: number;
  power: number;
}

interface CoolingDiagramProps {
  coolant: CoolantData;
  pumps: PumpData[];
  coolingPower: number;
  efficiency: number;
  status: 'optimal' | 'normal' | 'warning' | 'critical';
  onPumpClick?: (pumpId: string) => void;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'optimal':
      return '#10B981';
    case 'normal':
      return '#3B82F6';
    case 'warning':
      return '#F59E0B';
    case 'critical':
      return '#EF4444';
    default:
      return '#6B7280';
  }
};

const getPumpStateColor = (state: string): string => {
  switch (state) {
    case 'running':
      return '#10B981';
    case 'starting':
    case 'stopping':
      return '#F59E0B';
    case 'fault':
      return '#EF4444';
    case 'maintenance':
      return '#8B5CF6';
    default:
      return '#6B7280';
  }
};

const getTemperatureColor = (temp: number): string => {
  if (temp < 25) return '#3B82F6';  // Blue - cool
  if (temp < 30) return '#10B981';  // Green - normal
  if (temp < 35) return '#F59E0B';  // Amber - warm
  return '#EF4444';                  // Red - hot
};

// ============================================
// COMPONENT
// ============================================

export const CoolingDiagram: React.FC<CoolingDiagramProps> = ({
  coolant,
  pumps,
  coolingPower,
  efficiency,
  status,
  onPumpClick,
  className = '',
}) => {
  const statusColor = getStatusColor(status);
  const inletColor = getTemperatureColor(coolant.inletTemp);
  const outletColor = getTemperatureColor(coolant.outletTemp);

  return (
    <div className={`cooling-diagram ${className}`} style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Liquid Cooling System
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: '9999px',
          backgroundColor: `${statusColor}20`,
          color: statusColor,
          fontSize: '14px',
          fontWeight: 500,
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            animation: status === 'critical' ? 'pulse 1s infinite' : 'none',
          }} />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>

      {/* Main Diagram SVG */}
      <svg
        viewBox="0 0 800 400"
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '400px',
          backgroundColor: '#F9FAFB',
          borderRadius: '12px',
        }}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
          </pattern>

          {/* Flow animation */}
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={inletColor} stopOpacity="0.5">
              <animate attributeName="offset" values="0;1" dur="2s" repeatCount="indefinite"/>
            </stop>
            <stop offset="50%" stopColor={inletColor} stopOpacity="1">
              <animate attributeName="offset" values="0.5;1.5" dur="2s" repeatCount="indefinite"/>
            </stop>
            <stop offset="100%" stopColor={inletColor} stopOpacity="0.5">
              <animate attributeName="offset" values="1;2" dur="2s" repeatCount="indefinite"/>
            </stop>
          </linearGradient>

          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={inletColor}/>
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)"/>

        {/* Reservoir Tank */}
        <g transform="translate(50, 150)">
          <rect
            x="0" y="0" width="80" height="100"
            fill={`${inletColor}30`}
            stroke={inletColor}
            strokeWidth="2"
            rx="4"
          />
          {/* Liquid level */}
          <rect
            x="2" y={100 - coolant.level}
            width="76"
            height={coolant.level}
            fill={inletColor}
            opacity="0.5"
          />
          <text x="40" y="-10" textAnchor="middle" fontSize="12" fill="#374151">
            Reservoir
          </text>
          <text x="40" y="60" textAnchor="middle" fontSize="14" fontWeight="600" fill="#1F2937">
            {coolant.level}%
          </text>
        </g>

        {/* Inlet Pipe */}
        <path
          d="M 130 200 L 200 200"
          fill="none"
          stroke={inletColor}
          strokeWidth="12"
          strokeLinecap="round"
          markerEnd="url(#arrowhead)"
        />

        {/* Pumps */}
        {pumps.map((pump, index) => {
          const x = 200 + index * 120;
          const pumpColor = getPumpStateColor(pump.state);

          return (
            <g
              key={pump.id}
              transform={`translate(${x}, 160)`}
              style={{ cursor: onPumpClick ? 'pointer' : 'default' }}
              onClick={() => onPumpClick?.(pump.id)}
            >
              {/* Pump body */}
              <circle
                cx="40" cy="40" r="35"
                fill={`${pumpColor}20`}
                stroke={pumpColor}
                strokeWidth="3"
              />

              {/* Pump impeller animation */}
              {pump.state === 'running' && (
                <g transform="translate(40, 40)">
                  <g style={{ transformOrigin: 'center' }}>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0"
                      to="360"
                      dur={`${3 - pump.speed / 50}s`}
                      repeatCount="indefinite"
                    />
                    <path d="M 0 -20 L 5 0 L 0 20 L -5 0 Z" fill={pumpColor}/>
                    <path d="M -20 0 L 0 5 L 20 0 L 0 -5 Z" fill={pumpColor}/>
                  </g>
                </g>
              )}

              {/* Pump label */}
              <text x="40" y="95" textAnchor="middle" fontSize="11" fill="#374151">
                {pump.name}
              </text>
              <text x="40" y="110" textAnchor="middle" fontSize="10" fill="#6B7280">
                {pump.speed}% • {pump.power}W
              </text>

              {/* Status indicator */}
              <circle cx="65" cy="15" r="6" fill={pumpColor}/>
            </g>
          );
        })}

        {/* Battery Pack (Cooling Target) */}
        <g transform="translate(550, 120)">
          <rect
            x="0" y="0" width="160" height="160"
            fill="#374151"
            stroke="#1F2937"
            strokeWidth="2"
            rx="8"
          />
          <text x="80" y="30" textAnchor="middle" fontSize="14" fontWeight="600" fill="white">
            Battery Pack
          </text>

          {/* Battery cells */}
          {[0, 1, 2, 3].map((row) => (
            <g key={row}>
              {[0, 1, 2, 3].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={15 + col * 35}
                  y={50 + row * 25}
                  width="30"
                  height="20"
                  fill={getTemperatureColor(coolant.outletTemp - (4 - row) * 2)}
                  rx="2"
                />
              ))}
            </g>
          ))}
        </g>

        {/* Outlet pipe */}
        <path
          d="M 550 250 L 400 250 L 400 320 L 130 320 L 130 250"
          fill="none"
          stroke={outletColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Temperature indicators */}
        <g transform="translate(160, 180)">
          <rect x="0" y="0" width="60" height="40" fill="white" stroke="#E5E7EB" rx="4"/>
          <text x="30" y="16" textAnchor="middle" fontSize="10" fill="#6B7280">Inlet</text>
          <text x="30" y="32" textAnchor="middle" fontSize="14" fontWeight="600" fill={inletColor}>
            {coolant.inletTemp.toFixed(1)}°C
          </text>
        </g>

        <g transform="translate(460, 230)">
          <rect x="0" y="0" width="60" height="40" fill="white" stroke="#E5E7EB" rx="4"/>
          <text x="30" y="16" textAnchor="middle" fontSize="10" fill="#6B7280">Outlet</text>
          <text x="30" y="32" textAnchor="middle" fontSize="14" fontWeight="600" fill={outletColor}>
            {coolant.outletTemp.toFixed(1)}°C
          </text>
        </g>

        {/* Flow rate indicator */}
        <g transform="translate(250, 280)">
          <rect x="0" y="0" width="100" height="40" fill="white" stroke="#E5E7EB" rx="4"/>
          <text x="50" y="16" textAnchor="middle" fontSize="10" fill="#6B7280">Flow Rate</text>
          <text x="50" y="32" textAnchor="middle" fontSize="14" fontWeight="600" fill="#3B82F6">
            {coolant.flowRate.toFixed(1)} L/min
          </text>
        </g>

        {/* Delta T indicator */}
        <g transform="translate(360, 280)">
          <rect x="0" y="0" width="80" height="40" fill="white" stroke="#E5E7EB" rx="4"/>
          <text x="40" y="16" textAnchor="middle" fontSize="10" fill="#6B7280">ΔT</text>
          <text x="40" y="32" textAnchor="middle" fontSize="14" fontWeight="600" fill="#F59E0B">
            {coolant.deltaT.toFixed(1)}°C
          </text>
        </g>
      </svg>

      {/* Stats Footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginTop: '24px',
      }}>
        <StatCard
          label="Cooling Power"
          value={`${coolingPower.toFixed(1)} kW`}
          color="#3B82F6"
        />
        <StatCard
          label="Efficiency"
          value={`${efficiency.toFixed(0)}%`}
          color="#10B981"
        />
        <StatCard
          label="Pressure"
          value={`${coolant.pressure.toFixed(2)} bar`}
          color="#8B5CF6"
        />
        <StatCard
          label="Level"
          value={`${coolant.level.toFixed(0)}%`}
          color={coolant.level < 30 ? '#EF4444' : '#6B7280'}
        />
      </div>
    </div>
  );
};

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
  <div style={{
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: `${color}10`,
    border: `1px solid ${color}30`,
  }}>
    <div style={{ fontSize: '12px', color: '#6B7280' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
  </div>
);

export default CoolingDiagram;
