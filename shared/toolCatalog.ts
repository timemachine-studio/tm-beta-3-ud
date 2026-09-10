/**
 * The tool catalogue: what tools exist, and how a turn decides which of them
 * the model actually sees.
 *
 * Before this module, `selectTools` held a hardcoded array filtered by three
 * hand-written regexes (image / build / search intent). That worked for five
 * tools and does not survive twenty: every new tool needs its own regex, the
 * regexes interact in ways nobody can hold in their head, and shipping them
 * all is the failure this whole mechanism exists to prevent — a request that
 * carries `generate_image` on a "build me an HTML game" turn gets a picture.
 *
 * So selection is data now. A tool declares what it is and when it is worth
 * offering; the packer decides. Three things fall out of that:
 *
 *  1. **A token budget, not a boolean.** Tools are ranked and packed until the
 *     budget runs out, so adding a tool cannot silently inflate every request.
 *  2. **A long tail that costs one tool.** Anything that did not fit is still
 *     reachable through `find_tools`, which loads schemas mid-run. The
 *     catalogue can grow without the per-message tax growing with it.
 *  3. **Registry tools work the same way.** A descriptor is plain JSON, so a
 *     tool TM generated and published to Supabase is selected by exactly the
 *     code that selects the built-ins. That is the point — see part B.
 *
 * Both api/ and src/ import this file, so it stays dependency-free.
 */

// ─── Descriptors ────────────────────────────────────────────────────────────

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

/** Where the tool's implementation runs. `device` tools go through the bridge. */
export type ToolRuntime = 'server' | 'device';

/**
 * How a tool gets into a request.
 *
 * `core`    — offered whenever its `requires` are met, no intent gate. The
 *             user's own apps are core: gating them on keywords is the same
 *             mistake as making the user open a specialist mode first.
 * `gated`   — offered only when its selection spec matches this turn, and only
 *             if the token budget still has room.
 * `catalog` — never offered automatically. Reachable only through find_tools.
 *             This is where the long tail lives.
 */
export type ToolTier = 'core' | 'gated' | 'catalog';

/**
 * Structural signals a selection spec can name.
 *
 * Enumerated rather than open, because a registry tool must not be able to
 * define new ones — a descriptor is untrusted data once it comes out of a
 * database row. Terms are matched literally for the same reason: a
 * caller-supplied regular expression is a ReDoS waiting to be published.
 */
export type SelectPredicate =
  | 'url_in_message'
  | 'recent_year'
  | 'image_attached'
  | 'pdf_attached'
  | 'calculation_in_message'
  | 'quantities_in_message';

/** A tool that becomes relevant because of what the *previous* turn produced. */
export interface SelectFollowUp {
  /** Match only when the last assistant turn contains this literal substring. */
  afterAssistantContains?: string;
  /** Match only when the user attached this kind of file to the current turn. */
  withAttachment?: 'image' | 'pdf';
  /** Terms that, together with the condition above, make the tool relevant. */
  intent: string[];
}

export interface SelectSpec {
  /** Any match makes the tool eligible. Literal phrases, not patterns. */
  intent?: string[];
  /** Any match rules the tool out, whatever else matched. Checked first. */
  veto?: string[];
  /** Structural signals, scored the same as an intent match. */
  predicates?: SelectPredicate[];
  /** Relevance carried over from the previous turn. */
  followUp?: SelectFollowUp[];
}

