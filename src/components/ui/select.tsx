import * as React from 'react';
import { cn } from '@/lib/utils';

// Native select styled like the inputs — best UX on Android (system picker).
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50 md:text-sm',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';
