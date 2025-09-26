import * as React from "react";
import { motion, Variants } from "framer-motion";
import { TextShimmer } from "./TextShimmer";

interface AnimatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  gradientColors?: string;
  gradientAnimationDuration?: number;
  hoverEffect?: boolean;
  className?: string;
  textClassName?: string;
  useShimmer?: boolean;
  baseColor?: string;
  shimmerColor?: string;
}

const AnimatedShinyText = React.forwardRef<HTMLDivElement, AnimatedTextProps>(
  (
    {
      text,
      gradientColors = "linear-gradient(90deg, #8b00ff, #a855f7, #9333ea, #8b00ff)",
      gradientAnimationDuration = 6,
      hoverEffect = false,
      className,
      textClassName,
      useShimmer = false,
      baseColor = "#a855f7",
      shimmerColor = "#ffffff",
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);
    
    if (useShimmer) {
      return (
        <div
          ref={ref}
          className={`flex justify-center items-center ${className || ''}`}
          {...props}
        >
          <TextShimmer
            className={`font-medium ${textClassName || ''}`}
            style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' }}
            duration={gradientAnimationDuration / 3}
            baseColor={baseColor}
            shimmerColor={shimmerColor}
          >
            {text}
          </TextShimmer>
        </div>
      );
    }
    
    const textVariants: Variants = {
      initial: {
        backgroundPosition: "200% 50%",
      },
      animate: {
        backgroundPosition: "-200% 50%",
        transition: {
          duration: gradientAnimationDuration,
          repeat: Infinity,
          ease: "linear",
        },
      },
    };

    return (
      <div
        ref={ref}
        className={`flex justify-center items-center ${className || ''}`}
        {...props}
      >
        <motion.div
          className={`font-medium ${textClassName || ''}`}
          style={{
            background: gradientColors,
            backgroundSize: "300% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: isHovered ? "drop-shadow(0 0 12px rgba(139, 0, 255, 0.4))" : "none",
            transition: "filter 0.3s ease",
            fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
          variants={textVariants}
          initial="initial"
          animate="animate"
          onHoverStart={() => hoverEffect && setIsHovered(true)}
          onHoverEnd={() => hoverEffect && setIsHovered(false)}
        >
          {text}
        </motion.div>
      </div>
    );
  }
);

AnimatedShinyText.displayName = "AnimatedShinyText";

export { AnimatedShinyText };