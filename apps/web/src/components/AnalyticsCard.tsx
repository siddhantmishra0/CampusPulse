import React from 'react';
import { cn } from '../lib/utils';

interface AnalyticsCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  title,
  subtitle,
  icon,
  children,
  className,
  gradient = false,
}) => {
  return (
    <div
      className={cn(
        // Light-theme card: an explicit border is required because the page
        // background and the card surface are within ~2% of each other, so a
        // shadow alone leaves the box visually undefined.
        'group relative overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-space-lg shadow-sm',
        'transition-all duration-200 hover:border-outline-variant hover:shadow-md',
        gradient &&
          'bg-gradient-to-br from-primary-fixed/60 to-surface-container-lowest',
        className,
      )}
    >
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-outline">{title}</h3>
            {subtitle && <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              {icon}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};