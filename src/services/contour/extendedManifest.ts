export interface ContourExtendedAsset {
  id: 'loader' | 'wasm' | 'model';
  url: string;
  bytes: number;
  sha256: string;
  contentType: string;
}

export interface ContourExtendedManifest {
  packVersion: string;
  model: string;
  capabilitySchemaVersion: string;
  assets: readonly ContourExtendedAsset[];
}

const NEEDLE_REVISION = 'b274efcb211a9eef48c9a88da4b43bd569696a39';
const NEEDLE_BASE = `https://huggingface.co/Cactus-Compute/needle3/resolve/${NEEDLE_REVISION}`;

/**
 * Pinned upstream artifacts. The app verifies every byte before activating a
 * pack, so an upstream replacement fails closed instead of silently changing
 * what Contour understands.
 */
export const CONTOUR_EXTENDED_MANIFEST: ContourExtendedManifest = {
  packVersion: 'needle3-b274efcb',
  model: 'Cactus Needle 3',
  capabilitySchemaVersion: 'contour-capabilities-v1',
  assets: [
    {
      id: 'loader',
      url: `${NEEDLE_BASE}/wasm/needle.js`,
      bytes: 62_502,
      sha256: 'd00ec67ec7e03e4720dfc6c3dad95a0540afd00169a983ce3fabcd7aeaa0fa93',
      contentType: 'text/javascript',
    },
    {
      id: 'wasm',
      url: `${NEEDLE_BASE}/wasm/needle.wasm`,
      bytes: 688_521,
      sha256: '77c6a38cacb8efbeebfd5202082ba9a0850a7c3066db40d4d0e80509cd137d9b',
      contentType: 'application/wasm',
    },
    {
      id: 'model',
      url: `${NEEDLE_BASE}/needle3.cact`,
      bytes: 35_335_380,
      sha256: 'c9d915eca282ed42d1a09b143b592adb4cc6744ffe2d294adf5cfc5548170c38',
      contentType: 'application/octet-stream',
    },
  ],
};

export const CONTOUR_EXTENDED_DOWNLOAD_BYTES = CONTOUR_EXTENDED_MANIFEST.assets
  .reduce((total, asset) => total + asset.bytes, 0);

