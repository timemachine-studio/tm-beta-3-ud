import type { ModuleData, ModuleId } from './moduleRegistry';
import type { CapabilityEffect, CapabilityManifest } from '../../../shared/capabilities';

export type ContourEffect = CapabilityEffect;
export type ContourCandidateSource = 'core' | 'needle';
export type ContourDisposition = 'immediate' | 'confirm' | 'silent';

export interface ContourCapability extends Pick<CapabilityManifest,
  'id' | 'version' | 'title' | 'description' | 'examples' | 'effect' | 'runtime' | 'persistence' | 'background' | 'requiredGrants'> {
  commandId: string;
  title: string;
  description: string;
  examples: readonly string[];
  effect: ContourEffect;
  moduleId: ModuleId | null;
  handler: string | null;
  tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    triggers?: readonly string[];
  };
}

export interface ContourCandidate {
  capabilityId: string;
  commandId: string;
  title: string;
  description: string;
  effect: ContourEffect;
  source: ContourCandidateSource;
  confidence: number | null;
  arguments: Record<string, unknown>;
  disposition: ContourDisposition;
  module: ModuleData | null;
}

export interface ContourSuggestion {
  candidate: ContourCandidate;
  prompt: string;
}

export interface NeedleFunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface NeedleCompletion {
  type?: string;
  function_calls?: NeedleFunctionCall[];
  suppressed_calls?: NeedleFunctionCall[];
  confidence?: number | null;
  reasoning?: string;
  validation?: { ungrounded?: string[] };
}
