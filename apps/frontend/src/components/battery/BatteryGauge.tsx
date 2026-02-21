import { cn, formatPercent } from '@/lib/utils';
import { Battery, BatteryCharging, BatteryWarning, Zap, TrendingDown } from 'lucide-react';

interface BatteryGaugeProps {
  soc: number;
  soh?: number;
  isCharging?: boolean;
  isDischarging?: boolean;
  power?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function BatteryGauge({
  soc,
  soh = 100,
  isCharging = false,
  isDischarging = false,
  power = 0,
  size = 'md',
  showDetails = true,
}: BatteryGaugeProps) {
  const sizeClasses = {
    sm: 'w-20 h-10',
    md: 'w-32 h-16',
    lg: 'w-48 h-24',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  const getSOCColor = (value: number) => {
    if (value <= 10) return 'bg-danger-500';
    if (value <= 20) return 'bg-warning-500';
    if (value <= 50) return 'bg-warning-400';
    return 'bg-success-500';
  };

  const getSOCTextColor = (value: number) => {
    if (value <= 10) return 'text-danger-500';
    if (value <= 20) return 'text-warning-500';
    return 'text-success-500';
  };

  const getStatusIcon = () => {
    if (isCharging) return <BatteryCharging className="w-5 h-5 text-success-500" />;
    if (isDischarging) return <TrendingDown className="w-5 h-5 text-warning-500" />;
    if (soc <= 10) return <BatteryWarning className="w-5 h-5 text-danger-500" />;
    return <Battery className="w-5 h-5 text-foreground-muted" />;
  };

  const getStatusText = () => {
    if (isCharging) return 'Carregando';
    if (isDischarging) return 'Descarregando';
    return 'Ocioso';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Battery Visual */}
      <div className="relative">
        {/* Battery Body */}
        <div className={cn(
          'relative rounded-lg border-4 border-foreground-muted overflow-hidden',
          sizeClasses[size]
        )}>
          {/* SOC Fill */}
          <div
            className={cn(
              'absolute inset-0 transition-all duration-500 ease-out',
              getSOCColor(soc),
              isCharging && 'animate-pulse'
            )}
            style={{ width: `${soc}%` }}
          />

          {/* Grid Pattern Overlay */}
          <div className="absolute inset-0 flex">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex-1 border-r border-foreground-muted/30 last:border-r-0"
              />
            ))}
          </div>

          {/* SOC Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              'font-bold text-white drop-shadow-lg',
              textSizes[size]
            )}>
              {Math.round(soc)}%
            </span>
          </div>

          {/* Charging Animation */}
          {isCharging && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white animate-bounce drop-shadow-lg" />
            </div>
          )}
        </div>

        {/* Battery Tip */}
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-1/3 bg-foreground-muted rounded-r" />
      </div>

      {/* Status */}
      {showDetails && (
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={cn(
            'text-sm font-medium',
            isCharging && 'text-success-500',
            isDischarging && 'text-warning-500',
            !isCharging && !isDischarging && 'text-foreground-muted'
          )}>
            {getStatusText()}
          </span>
          {power !== 0 && (
            <span className="text-sm text-foreground-muted">
              ({Math.abs(power).toFixed(0)}W)
            </span>
          )}
        </div>
      )}

      {/* SOC and SOH Bars */}
      {showDetails && (
        <div className="w-full max-w-xs space-y-2">
          {/* SOC Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground-muted">SOC</span>
              <span className={cn('font-medium', getSOCTextColor(soc))}>
                {formatPercent(soc, 1)}
              </span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  getSOCColor(soc)
                )}
                style={{ width: `${soc}%` }}
              />
            </div>
          </div>

          {/* SOH Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground-muted">SOH</span>
              <span className={cn(
                'font-medium',
                soh >= 80 ? 'text-success-500' : soh >= 60 ? 'text-warning-500' : 'text-danger-500'
              )}>
                {formatPercent(soh, 1)}
              </span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  soh >= 80 ? 'bg-success-500' : soh >= 60 ? 'bg-warning-500' : 'bg-danger-500'
                )}
                style={{ width: `${soh}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for lists/cards
export function BatteryGaugeCompact({ soc, isCharging }: { soc: number; isCharging?: boolean }) {
  const getColor = (value: number) => {
    if (value <= 10) return 'text-danger-500';
    if (value <= 20) return 'text-warning-500';
    return 'text-primary';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-4 rounded border-2 border-current">
        <div
          className={cn(
            'absolute inset-0.5 rounded-sm transition-all',
            soc <= 10 ? 'bg-danger-500' : soc <= 20 ? 'bg-warning-500' : 'bg-primary'
          )}
          style={{ width: `${(soc / 100) * 100}%` }}
        />
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0.5 h-2 bg-current rounded-r" />
      </div>
      <span className={cn('text-sm font-bold', getColor(soc))}>
        {Math.round(soc)}%
      </span>
      {isCharging && <Zap className="w-3 h-3 text-success-500 animate-pulse" />}
    </div>
  );
}
