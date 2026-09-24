import type { NeedleCompletion } from '../../components/contour/contracts';

export type NeedleWorkerRequest =
  | {
    type: 'init';
    id: number;
    loader: string;
    wasm: ArrayBuffer;
    model: ArrayBuffer;
    system: string;
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown>; triggers?: readonly string[] }>;
  }
  | { type: 'complete'; id: number; input: string }
  | { type: 'dispose'; id: number };

export type NeedleWorkerResponse =
  | { type: 'ready'; id: number }
  | { type: 'result'; id: number; completion: NeedleCompletion }
  | { type: 'error'; id: number; message: string; fatal: boolean };