export interface ToolDescriptor {
  /** Must equal `definition.function.name`. */
  name: string;
  definition: ToolDefinition;
  runtime: ToolRuntime;
  tier: ToolTier;
  /**
   * Client capabilities required before this tool may be offered — 'notes',
   * 'chats', and later 'python', 'files'. A capability the client did not
   * declare means an older cached bundle that cannot run the tool, so the tool
   * is withheld rather than offered and stranded at the first call.
   */
  requires?: readonly string[];
  /** One line, shown by find_tools. Shorter than the model-facing description. */
  summary: string;
  select?: SelectSpec;
  /**
   * Whether a declined gate is the final word for this turn.
   *
   * Normally it is not. A selection gate is a keyword guess about what the
   * user meant, and find_tools is the model saying explicitly what it needs —
   * a much stronger signal. "Read the Wikipedia page on X" carries no URL, so
   * web_fetch's gate declines it, and being able to load the tool anyway is
   * the brittleness of keyword gating being fixed rather than worked around.
   *
   * Set this only where a false positive is user-visible damage rather than
   * wasted tokens. `generate_image` is the one that qualifies: producing an
   * unwanted picture is the exact failure the gate was written for, and it
   * must not be reachable through the side door.
   */
  gateIsFinal?: boolean;
  /** Built-in, or loaded from the shared registry. */
  origin?: 'builtin' | 'registry';
}

// ─── Term matching ──────────────────────────────────────────────────────────

/** Bounds the compile cost of a descriptor that arrives from the registry. */
const MAX_TERMS_PER_LIST = 400;

const patternCache = new Map<string, RegExp>();

function escapeTerm(term: string): string {
  // Whitespace inside a phrase is flexible; everything else is literal.
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // \b only means anything next to a word character. "c++" would anchor wrong.
  const left = /^\w/.test(term) ? '\\b' : '';
  const right = /\w$/.test(term) ? '\\b' : '';
  return `${left}${escaped}${right}`;
}

/** Compile a term list into one alternation, memoised across turns. */
function termsPattern(terms: readonly string[]): RegExp | null {
  const usable = terms.filter(term => typeof term === 'string' && term.trim()).slice(0, MAX_TERMS_PER_LIST);
  if (usable.length === 0) return null;
  const key = usable.join(' ');
  const cached = patternCache.get(key);
  if (cached) return cached;
  const compiled = new RegExp(`(?:${usable.map(escapeTerm).join('|')})`, 'i');
  patternCache.set(key, compiled);
  return compiled;
}

function matchesAny(text: string, terms: readonly string[] | undefined): boolean {
  if (!text || !terms?.length) return false;
  const pattern = termsPattern(terms);
  return pattern ? pattern.test(text) : false;
}

// ─── Selection context ──────────────────────────────────────────────────────

export interface SelectionContext {
  /** Text of the most recent user turn. */
  lastUserText: string;
  /** Text of the most recent assistant turn. */
  lastAssistantText: string;
  hasAttachedImage: boolean;
  hasAttachedPdf: boolean;
  /** Capabilities the client declared it can execute for this request. */
  capabilities: readonly string[];
}

export function emptySelectionContext(): SelectionContext {
  return {
    lastUserText: '',
    lastAssistantText: '',
    hasAttachedImage: false,
    hasAttachedPdf: false,
    capabilities: [],
  };
}

/** A bare http(s) URL in the user's own text. The signal `web_fetch` runs on. */
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"')]+/i;

/**
 * A year at or after the last training cut anyone is likely to have.
 *
 * Ported from the old SEARCH_INTENT regex, which spelled it `20(2[4-9]|3[0-9])`.
 * It stays a predicate rather than four hundred literal terms.
 */
const RECENT_YEAR = /\b20(?:2[4-9]|3\d)\b/;

/**
 * An arithmetic expression written out in the user's own message.
 *
 * The signal `run_python` runs on, and the reason it is a predicate rather
 * than terms: "17 * 23" has no words in it. Deliberately narrow. `-` and `/`
 * are left out of the symbol branch because they match date ranges, ratios
 * and "3-4 days" far more often than they match a sum, and a spelled-out
 * subtraction still matches through the word branch below.
 */
const CALCULATION_IN_TEXT = new RegExp([
  // 17 * 23, 2^10, 6 × 7, 2 ** 8
  String.raw`\d\s*(?:\*\*|[*^\u00d7\u00f7])\s*\d`,
  // 17 times 23, 40 percent of, 12 divided by 4
  String.raw`\b\d[\d,.]*\s*(?:times|multiplied\s+by|divided\s+by|plus|minus|squared|cubed|percent\s+of|%\s+of|to\s+the\s+power)\b`,
  // sqrt(2), 5!
  String.raw`\bsqrt\s*\(|\b\d+\s*!(?!\w)`,
].join('|'), 'i');

