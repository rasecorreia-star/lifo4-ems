/**
 * SLA Compliance Chart Component
 * Displays compliance trends and violation history
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface ComplianceTrendData {
  timestamp: Date | string;
  compliance: number;
}

interface ViolationSummary {
  total: number;
  bySeverity: Record<string, number>;
  byMetric: Record<string, number>;
  avgResolutionTime: number;
  unacknowledged: number;
  active: number;
}

interface MetricCompliance {
  metric: string;
  target: number;
  actual: number;
  compliance: number;
  status: 'compliant' | 'at_risk' | 'violated';
}

// ============================================
// COMPLIANCE TREND CHART
// ============================================

interface ComplianceTrendChartProps {
  data: ComplianceTrendData[];
  height?: number;
  showTarget?: boolean;
  targetValue?: number;
  className?: string;
}

export const ComplianceTrendChart: React.FC<ComplianceTrendChartProps> = ({
  data,
  height = 300,
  showTarget = true,
  targetValue = 100,
  className = '',
}) => {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      timestamp: new Date(d.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      compliance: Number(d.compliance.toFixed(1)),
    }));
  }, [data]);

  const getComplianceColor = (value: number) => {
    if (value >= 99) return '#10B981';
    if (value >= 95) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className={className}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
        Compliance Trend
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis
            domain={[80, 100]}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [`${value}%`, 'Compliance']}
          />
          {showTarget && (
            <ReferenceLine
              y={targetValue}
              stroke="#10B981"
              strokeDasharray="5 5"
              label={{ value: 'Target', position: 'right', fontSize: 12 }}
            />
          )}
          <ReferenceLine
            y={95}
            stroke="#F59E0B"
            strokeDasharray="3 3"
            label={{ value: 'Warning', position: 'right', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="compliance"
            stroke="#10B981"
            fill="url(#complianceGradient)"
            strokeWidth={2}
            dot={{ fill: '#10B981', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================
// VIOLATION SUMMARY CHART
// ============================================

interface ViolationSummaryChartProps {
  summary: ViolationSummary;
  height?: number;
  className?: string;
}

export const ViolationSummaryChart: React.FC<ViolationSummaryChartProps> = ({
  summary,
  height = 200,
  className = '',
}) => {
  const severityData = useMemo(() => {
    return Object.entries(summary.bySeverity).map(([severity, count]) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: count,
      color: severity === 'critical' ? '#EF4444' : severity === 'major' ? '#F59E0B' : '#6B7280',
    }));
  }, [summary.bySeverity]);

  const metricData = useMemo(() => {
    return Object.entries(summary.byMetric).map(([metric, count]) => ({
      name: metric.replace(/([A-Z])/g, ' $1').trim(),
      count,
    }));
  }, [summary.byMetric]);

  return (
    <div className={className}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
        Violation Summary
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Severity Distribution */}
        <div>
          <h4 style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
            By Severity
          </h4>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {severityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By Metric */}
        <div>
          <h4 style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
            By Metric
          </h4>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={metricData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={100}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginTop: '24px',
        }}
      >
        <StatCard
          label="Total Violations"
          value={summary.total}
          color="#6366F1"
        />
        <StatCard
          label="Active"
          value={summary.active}
          color="#EF4444"
        />
        <StatCard
          label="Unacknowledged"
          value={summary.unacknowledged}
          color="#F59E0B"
        />
        <StatCard
          label="Avg Resolution"
          value={`${(summary.avgResolutionTime / 60000).toFixed(1)}m`}
          color="#10B981"
        />
      </div>
    </div>
  );
};

// ============================================
// METRIC COMPLIANCE CHART
// ============================================

interface MetricComplianceChartProps {
  metrics: MetricCompliance[];
  height?: number;
  className?: string;
}

export const MetricComplianceChart: React.FC<MetricComplianceChartProps> = ({
  metrics,
  height = 250,
  className = '',
}) => {
  const chartData = useMemo(() => {
    return metrics.map((m) => ({
      ...m,
      displayName: m.metric.replace(/([A-Z])/g, ' $1').replace('Latency', '').trim(),
    }));
  }, [metrics]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return '#10B981';
      case 'at_risk':
        return '#F59E0B';
      case 'violated':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <div className={className}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
        Metric Compliance
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="displayName"
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'compliance') return [`${value.toFixed(1)}%`, 'Compliance'];
              return [value, name];
            }}
          />
          <ReferenceLine y={100} stroke="#10B981" strokeDasharray="5 5" />
          <ReferenceLine y={95} stroke="#F59E0B" strokeDasharray="3 3" />
          <Bar dataKey="compliance" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Metric details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginTop: '16px',
        }}
      >
        {chartData.map((metric, index) => (
          <div
            key={index}
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: `${getStatusColor(metric.status)}10`,
              border: `1px solid ${getStatusColor(metric.status)}30`,
            }}
          >
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {metric.displayName}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: getStatusColor(metric.status) }}>
              {metric.actual.toFixed(0)}ms
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
              Target: {metric.target}ms
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
  <div
    style={{
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: `${color}10`,
      border: `1px solid ${color}30`,
    }}
  >
    <div style={{ fontSize: '12px', color: '#6B7280' }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
  </div>
);

// ============================================
// COMBINED SLA DASHBOARD
// ============================================

interface SLADashboardProps {
  systemId: string;
  complianceTrend: ComplianceTrendData[];
  violationSummary: ViolationSummary;
  metricCompliance: MetricCompliance[];
  currentStatus: 'compliant' | 'at_risk' | 'violated';
  overallCompliance: number;
  tier: string;
  className?: string;
}

export const SLADashboard: React.FC<SLADashboardProps> = ({
  systemId,
  complianceTrend,
  violationSummary,
  metricCompliance,
  currentStatus,
  overallCompliance,
  tier,
  className = '',
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return '#10B981';
      case 'at_risk':
        return '#F59E0B';
      case 'violated':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <div className={className} style={{ padding: '24px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
            SLA Dashboard
          </h2>
          <p style={{ color: '#6B7280', margin: '4px 0 0' }}>System: {systemId}</p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: `${getStatusColor(currentStatus)}10`,
              border: `1px solid ${getStatusColor(currentStatus)}30`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Status</div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: getStatusColor(currentStatus),
                textTransform: 'uppercase',
              }}
            >
              {currentStatus.replace('_', ' ')}
            </div>
          </div>

          <div
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: '#6366F110',
              border: '1px solid #6366F130',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Compliance</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#6366F1' }}>
              {overallCompliance.toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: '#8B5CF610',
              border: '1px solid #8B5CF630',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Tier</div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#8B5CF6',
                textTransform: 'uppercase',
              }}
            >
              {tier}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <ComplianceTrendChart data={complianceTrend} />
        </div>

        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <MetricComplianceChart metrics={metricCompliance} />
        </div>
      </div>

      <div
        style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: '12px',
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <ViolationSummaryChart summary={violationSummary} />
      </div>
    </div>
  );
};

export default SLADashboard;
