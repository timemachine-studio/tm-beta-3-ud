import { useEffect, useSyncExternalStore } from 'react';
import {
  getContourExtendedState,
  initialiseContourExtended,
  installContourExtended,
  removeContourExtended,
  subscribeContourExtended,
} from './extendedPackStore';
import { disposeContourExtendedRuntime } from './extendedRuntime';

export function useContourExtended() {
  const state = useSyncExternalStore(
    subscribeContourExtended,
    getContourExtendedState,
    getContourExtendedState,
  );

  useEffect(() => {
    void initialiseContourExtended();
  }, []);

  return {
    ...state,
    install: installContourExtended,
    remove: async () => {
      disposeContourExtendedRuntime();
      await removeContourExtended();
    },
  };
}

