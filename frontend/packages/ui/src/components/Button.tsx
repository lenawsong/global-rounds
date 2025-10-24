import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base = 'inline-flex items-center justify-center rounded-md text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 focus-visible:ring-blue-500',
  secondary: 'bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 focus-visible:ring-blue-400',
  ghost: 'bg-transparent text-blue-700 hover:bg-blue-50 px-3 py-2 focus-visible:ring-blue-400'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', ...props },
  ref
) {
  return <button ref={ref} className={[base, variants[variant], className].join(' ')} {...props} />;
});

