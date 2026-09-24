/// <reference lib="webworker" />

type NeedleWorkerRequest =
  | { type: 'init'; id: number; loader: string; wasm: ArrayBuffer; model: ArrayBuffer; system: string; tools: unknown[] }
  | { type: 'complete'; id: number; input: string }
  | { type: 'dispose'; id: number };

type NeedleWorkerResponse =
  | { type: 'ready'; id: number }
  | { type: 'result'; id: number; completion: Record<string, unknown> }
  | { type: 'error'; id: number; message: string; fatal: boolean };

interface NeedleModule {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _needle_load(pointer: number, size: bigint): number;
  _needle_init(systemPointer: number, toolsPointer: number, indexPointer: number): number;
  _needle_complete(inputPointer: number, maxTokens: number, outputPointer: number, outputCapacity: number): number;
  _needle_reset(): void;
}

type CreateNeedle = (options: { wasmBinary: ArrayBuffer }) => Promise<NeedleModule>;

declare const createNeedle: CreateNeedle;

let moduleInstance: NeedleModule | null = null;
let loaderUrl: string | null = null;

function post(message: NeedleWorkerResponse) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

function allocateString(module: NeedleModule, value: string): number {
  const encoded = new TextEncoder().encode(`${value}\0`);
  const pointer = module._malloc(encoded.byteLength);
  if (!pointer) throw new Error('Needle could not allocate memory.');
  module.HEAPU8.set(encoded, pointer);
  return pointer;
}

function loadBytes(module: NeedleModule, bytes: ArrayBuffer): void {
  const pointer = module._malloc(bytes.byteLength);
  if (!pointer) throw new Error('Needle could not allocate model memory.');
  try {
    module.HEAPU8.set(new Uint8Array(bytes), pointer);
    const result = module._needle_load(pointer, BigInt(bytes.byteLength));
    if (result !== 0) throw new Error(`Needle model load failed (${result}).`);
  } finally {
    module._free(pointer);
  }
}

async function initialise(request: Extract<NeedleWorkerRequest, { type: 'init' }>): Promise<void> {
  if (moduleInstance) {
    post({ type: 'ready', id: request.id });
    return;
  }

  const blob = new Blob([request.loader], { type: 'text/javascript' });
  loaderUrl = URL.createObjectURL(blob);
  try {
    importScripts(loaderUrl);
    const factory = typeof createNeedle === 'function' ? createNeedle : null;
    if (!factory) throw new Error('Needle browser loader did not expose createNeedle.');
    const instance = await factory({ wasmBinary: request.wasm });
    loadBytes(instance, request.model);

    const systemPointer = allocateString(instance, request.system);
    const toolsPointer = allocateString(instance, JSON.stringify(request.tools));
    try {
      const result = instance._needle_init(systemPointer, toolsPointer, 0);
      if (result < 0) throw new Error(`Needle initialisation failed (${result}).`);
    } finally {
      instance._free(systemPointer);
      instance._free(toolsPointer);
    }
    moduleInstance = instance;
    post({ type: 'ready', id: request.id });
  } finally {
    if (loaderUrl) URL.revokeObjectURL(loaderUrl);
    loaderUrl = null;
  }
}

function complete(request: Extract<NeedleWorkerRequest, { type: 'complete' }>): void {
  const module = moduleInstance;
  if (!module) throw new Error('Contour Extended is not loaded.');

  module._needle_reset();
  const inputPointer = allocateString(module, request.input);
  const outputCapacity = 256 * 1024;
  const outputPointer = module._malloc(outputCapacity);
  if (!outputPointer) {
    module._free(inputPointer);
    throw new Error('Needle could not allocate output memory.');
  }

  try {
    const result = module._needle_complete(inputPointer, 512, outputPointer, outputCapacity);
    if (result < 0) throw new Error(`Needle completion failed (${result}).`);
    // The C API returns generated-token count, not output byte length. The
    // response buffer is a null-terminated UTF-8 JSON string.
    const bytes = module.HEAPU8.subarray(outputPointer, outputPointer + outputCapacity);
    let end = bytes.indexOf(0);
    if (end < 0) end = bytes.byteLength;
    const text = new TextDecoder().decode(bytes.subarray(0, end));
    post({ type: 'result', id: request.id, completion: JSON.parse(text) });
  } finally {
    module._free(inputPointer);
    module._free(outputPointer);
  }
}

(self as unknown as DedicatedWorkerGlobalScope).addEventListener('message', (event: MessageEvent<NeedleWorkerRequest>) => {
  const request = event.data;
  if (!request) return;

  if (request.type === 'dispose') {
    moduleInstance = null;
    close();
    return;
  }

  Promise.resolve(request.type === 'init' ? initialise(request) : complete(request)).catch((error: unknown) => {
    post({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
      fatal: request.type === 'init',
    });
  });
});
