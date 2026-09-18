import { useLayoutEffect } from 'react';
import { pageZoom } from '../utils/pageZoom';
import { viewportLayout } from '../utils/viewportLayout';

function hasKeyboardFocus(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  if (active instanceof HTMLTextAreaElement) return !active.readOnly && !active.disabled;
  return active instanceof HTMLInputElement && !active.readOnly && !active.disabled
    && !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(active.type);
}

/** Lives above routes so leaving a focused history search cannot strand chat
 * with the old keyboard height. CSS owns the unfocused viewport: WebKit can
 * report the previous visual viewport even after a route has finished painting. */
export function useAppViewport(routeKey: string, enabled: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let settling = 0;
    const update = () => {
      const focused = enabled && hasKeyboardFocus();
      const { vh, keyboard } = viewportLayout({
        layoutHeight: window.innerHeight,
        visualHeight: viewport?.height ?? window.innerHeight,
        offsetTop: viewport?.offsetTop ?? 0,
        scale: viewport?.scale ?? 1,
        zoom: pageZoom(),
        focused,
      });
      root.style.setProperty('--vh', vh);
      root.style.setProperty('--tm-keyboard', `${keyboard}px`);
      if (enabled && (viewport?.scale ?? 1) <= 1.01 && (window.scrollY !== 0 || (viewport?.offsetTop ?? 0) > 0)) {
        window.scrollTo(0, 0);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const settle = () => {
      schedule();
      window.clearTimeout(settling);
      settling = window.setTimeout(schedule, 350);
    };
    update();
    settle();
    window.addEventListener('resize', schedule);
    window.addEventListener('pageshow', settle);
    window.addEventListener('orientationchange', settle);
    document.addEventListener('focusin', settle);
    document.addEventListener('focusout', settle);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settling);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', settle);
      window.removeEventListener('orientationchange', settle);
      document.removeEventListener('focusin', settle);
      document.removeEventListener('focusout', settle);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
    };
  }, [routeKey, enabled]);
}
