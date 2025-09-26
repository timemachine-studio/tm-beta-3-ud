import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ANIMATION_CONFIG } from '../utils/constants';

export function useTypewriter(text: string, speed: number = ANIMATION_CONFIG.TYPING_SPEED, startTyping: boolean = false) {
  const [displayedText, setDisplayedText] = useState('');
  const containerRef = useRef<HTMLParagraphElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!startTyping) return;

    let currentIndex = 0;
    setDisplayedText('');

    const typeNextCharacter = () => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex]);
        currentIndex++;
        timeoutRef.current = setTimeout(typeNextCharacter, speed);

        // Animate the last character with GSAP
        if (containerRef.current) {
          const chars = containerRef.current.children;
          if (chars.length > 0) {
            const lastChar = chars[chars.length - 1];
            gsap.fromTo(lastChar,
              { 
                opacity: 0, 
                scale: 0.5,
                filter: 'blur(4px)'
              },
              { 
                opacity: 1, 
                scale: 1,
                filter: 'blur(0px)',
                duration: ANIMATION_CONFIG.CHAR_ANIMATION_DURATION,
                ease: "power3.out"
              }
            );
          }
        }
      }
    };

    typeNextCharacter();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, startTyping]);

  return { displayedText, containerRef };
}
