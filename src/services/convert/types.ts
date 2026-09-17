/** Shared shapes for the conversion engines. */

export type ConversionPhase = 'engine' | 'convert';

export interface ConversionProgress {
  phase: ConversionPhase;
  /** Short, user-facing: "Loading image engine", "Converting". */
  label: string;
  /** 0–1 when the engine knows; undefined for an indeterminate step. */
  ratio: number | undefined;
}

export type ProgressReporter = (progress: ConversionProgress) => void;

export interface ConversionOptions {
  /** 1–100. Lossy images and audio bitrate scale from it. */
  quality?: number;
  signal?: AbortSignal;
}

export class ConversionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ConversionError';
  }
}
