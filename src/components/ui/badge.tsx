import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Notion-style tags: soft pastel fill, readable ink, no border, sentence case.
const badgeVariants = cva('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-4', {
  variants: {
    variant: {
      default: 'bg-foreground text-background',
      secondary: 'bg-tag-gray text-tag-gray-fg',
      destructive: 'bg-tag-red text-tag-red-fg',
      success: 'bg-tag-green text-tag-green-fg',
      warning: 'bg-tag-yellow text-tag-yellow-fg',
      info: 'bg-tag-blue text-tag-blue-fg',
      purple: 'bg-tag-purple text-tag-purple-fg',
      orange: 'bg-tag-orange text-tag-orange-fg',
      pink: 'bg-tag-pink text-tag-pink-fg',
      outline: 'border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'secondary' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
