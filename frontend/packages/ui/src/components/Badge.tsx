import * as React from 'react';

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const map: Record<Variant, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-100 text-amber-700 ring-amber-200',
  danger: 'bg-rose-100 text-rose-700 ring-rose-200',
  brand: 'bg-blue-100 text-blue-700 ring-blue-200'
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'neutral', className = '', ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
        map[variant],
        className
      ].join(' ')}
      {...props}
    />
  );
});

