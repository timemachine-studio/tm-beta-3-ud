import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface TextShimmerProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
  baseColor?: string;
  shimmerColor?: string;
}

export function TextShimmer({
  children,
  as: Component = 'div',
  className,
  duration = 2,
  spread = 2,
  baseColor = '#a855f7', // Default purple
  shimmerColor = '#ffffff', // Default white
}: TextShimmerProps) {
  const MotionComponent = motion(Component as any);

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  return (
    <MotionComponent
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent',
        className
      )}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
      style={{
        '--spread': `${dynamicSpread}px`,
        '--base-color': baseColor,
        '--shimmer-color': shimmerColor,
        backgroundImage: `linear-gradient(90deg, transparent calc(50% - var(--spread)), var(--shimmer-color), transparent calc(50% + var(--spread))), linear-gradient(var(--base-color), var(--base-color))`,
        backgroundRepeat: 'no-repeat, padding-box',
      } as React.CSSProperties}
    >
      {children}
    </MotionComponent>
  );
}