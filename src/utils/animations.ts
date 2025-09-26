export const fadeInScale = {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      transition: { 
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1]
      }
    };

    export const slideInFromLeft = {
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.3 }
    };

    export const slideInFromRight = {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.3 }
    };

    export const textGlowStyle = {
      textShadow: `
        0 0 20px rgba(255,255,255,0.4),
        0 0 40px rgba(255,255,255,0.2),
        0 0 60px rgba(255,255,255,0.1)
      `,
      WebkitTextStroke: '1px rgba(255,255,255,0.1)'
    };

    export const holographicTextStyle = {
      ...textGlowStyle,
      background: 'linear-gradient(45deg, #00ffff, #ff00ff, #00ffff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundSize: '300% 300%',
      animation: 'holographicAnimation 7s linear infinite',
    };

    export const wordAnimationVariants = {
      container: {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
          opacity: 1,
          transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
          },
        }),
      },
      word: {
        hidden: {
          opacity: 0,
          y: 30,
        },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring",
            damping: 12,
            stiffness: 100,
          },
        },
      },
    };