/**
 * Two or more measured quantities in one message.
 *
 * The signal a word list cannot carry. "The one to the east is 1200 N and the
 * one to the south is 2300 N. What is the resultant force?" is a physics
 * problem with an exact answer, and it contains no arithmetic operator and
 * none of run_python's terms — it was missed outright, and the model answered
 * with hand arithmetic that got the angle wrong in the second decimal.
 *
 * Two, not one, because a single quantity is how people write ordinary
 * sentences ("call me in 5 minutes"). Units are restricted to the unambiguous
 * ones for the same reason: bare `s` would make "the 1980s and the 1990s" a
 * physics question.
 */
const QUANTITY_IN_TEXT = /\b\d[\d,.]*\s?(?:N|kN|kg|mg|lbs?|km|cm|mm|nm|ft|mi|ms|m|°|deg(?:rees)?|rad|kJ|kW|Hz|Pa|atm|mol|m\/s|km\/h|mph|newtons?|joules?|watts?|volts?|amps?|met(?:re|er)s?|grams?|kilograms?|seconds?|minutes?|hours?|lit(?:re|er)s?)\b/gi;

function predicateHolds(predicate: SelectPredicate, ctx: SelectionContext): boolean {
  switch (predicate) {
    case 'url_in_message': return URL_IN_TEXT.test(ctx.lastUserText);
    case 'recent_year': return RECENT_YEAR.test(ctx.lastUserText);
    case 'image_attached': return ctx.hasAttachedImage;
    case 'pdf_attached': return ctx.hasAttachedPdf;
    case 'calculation_in_message': return CALCULATION_IN_TEXT.test(ctx.lastUserText);
    case 'quantities_in_message':
      // A global regex carries lastIndex between calls, so it is reset rather
      // than trusted — otherwise every other turn would silently miss.
      QUANTITY_IN_TEXT.lastIndex = 0;
      return (ctx.lastUserText.match(QUANTITY_IN_TEXT) || []).length >= 2;
    default: return false;
  }
}

/** Whether the client can run this tool at all. */
export function capabilitiesMet(descriptor: ToolDescriptor, capabilities: readonly string[]): boolean {
  if (!descriptor.requires?.length) return true;
  return descriptor.requires.every(required => capabilities.includes(required));
}

/** Whether this turn actively rules the tool out, as opposed to not asking for it. */
export function isVetoed(descriptor: ToolDescriptor, ctx: SelectionContext): boolean {
  return !!descriptor.select?.veto && matchesAny(ctx.lastUserText, descriptor.select.veto);
}

/**
 * How strongly this turn wants the tool.
 *
 * `null` means not eligible at all — vetoed, unsupported by the client, or
 * simply nothing in this turn that asks for it. A number is a relevance score;
 * the packer uses it to decide what to drop when the budget is tight.
 *
 * Biased toward saying no, for the reason the old image gate documented: a
 * false negative costs the user one clarifying message, while a false positive
 * is the failure this gate exists to stop.
 */
export function scoreTool(descriptor: ToolDescriptor, ctx: SelectionContext): number | null {
  if (!capabilitiesMet(descriptor, ctx.capabilities)) return null;
  if (descriptor.tier === 'catalog') return null;

  // A veto outranks everything, including core. "Build me an HTML game" must
  // not carry the image generator no matter how the tool is tiered.
  if (isVetoed(descriptor, ctx)) return null;

  if (descriptor.tier === 'core') return Number.POSITIVE_INFINITY;

  const spec = descriptor.select;
  if (!spec) return null;

  let score = 0;
  if (matchesAny(ctx.lastUserText, spec.intent)) score += 2;
  for (const predicate of spec.predicates || []) {
    if (predicateHolds(predicate, ctx)) score += 2;
  }
  for (const followUp of spec.followUp || []) {
    const conditionHolds =
      (followUp.afterAssistantContains
        ? ctx.lastAssistantText.includes(followUp.afterAssistantContains)
        : true) &&
      (followUp.withAttachment === 'image' ? ctx.hasAttachedImage
        : followUp.withAttachment === 'pdf' ? ctx.hasAttachedPdf
        : true);
    // A follow-up needs its condition *and* its terms; either alone is noise.
    if (conditionHolds && matchesAny(ctx.lastUserText, followUp.intent)) score += 1;
  }

  return score > 0 ? score : null;
}

