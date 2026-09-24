import type { ContourAction, ContourCommand } from './modules/commands';
import { CONTOUR_COMMANDS } from './modules/commands';
import { HANDLER_TO_MODULE } from './moduleRegistry';
import type { ContourCapability, ContourEffect } from './contracts';
import { TIMER_START_CAPABILITY } from '../../../shared/capabilities';

type JsonSchema = Record<string, unknown>;

const stringField = (description: string, extra: Record<string, unknown> = {}): JsonSchema => ({
  type: 'string',
  description,
  ...extra,
});

const numberField = (description: string, extra: Record<string, unknown> = {}): JsonSchema => ({
  type: 'number',
  description,
  ...extra,
});

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = Object.keys(properties),
): JsonSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const INLINE_PARAMETERS: Record<string, JsonSchema> = {
  calculator: objectSchema({ expression: stringField('The mathematical expression to calculate, using digits and operators.') }),
  'graph-plotter': objectSchema({ expression: stringField('The equation or mathematical expression to plot.') }),
  'unit-converter': objectSchema({
    value: numberField('The numeric quantity to convert.'),
    from_unit: stringField('The source unit stated by the user.'),
    to_unit: stringField('The destination unit stated by the user.'),
  }),
  'currency-converter': objectSchema({
    amount: numberField('The amount of money to convert.'),
    from_currency: stringField('The source ISO currency code or currency name.'),
    to_currency: stringField('The destination ISO currency code or currency name.'),
  }),
  timezone: objectSchema({ query: stringField('The complete time and timezone conversion requested by the user.') }),
  'color-converter': objectSchema({ value: stringField('The colour value or name to inspect or convert.') }),
  'date-calculator': objectSchema({ query: stringField('The complete date calculation requested by the user.') }),
  timer: objectSchema({
    amount: numberField('The stated timer duration.', { exclusiveMinimum: 0 }),
    unit: stringField('The duration unit.', { enum: ['seconds', 'minutes', 'hours'] }),
  }),
  random: objectSchema({ query: stringField('The requested random value, range, dice, password, UUID or coin flip.') }),
  'word-count': objectSchema({ text: stringField('The exact text the user wants counted.') }),
  translator: objectSchema({
    text: stringField('The exact text to translate.'),
    target_language: stringField('The target language stated by the user.'),
  }),
  dictionary: objectSchema({ word: stringField('The word or short phrase to define.') }),
  lorem: objectSchema({ query: stringField('The requested amount and unit of placeholder text.') }),
  'json-format': objectSchema({ text: stringField('The exact JSON text to format or validate.') }),
  base64: objectSchema({
    text: stringField('The exact text or Base64 value to process.'),
    operation: stringField('Whether to encode or decode.', { enum: ['encode', 'decode'] }),
  }),
  'url-encode': objectSchema({
    text: stringField('The exact text or URL value to process.'),
    operation: stringField('Whether to encode or decode.', { enum: ['encode', 'decode'] }),
  }),
  hash: objectSchema({ text: stringField('The exact text to hash.') }),
  regex: objectSchema({ pattern: stringField('The regular expression pattern.') }),
  snippets: objectSchema({}, []),
  'quick-note': objectSchema({ content: stringField('The exact content the user wants saved as a note.') }),
  'quick-event': objectSchema({
    title: stringField('A short event title copied from the request.'),
    date: stringField('Event date as YYYY-MM-DD when the request provides or implies one.'),
    start_time: stringField('Start time as HH:MM in local time when provided.'),
    end_time: stringField('End time as HH:MM in local time when provided.'),
  }, ['title']),
  'web-viewer': objectSchema({ target: stringField('The exact URL or search query requested by the user.') }),
  'file-convert': objectSchema({ target_format: stringField('The requested destination file format, without a leading dot.') }),
  help: objectSchema({}, []),
};

const HANDLER_EFFECTS: Record<string, ContourEffect> = {
  'currency-converter': 'read',
  translator: 'read',
  dictionary: 'read',
  'web-viewer': 'read',
  'quick-note': 'local-write',
  'quick-event': 'local-write',
  'file-convert': 'local-write',
};

