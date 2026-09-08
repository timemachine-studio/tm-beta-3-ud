import React from "react";

// Hugeicons "send" (stroke-rounded). Replaces lucide's Send in the composers.
// No width/height attributes: every call site sizes it with Tailwind classes,
// and a CSS class does not override a presentational attribute on all engines.
//
// The viewBox is tightened from 24 to 21 (a 14% zoom) rather than growing the
// w-5 h-5 boxes at the call sites: this arrow is a diagonal glyph, so it leaves
// two empty corners and reads smaller than the upright mic beside it at the
// same box size. Zooming here keeps every button 44px and every sibling
// spinner aligned. strokeWidth drops to 1.31 (1.5 x 21/24) so the zoom does
// not also thicken the line -- it renders at 1.25px, exactly like AiMicIcon.
const SendIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="1.5 1.5 21 21"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.31}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8.87038 6.13264L14.7327 4.19538C18.033 3.10476 19.6831 2.55945 20.5579 3.43426C21.4327 4.30907 20.8874 5.95922 19.7968 9.25953L17.8595 15.1218C16.6236 18.8619 16.0056 20.7319 14.8796 20.9603C14.6411 21.0087 14.3955 21.0129 14.1549 20.9727C13.019 20.7832 12.3132 18.9359 10.9016 15.2413C10.6328 14.5376 10.4983 14.1858 10.2574 13.9127C10.2018 13.8497 10.1424 13.7903 10.0795 13.7348C9.80638 13.4938 9.45455 13.3594 8.75089 13.0906C5.05627 11.679 3.20896 10.9732 3.01945 9.83727C2.97931 9.59669 2.98353 9.35108 3.03189 9.11259C3.26025 7.98657 5.13029 7.36859 8.87038 6.13264Z" />
    <path d="M12.8008 11.1865L15.498 8.48926" />
  </svg>
);

export default SendIcon;
