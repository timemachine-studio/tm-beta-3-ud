import { createContext, useContext } from 'react';

interface SettingsModalContextType {
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

/**
 * Settings is a modal over whatever page is showing, not a route, so the
 * open/close state lives above the router. `/settings` still works as a
 * deep link — App redirects it home and opens the modal.
 */
export const SettingsModalContext = createContext<SettingsModalContextType>({
  isSettingsOpen: false,
  openSettings: () => { },
  closeSettings: () => { },
});

export function useSettingsModal() {
  return useContext(SettingsModalContext);
}