const TOOL_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'quick-note': 'Create and save a one-off note on this device. Use for requests to jot down, remember, capture, stash, or make a note. Do not use for reusable templates.',
  'quick-event': 'Create and save a calendar event on this device. Use when the user wants to schedule an event, meeting, appointment, or reminder at a date or time.',
  snippets: 'Open the reusable text snippets and prompt templates manager. Use only for reusable snippets or templates, never for a one-off note.',
  memories: 'Open the existing Memories page. Use only when the user wants to view saved memories, not when they want to save a new note.',
  calculator: 'Calculate a mathematical expression now, including natural phrases such as work out, times, plus, minus, or divided by.',
  'convert-units': 'Convert a numeric physical measurement from one named unit to another, such as kilometres to miles or Celsius to Fahrenheit. Never use for ordinary arithmetic.',
};

const TOOL_TRIGGERS: Record<string, readonly string[]> = {
  'quick-note': ['\\b(jot down|make a note|note that|save (?:this|a note)|stash .*as a note)\\b'],
  'quick-event': ['\\b(schedule|add|create|book)\\b.*\\b(event|meeting|appointment|calendar)\\b'],
  snippets: ['\\b(snippet|prompt template|text template)\\b'],
  calculator: ['\\b(calculate|compute|work out|multiply|times|plus|minus|divid(?:e|ed))\\b'],
};

function actionEffect(action: ContourAction): ContourEffect {
  if (action.type === 'inline') return HANDLER_EFFECTS[action.handler] ?? 'pure';
  if (action.type === 'external') return 'external-write';
  if (action.type === 'clipboard') return 'local-write';
  return 'pure';
}

function actionHandler(action: ContourAction): string | null {
  return action.type === 'inline' || action.type === 'clipboard' ? action.handler : null;
}

function parametersFor(command: ContourCommand): JsonSchema {
  if (command.action.type === 'inline') {
    return INLINE_PARAMETERS[command.action.handler]
      ?? objectSchema({ query: stringField('The relevant part of the user request.') });
  }
  return objectSchema({}, []);
}

function examplesFor(command: ContourCommand): string[] {
  return command.keywords.slice(0, 5);
}

function toolName(commandId: string): string {
  return `contour__${commandId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export const CONTOUR_CAPABILITIES: readonly ContourCapability[] = CONTOUR_COMMANDS.map(command => {
  const handler = actionHandler(command.action);
  const moduleId = command.action.type === 'inline'
    ? (HANDLER_TO_MODULE[command.action.handler] ?? null)
    : null;

  const shared = command.id === 'timer' ? TIMER_START_CAPABILITY : null;
  return {
    id: shared?.id ?? `tm.contour.${command.id}`,
    version: shared?.version ?? 1,
    commandId: command.id,
    title: shared?.title ?? command.name,
    description: shared?.description ?? command.description,
    examples: shared?.examples ?? examplesFor(command),
    effect: shared?.effect ?? actionEffect(command.action),
    runtime: shared?.runtime ?? 'browser',
    persistence: shared?.persistence ?? (actionEffect(command.action) === 'pure' ? 'none' : 'device'),
    background: shared?.background ?? 'none',
    requiredGrants: shared?.requiredGrants ?? [],
    handler,
    moduleId,
    tool: {
      name: shared?.name ?? toolName(command.id),
      description: `${TOOL_DESCRIPTION_OVERRIDES[command.id] ?? command.description} Choose this only when the user is asking to perform this action now.`,
      parameters: shared?.inputSchema ?? parametersFor(command),
      ...(TOOL_TRIGGERS[command.id] ? { triggers: TOOL_TRIGGERS[command.id] } : {}),
    },
  } satisfies ContourCapability;
});

const BY_TOOL = new Map(CONTOUR_CAPABILITIES.map(capability => [capability.tool.name, capability]));
const BY_COMMAND = new Map(CONTOUR_CAPABILITIES.map(capability => [capability.commandId, capability]));

const PASS_TO_CHAT_TOOL: ContourCapability['tool'] = {
  name: 'contour__pass_to_chat',
  description: 'Use when the user wants a normal AI response rather than a bounded utility action: writing paragraphs, essays, stories, explanations, summaries, advice, opinions, decisions, or ordinary conversation. This means Contour must stay silent and let the message be sent.',
  parameters: objectSchema({}, []),
};

export function contourCapabilityForTool(name: string): ContourCapability | null {
  return BY_TOOL.get(name) ?? null;
}

export function contourCapabilityForCommand(commandId: string): ContourCapability | null {
  return BY_COMMAND.get(commandId) ?? null;
}

export function contourNeedleTools(): Array<ContourCapability['tool']> {
  return [...CONTOUR_CAPABILITIES.map(capability => capability.tool), PASS_TO_CHAT_TOOL];
}
