import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red' | 'outline';
}

export function Badge({
  className,
  variant = 'slate',
  ...props
}: BadgeProps) {
  const variants = {
    slate: 'bg-slate-100 text-slate-800 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    outline: 'border border-slate-200 text-slate-700 bg-white',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
