import { useMemo } from 'react';

export function useGlowAnimation() {
  const glowStyle = useMemo(() => ({
    textShadow: `
      0 0 20px rgba(192, 132, 252, 0.7),
      0 0 40px rgba(192, 132, 252, 0.5),
      0 0 60px rgba(192, 132, 252, 0.3),
      0 0 80px rgba(192, 132, 252, 0.2)
    `,
    fontFamily: 'Montserrat, sans-serif',
  }), []);

  const pulseVariants = {
    initial: {
      opacity: 0,
      scale: 0.9,
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
      }
    }
  };

  return { glowStyle, pulseVariants };
}
