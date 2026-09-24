import {
  contourCapabilityForTool,
} from '../../components/contour/capabilityRegistry';
import type {
  ContourCandidate,
  ContourDisposition,
  NeedleCompletion,
} from '../../components/contour/contracts';
import type { ModuleData } from '../../components/contour/moduleRegistry';
import {
  analyzeText,
  createHashResult,
  createSnippetResult,
  createTimerState,
  detectNaturalMath,
  detectColor,
  detectCurrency,
  detectDate,
  detectDictionary,
  detectGraph,
  detectLorem,
  detectRandom,
  detectTimezone,
  detectTranslation,
  detectUnits,
  evaluateMath,
  formatJson,
  parseTarget,
  processBase64,
  processUrl,
  resolveCurrency,
  resolveDictionary,
  resolveHash,
  resolveTranslation,
  testRegex,
  toSafeExternalUrl,
} from '../../components/contour/moduleRegistry';
import { detectQuickEvent } from '../../components/contour/modules/quickEvent';
import { contourExtendedRuntime } from './extendedRuntime';
import { isContourCandidateGrounded, shouldConsultContourExtended } from './intentPolicy';

function text(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(args: Record<string, unknown>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timerInput(args: Record<string, unknown>): string | null {
  const amount = number(args, 'amount');
  const unit = text(args, 'unit');
  if (amount === null || amount <= 0 || !unit) return null;
  const suffix = unit === 'hours' ? 'h' : unit === 'minutes' ? 'm' : unit === 'seconds' ? 's' : null;
  return suffix ? `${amount}${suffix}` : null;
}

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

function validTime(value: string | null): value is string {
  return !!value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function resolveModule(handler: string | null, args: Record<string, unknown>, original: string): Promise<ModuleData | null> {
  if (!handler) return null;

  switch (handler) {
    case 'calculator': {
      const expression = text(args, 'expression');
      const calculator = (expression ? evaluateMath(expression) : null) ?? detectNaturalMath(original);
      return calculator ? { id: 'calculator', focused: false, calculator } : null;
    }
    case 'graph-plotter': {
      const expression = text(args, 'expression');
      const graph = expression ? detectGraph(expression) : null;
      return graph ? { id: 'graph', focused: false, graph } : null;
    }
    case 'unit-converter': {
      const value = number(args, 'value');
      const from = text(args, 'from_unit');
      const to = text(args, 'to_unit');
      const units = value !== null && from && to ? detectUnits(`${value} ${from} to ${to}`) : null;
      return units ? { id: 'units', focused: false, units } : null;
    }
    case 'currency-converter': {
      const amount = number(args, 'amount');
      const from = text(args, 'from_currency');
      const to = text(args, 'to_currency');
      const pending = amount !== null && from && to ? detectCurrency(`${amount} ${from} to ${to}`) : null;
      const currency = pending && !pending.isPartial ? await resolveCurrency(pending) : pending;
      return currency ? { id: 'currency', focused: false, currency } : null;
    }
    case 'timezone': {
      const timezone = detectTimezone(text(args, 'query') ?? original);
      return timezone ? { id: 'timezone', focused: false, timezone } : null;
    }
    case 'color-converter': {
      const color = detectColor(text(args, 'value') ?? original);
      return color ? { id: 'color', focused: false, color } : null;
    }
    case 'date-calculator': {
      const date = detectDate(text(args, 'query') ?? original);
      return date ? { id: 'date', focused: false, date } : null;
    }
    case 'timer': {
      const timer = createTimerState(timerInput(args) ?? original);
      return timer ? { id: 'timer', focused: false, timer } : null;
    }
    case 'random': {
      const random = detectRandom(text(args, 'query') ?? original);
      return random ? { id: 'random', focused: false, random } : null;
    }
    case 'word-count': {
      const value = text(args, 'text');
      return value ? { id: 'wordcount', focused: false, wordcount: analyzeText(value) } : null;
    }
    case 'translator': {
      const source = text(args, 'text');
      const target = text(args, 'target_language');
      const pending = source && target ? detectTranslation(`translate ${source} to ${target}`) : null;
      const translator = pending ? await resolveTranslation(pending) : null;
      return translator ? { id: 'translator', focused: false, translator } : null;
    }
    case 'dictionary': {
      const word = text(args, 'word');
      const pending = word ? detectDictionary(`define ${word}`) : null;
      const dictionary = pending ? await resolveDictionary(pending) : null;
      return dictionary ? { id: 'dictionary', focused: false, dictionary } : null;
    }
    case 'lorem': {
      const lorem = detectLorem(text(args, 'query') ?? original);
      return lorem ? { id: 'lorem', focused: false, lorem } : null;
    }
    case 'json-format': {
      const value = text(args, 'text');
      return value ? { id: 'json-format', focused: false, jsonFormat: formatJson(value) } : null;
    }
    case 'base64': {
      const value = text(args, 'text');
      const operation = text(args, 'operation');
      return value && (operation === 'encode' || operation === 'decode')
        ? { id: 'base64', focused: false, base64: processBase64(value, operation) }
        : null;
    }
    case 'url-encode': {
      const value = text(args, 'text');
      const operation = text(args, 'operation');
      return value && (operation === 'encode' || operation === 'decode')
        ? { id: 'url-encode', focused: false, urlEncode: processUrl(value, operation) }
        : null;
    }
    case 'hash': {
      const value = text(args, 'text');
      const hash = value ? await resolveHash(createHashResult(value)) : null;
      return hash ? { id: 'hash', focused: false, hash } : null;
    }
    case 'regex': {
      const pattern = text(args, 'pattern');
      return pattern ? { id: 'regex', focused: false, regex: testRegex(pattern, '') } : null;
    }
    case 'snippets':
      return { id: 'snippets', focused: false, snippets: createSnippetResult() };
    case 'quick-note': {
      const content = text(args, 'content');
      return content ? { id: 'quick-note', focused: false, quickNote: { content } } : null;
    }
    case 'quick-event': {
      const title = text(args, 'title');
      if (!title) return null;
      const event = detectQuickEvent(`/event ${title}`);
      if (!event) return null;
      const date = text(args, 'date');
      const startTime = text(args, 'start_time');
      const endTime = text(args, 'end_time');
      return {
        id: 'quick-event',
        focused: false,
        quickEvent: {
          ...event,
          ...(validDate(date) ? { date } : {}),
          ...(validTime(startTime) ? { startTime } : {}),
          ...(validTime(endTime) ? { endTime } : {}),
        },
      };
    }
    case 'web-viewer': {
      const target = text(args, 'target');
      if (!target) return null;
      const url = toSafeExternalUrl(target);
      return {
        id: 'web-viewer',
        focused: false,
        webViewer: url
          ? { url }
          : { url: `https://www.google.com/search?q=${encodeURIComponent(target)}`, query: target },
      };
    }
    case 'file-convert': {
      const format = text(args, 'target_format');
      if (!format) return null;
      return {
        id: 'file-convert',
        focused: true,
        fileConvert: { target: parseTarget(format), sourceHint: null, query: format },
      };
    }
    case 'help':
      return { id: 'help', focused: false };
    default:
      return null;
  }
}

function disposition(effect: ContourCandidate['effect'], module: ModuleData | null, confidence: number | null): ContourDisposition {
  if (effect === 'pure' && module && confidence !== null && confidence >= 0.7) return 'immediate';
  if (effect === 'read' && module && confidence !== null && confidence >= 0.8) return 'immediate';
  return 'confirm';
}

export async function candidateFromNeedleCompletion(
  completion: NeedleCompletion,
  original: string,
): Promise<ContourCandidate | null> {
  // Needle withholds a low-confidence but structurally valid call in
  // suppressed_calls. That is exactly Contour's confirmation path.
  const call = completion.function_calls?.[0] ?? completion.suppressed_calls?.[0];
  if (!call || !call.arguments || typeof call.arguments !== 'object') return null;
  const capability = contourCapabilityForTool(call.name);
  if (!capability) return null;
  if (!isContourCandidateGrounded(capability.handler, capability.commandId, original)) return null;

  const args = call.arguments;
  const module = await resolveModule(capability.handler, args, original);
  const confidence = typeof completion.confidence === 'number' && Number.isFinite(completion.confidence)
    ? Math.min(Math.max(completion.confidence, 0), 1)
    : null;
  const candidateDisposition = disposition(capability.effect, module, confidence);

  return {
    capabilityId: capability.id,
    commandId: capability.commandId,
    title: capability.title,
    description: capability.description,
    effect: capability.effect,
    source: 'needle',
    confidence,
    arguments: args,
    disposition: candidateDisposition,
    module,
  };
}

export async function analyzeWithContourExtended(input: string): Promise<ContourCandidate | null> {
  if (!shouldConsultContourExtended(input)) return null;
  const completion = await contourExtendedRuntime().complete(input.trim());
  return candidateFromNeedleCompletion(completion, input.trim());
}
