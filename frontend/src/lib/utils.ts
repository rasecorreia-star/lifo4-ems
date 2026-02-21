import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to locale string
 */
export function formatDate(date: Date | string, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: ptBR });
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

/**
 * Format number with locale
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format voltage value
 */
export function formatVoltage(voltage: number): string {
  return `${formatNumber(voltage, 2)}V`;
}

/**
 * Format current value
 */
export function formatCurrent(current: number): string {
  return `${formatNumber(Math.abs(current), 1)}A`;
}

/**
 * Format power value
 */
export function formatPower(power: number): string {
  const absPower = Math.abs(power);
  if (absPower >= 1000) {
    return `${formatNumber(absPower / 1000, 2)}kW`;
  }
  return `${formatNumber(absPower, 0)}W`;
}

/**
 * Format energy value
 */
export function formatEnergy(energy: number): string {
  if (energy >= 1000) {
    return `${formatNumber(energy / 1000, 2)}MWh`;
  }
  return `${formatNumber(energy, 2)}kWh`;
}

/**
 * Format temperature value
 */
export function formatTemperature(temp: number): string {
  return `${formatNumber(temp, 1)}°C`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Format currency (BRL)
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Get cell status color class
 */
export function getCellStatusColor(status: string): string {
  switch (status) {
    case 'normal':
      return 'cell-normal';
    case 'attention':
      return 'cell-attention';
    case 'critical':
      return 'cell-critical';
    default:
      return 'bg-surface border border-border';
  }
}

/**
 * Get alert severity color
 */
export function getAlertSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-danger-500 bg-danger-500/10';
    case 'high':
      return 'text-warning-500 bg-warning-500/10';
    case 'medium':
      return 'text-secondary bg-secondary/10';
    case 'low':
      return 'text-success-500 bg-success-500/10';
    default:
      return 'text-foreground-muted bg-surface';
  }
}

/**
 * Get system status color
 */
export function getSystemStatusColor(status: string): string {
  switch (status) {
    case 'online':
      return 'text-success-500';
    case 'offline':
      return 'text-foreground-subtle';
    case 'error':
      return 'text-danger-500';
    case 'charging':
      return 'text-secondary';
    case 'discharging':
      return 'text-warning-500';
    case 'balancing':
      return 'text-primary';
    default:
      return 'text-foreground-muted';
  }
}

/**
 * Get operation mode label
 */
export function getOperationModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    auto: 'Automático',
    manual: 'Manual',
    economic: 'Econômico',
    grid_support: 'Suporte à Rede',
    maintenance: 'Manutenção',
    emergency: 'Emergência',
  };
  return labels[mode] || mode;
}

/**
 * Get system status label
 */
export function getSystemStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: 'Ocioso',
    charging: 'Carregando',
    discharging: 'Descarregando',
    balancing: 'Balanceando',
    error: 'Erro',
    maintenance: 'Manutenção',
    offline: 'Offline',
  };
  return labels[status] || status;
}

/**
 * Calculate cell voltage delta
 */
export function calculateCellDelta(cells: { voltage: number }[]): number {
  if (cells.length === 0) return 0;
  const voltages = cells.map((c) => c.voltage);
  return Math.max(...voltages) - Math.min(...voltages);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userPermissions: Array<{ resource: string; actions: string[] }>,
  resource: string,
  action: string
): boolean {
  const permission = userPermissions.find((p) => p.resource === resource);
  return permission?.actions.includes(action) || false;
}
