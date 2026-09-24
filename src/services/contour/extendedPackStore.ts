import {
  CONTOUR_EXTENDED_MANIFEST,
  type ContourExtendedAsset,
  type ContourExtendedManifest,
} from './extendedManifest';

const CACHE_NAME = 'tm-contour-extended-v1';
const META_DB = 'tm-contour-extended';
const META_STORE = 'packs';
const META_KEY = 'active';

export type ContourExtendedPhase =
  | 'checking'
  | 'not-installed'
  | 'downloading'
  | 'ready'
  | 'loading'
  | 'active'
  | 'unsupported'
  | 'error';

export interface ContourExtendedState {
  phase: ContourExtendedPhase;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  persisted: boolean | null;
  packVersion: string | null;
  error: string | null;
}

interface InstalledPackMeta {
  key: typeof META_KEY;
  packVersion: string;
  installedAt: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let state: ContourExtendedState = {
  phase: 'checking',
  progress: 0,
  downloadedBytes: 0,
  totalBytes: CONTOUR_EXTENDED_MANIFEST.assets.reduce((sum, asset) => sum + asset.bytes, 0),
  persisted: null,
  packVersion: null,
  error: null,
};

function publish(patch: Partial<ContourExtendedState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function getContourExtendedState(): ContourExtendedState {
  return state;
}

export function subscribeContourExtended(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function contourExtendedSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof WebAssembly !== 'undefined'
    && typeof indexedDB !== 'undefined'
    && typeof caches !== 'undefined'
    && !!globalThis.crypto?.subtle;
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}

function openMetaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(META_DB, 1);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error('Contour storage could not be opened'));
  });
}

async function readMeta(): Promise<InstalledPackMeta | null> {
  const db = await openMetaDb();
  const tx = db.transaction(META_STORE, 'readonly');
  return (await request(tx.objectStore(META_STORE).get(META_KEY) as IDBRequest<InstalledPackMeta | undefined>)) ?? null;
}

async function writeMeta(meta: InstalledPackMeta): Promise<void> {
  const db = await openMetaDb();
  const tx = db.transaction(META_STORE, 'readwrite');
  await request(tx.objectStore(META_STORE).put(meta));
}

async function clearMeta(): Promise<void> {
  const db = await openMetaDb();
  const tx = db.transaction(META_STORE, 'readwrite');
  await request(tx.objectStore(META_STORE).delete(META_KEY));
}

function assetCacheKey(manifest: ContourExtendedManifest, asset: ContourExtendedAsset): string {
  return new URL(`/__tm/contour-extended/${manifest.packVersion}/${asset.id}`, window.location.origin).toString();
}

async function hasCompletePack(manifest: ContourExtendedManifest): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  for (const asset of manifest.assets) {
    if (!await cache.match(assetCacheKey(manifest, asset))) return false;
  }
  return true;
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function verify(bytes: Uint8Array, expected: string): Promise<void> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', owned.buffer);
  if (hex(digest) !== expected) throw new Error('Downloaded model file failed its integrity check.');
}

async function downloadAsset(
  asset: ContourExtendedAsset,
  completedBefore: number,
  total: number,
): Promise<Response> {
  const response = await fetch(asset.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${asset.id}.`);

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    await verify(bytes, asset.sha256);
    publish({ downloadedBytes: completedBefore + bytes.byteLength, progress: (completedBefore + bytes.byteLength) / total });
    return new Response(bytes, { headers: { 'Content-Type': asset.contentType } });
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.byteLength;
    publish({ downloadedBytes: completedBefore + received, progress: Math.min((completedBefore + received) / total, 1) });
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await verify(bytes, asset.sha256);
  return new Response(bytes, { headers: { 'Content-Type': asset.contentType, 'Content-Length': String(bytes.byteLength) } });
}

let initialised = false;

export async function initialiseContourExtended(): Promise<ContourExtendedState> {
  if (initialised) return state;
  initialised = true;
  if (!contourExtendedSupported()) {
    publish({ phase: 'unsupported', error: 'This browser cannot run local Contour models.' });
    return state;
  }

  try {
    const [meta, persisted] = await Promise.all([
      readMeta(),
      navigator.storage?.persisted?.() ?? Promise.resolve(false),
    ]);
    const installed = meta?.packVersion === CONTOUR_EXTENDED_MANIFEST.packVersion
      && await hasCompletePack(CONTOUR_EXTENDED_MANIFEST);
    publish({
      phase: installed ? 'ready' : 'not-installed',
      progress: installed ? 1 : 0,
      downloadedBytes: installed ? state.totalBytes : 0,
      persisted,
      packVersion: installed ? meta.packVersion : null,
      error: null,
    });
  } catch (error) {
    publish({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
  }
  return state;
}

export async function installContourExtended(): Promise<void> {
  if (!contourExtendedSupported()) {
    publish({ phase: 'unsupported', error: 'This browser cannot run local Contour models.' });
    return;
  }

  const manifest = CONTOUR_EXTENDED_MANIFEST;
  const total = manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  publish({ phase: 'downloading', progress: 0, downloadedBytes: 0, totalBytes: total, error: null });

  try {
    const persisted = await (navigator.storage?.persist?.() ?? Promise.resolve(false));
    const cache = await caches.open(CACHE_NAME);
    let completed = 0;
    for (const asset of manifest.assets) {
      const response = await downloadAsset(asset, completed, total);
      await cache.put(assetCacheKey(manifest, asset), response);
      completed += asset.bytes;
    }
    await writeMeta({ key: META_KEY, packVersion: manifest.packVersion, installedAt: new Date().toISOString() });
    publish({
      phase: 'ready',
      progress: 1,
      downloadedBytes: total,
      persisted,
      packVersion: manifest.packVersion,
      error: null,
    });
  } catch (error) {
    await removeContourExtended();
    publish({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function readContourExtendedAssets(): Promise<{ loader: string; wasm: ArrayBuffer; model: ArrayBuffer }> {
  const cache = await caches.open(CACHE_NAME);
  const responses = await Promise.all(CONTOUR_EXTENDED_MANIFEST.assets.map(asset => cache.match(assetCacheKey(CONTOUR_EXTENDED_MANIFEST, asset))));
  if (responses.some(response => !response)) throw new Error('Contour Extended files are missing. Download the pack again.');
  const [loader, wasm, model] = responses as Response[];
  return {
    loader: await loader.text(),
    wasm: await wasm.arrayBuffer(),
    model: await model.arrayBuffer(),
  };
}

export async function removeContourExtended(): Promise<void> {
  try {
    await Promise.all([caches.delete(CACHE_NAME), clearMeta()]);
  } finally {
    publish({
      phase: 'not-installed',
      progress: 0,
      downloadedBytes: 0,
      packVersion: null,
      error: null,
    });
  }
}

export function setContourExtendedRuntimePhase(phase: 'loading' | 'active' | 'ready', error: string | null = null): void {
  publish({ phase, error });
}

export function setContourExtendedError(error: unknown): void {
  publish({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
}
