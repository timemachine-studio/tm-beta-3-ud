import React from 'react';
    import { motion } from 'framer-motion';
    import { wordAnimationVariants, textGlowStyle } from '../../utils/animations';
    import { ANIMATION_CONFIG } from '../../utils/constants';

    interface AnimatedWordsProps {
      text: string;
      className?: string;
      style?: React.CSSProperties;
    }

    export function AnimatedWords({ text, className, style }: AnimatedWordsProps) {
      const words = text.split(' ');

      const getHolographicGlowStyle = (index: number) => ({
        ...textGlowStyle,
        background: 'linear-gradient(45deg, #00ffff, #ff00ff, #00ffff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundSize: '300% 300%',
        animation: `holographicAnimation 7s linear infinite`,
        animationDelay: `${index * 0.1}s`, // Stagger the animation
      });

      return (
        <motion.div
          variants={wordAnimationVariants.container}
          initial="hidden"
          animate="visible"
          className={className}
          style={style}
        >
          {words.map((word, idx) => (
            <motion.span
              key={idx}
              variants={wordAnimationVariants.word}
              style={{ 
                display: 'inline-block', 
                marginRight: '0.25em',
                whiteSpace: 'pre-wrap',
                ...getHolographicGlowStyle(idx)
              }}
            >
              {word}
            </motion.span>
          ))}
        </motion.div>
      );
    }