// ─── Budgeting ──────────────────────────────────────────────────────────────

/**
 * Rough token cost of a tool schema.
 *
 * JSON tokenises at roughly three characters per token — denser than prose
 * because of the punctuation. Deliberately an estimate: the budget is a
 * ceiling on how much of a request tools may occupy, and being out by a few
 * percent changes nothing about that.
 */
export function estimateSchemaTokens(definition: ToolDefinition): number {
  return Math.ceil(JSON.stringify(definition).length / 3);
}

/**
 * What *gated* tools may add to a request, per surface.
 *
 * Core is not charged against this, and that is the whole point. It used to
 * be: one budget covered both, and the first version of this file set Air's
 * to 1,600 because core measured ~1,335 at the time. Then two more core tools
 * arrived — the skills pair, once a user enables a skill — core reached
 * ~1,395, and `run_python` silently stopped being offered to anyone with a
 * skill switched on. Found live: a turn that said "use Python" got a code
 * block, because the tool was never in the request.
 *
 * That coupling is wrong in both directions. Core tools are capabilities the
 * user has; they are offered regardless, so charging them against a budget
 * they cannot lose only decides *which other tools disappear* — and it does it
 * invisibly, as a side effect of adding something unrelated. The budget exists
 * to stop speculative tools inflating every request, so it now governs exactly
 * those.
 *
 * 700 fits the three or four gated tools that can plausibly fire on one turn
 * (run_python 246, web_fetch 165, web_search 114) with room for a couple of
 * MCP tools, which are the ones that could otherwise arrive by the dozen. PRO
 * pays for a bigger model on longer work; twice the room is cheap there.
 */
export const TOOL_TOKEN_BUDGET = { air: 700, pro: 1400 } as const;
export type ToolBudgetSurface = keyof typeof TOOL_TOKEN_BUDGET;

export interface PackedTools {
  /** Definitions to put in the request, in a stable order. */
  tools: ToolDefinition[];
  /** Descriptors that made it in. */
  offered: ToolDescriptor[];
  /**
   * Descriptors this client could run but that are not in the request —
   * out-tiered, out-scored, or out of budget. This is what find_tools sees.
   */
  findable: ToolDescriptor[];
  /** Tokens the offered schemas are estimated to cost. */
  tokensUsed: number;
}

/**
 * Decide which tools go in front of the model, within a token budget.
 *
 * Core first, because those are capabilities the user has rather than guesses
 * about what they meant. Gated tools fill whatever is left, best score first.
 * Anything that does not fit is not lost — it moves to `findable`, and the
 * model can pull it in mid-run for the price of one call.
 */
