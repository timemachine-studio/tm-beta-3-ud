import React from 'react';
import { HologramTitle } from './HologramTitle';
import { GlitchOverlay } from './GlitchOverlay';
import { HologramRings } from './HologramRings';

export function InitialLoader() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div className="relative">
        <HologramRings />
        <GlitchOverlay />
        <div className="relative z-10">
          <HologramTitle />
        </div>
      </div>
    </div>
  );
}
