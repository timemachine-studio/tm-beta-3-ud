import React from 'react';

// The TimeMachine logo: the clock face from the favicon, as a raster with
// alpha (public/tm-logo.webp) so it reads the same on glass, on paper and next
// to text. Decorative wherever it appears: the control it sits in carries
// the name.
const TimeMachineMark = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <img src="/tm-logo.webp" alt="" aria-hidden="true" draggable={false} width={256} height={256} className={`${className} select-none rounded-full object-contain`} />
);

export default TimeMachineMark;