export function packTools(
  descriptors: readonly ToolDescriptor[],
  ctx: SelectionContext,
  budget: number,
): PackedTools {
  const scored: Array<{ descriptor: ToolDescriptor; score: number; cost: number }> = [];
  const findable: ToolDescriptor[] = [];

  for (const descriptor of descriptors) {
    if (!capabilitiesMet(descriptor, ctx.capabilities)) continue;
    // A vetoed tool is not "didn't fit" — this turn actively does not want it,
    // and find_tools must not hand it back through the side door.
    if (isVetoed(descriptor, ctx)) continue;

    const score = scoreTool(descriptor, ctx);
    if (score === null) {
      // Declined, not squeezed out. Findable unless the tool says its gate is
      // the final word — see `gateIsFinal`.
      if (!descriptor.gateIsFinal) findable.push(descriptor);
      continue;
    }
    scored.push({ descriptor, score, cost: estimateSchemaTokens(descriptor.definition) });
  }

  // Highest score first; ties broken by cost so a cheap tool is never crowded
  // out by an expensive one it scored level with, then by name for stability.
  scored.sort((a, b) =>
    b.score - a.score || a.cost - b.cost || a.descriptor.name.localeCompare(b.descriptor.name));

  const offered: ToolDescriptor[] = [];
  let tokensUsed = 0;
  /** Only gated tools compete for the budget — see TOOL_TOKEN_BUDGET. */
  let gatedTokens = 0;
  for (const entry of scored) {
    if (entry.score === Number.POSITIVE_INFINITY) {
      // Core is a capability, not a guess. It is always offered, and it does
      // not take room away from anything else.
      offered.push(entry.descriptor);
      tokensUsed += entry.cost;
      continue;
    }
    if (gatedTokens + entry.cost <= budget) {
      offered.push(entry.descriptor);
      tokensUsed += entry.cost;
      gatedTokens += entry.cost;
    } else {
      findable.push(entry.descriptor);
    }
  }

  return {
    tools: offered.map(descriptor => descriptor.definition),
    offered,
    findable,
    tokensUsed,
  };
}

// ─── find_tools ─────────────────────────────────────────────────────────────

/**
 * How many schemas one find_tools call may load.
 *
 * The whole point of the meta-tool is that the long tail costs one schema
 * instead of fifty, so loading is capped: three tools covers a request that
 * genuinely needs a couple of related capabilities, and a model that wants
 * more can search again with a narrower query.
 */
export const MAX_TOOLS_PER_FIND = 3;

/** Extra tokens one find_tools call may add to the rest of the run. */
export const FIND_GRANT_TOKEN_BUDGET = 1400;

export const findToolsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'find_tools',
    strict: true,
    // Kept deliberately short: this schema rides on almost every request, so
    // every clause is a tax on the cheapest tier. The category list stays —
    // it is what tells the model there is anything behind the door at all —
    // and the worked examples went, because the model writes the query.
    description: "Load a tool you do not have. TimeMachine has more tools than fit in one request: running code, reading web pages, working with files, connected services. Say what you need and the matching tools become callable immediately.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The capability you need, in your own words.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/** Words too common to tell two tools apart. */
const FIND_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from',
  'get', 'i', 'in', 'is', 'it', 'me', 'my', 'need', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'use', 'want', 'with', 'you',
]);

function findTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2 && !FIND_STOPWORDS.has(token));
}

export interface FindToolsMatch {
  descriptor: ToolDescriptor;
  score: number;
}

/**
 * Rank findable tools against a natural-language query.
 *
 * Lexical overlap over the name, summary and declared intent terms. It is not
 * semantic and does not need to be: the model wrote the query knowing what it
 * wants, and the candidate set is dozens of tools, not millions of documents.
 * Swapping in embeddings later means replacing this function and nothing else.
 */
export function rankFindableTools(
  findable: readonly ToolDescriptor[],
  query: string,
): FindToolsMatch[] {
  const queryTokens = findTokens(query);
  // An empty query is a browse, not a search: show the catalogue in a stable
  // order rather than nothing at all.
  if (queryTokens.length === 0) {
    return [...findable]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(descriptor => ({ descriptor, score: 0 }));
  }

  const matches: FindToolsMatch[] = [];
  for (const descriptor of findable) {
    const haystack = new Set([
      ...findTokens(descriptor.name),
      ...findTokens(descriptor.summary),
      ...findTokens((descriptor.select?.intent || []).join(' ')),
    ]);
    let score = 0;
    for (const token of queryTokens) {
      if (haystack.has(token)) score += 2;
      // Catches "analysing"/"analysis" and "file"/"files" without a stemmer.
      else if ([...haystack].some(word => word.startsWith(token) || token.startsWith(word))) score += 1;
    }
    if (score > 0) matches.push({ descriptor, score });
  }

  return matches.sort((a, b) => b.score - a.score || a.descriptor.name.localeCompare(b.descriptor.name));
}
