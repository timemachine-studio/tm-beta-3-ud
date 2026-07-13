import React from 'react';

interface SesameMarkProps {
  className?: string;
}

export function SesameMark({ className = '' }: SesameMarkProps) {
  return (
    <img
      src="https://app.sesame.com/favicon.svg"
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}
