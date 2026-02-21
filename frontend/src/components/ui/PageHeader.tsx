import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, icon, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between mb-6', className)}
        {...props}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-foreground-muted">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  }
);
PageHeader.displayName = 'PageHeader';

export { PageHeader };
