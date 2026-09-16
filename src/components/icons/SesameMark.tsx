import React from 'react';

interface SesameMarkProps {
  className?: string;
}

/**
 * Sesame's favicon, drawn in the current text colour so it sits with the
 * lucide glyphs beside it instead of reading as the one coloured sticker in
 * the row. The SVG is used as a mask, so the brand's own colours never show.
 */
export function SesameMark({ className = '' }: SesameMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-current ${className}`}
      style={{
        WebkitMaskImage: 'url(https://app.sesame.com/favicon.svg)',
        maskImage: 'url(https://app.sesame.com/favicon.svg)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
