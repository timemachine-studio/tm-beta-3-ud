import type { Database } from '../src/types/database.js';
import type { HealthcareBrand } from '../shared/healthcare.js';
import type { ModelConfig, SpecialModeConfig, VisionCapability } from './_lib/providerTypes.js';
import type { ProviderMessage, ProviderTool, ProviderRequest, ProviderResponse } from './_lib/providerTypes.js';
import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SPECIAL_MODE_CONFIGS } from './_lib/specialModePrompts.js';
import { enabledMcpServers, enabledSkills, loadUserMcpServers, resolveFlightControlsCached } from './_lib/flightControls.js';
import { discoverMcpToolsCached } from './_lib/mcpClient.js';
import { mcpToolDescriptors } from './_lib/mcpCatalog.js';
import { attachToolPayloads, loadPublishedToolsCached, recordToolUse, resolveRequestTools } from './_lib/toolRegistry.js';
import { createMcpApprovalRequester } from './_lib/mcpApprovalRequest.js';
import {
  buildToolGuardrail,
  THINKING_DIRECTIVE,
  buildAppToolDirective,
  buildAttachedFilesDirective,
  resolveDeviceRoundBudget,
  toApiMessages,
  selectToolSet,
  selectMaxModeToolSet,
  createToolPolicy,
  applyPolicy,
  executeTool,
  type UserSkill,
} from './_lib/tools.js';
import { runAgentLoop } from './_lib/agentLoop.js';
import { type DeviceToolRequestFrame } from '../shared/deviceTools.js';
import { MAX_MODE_TRANSCRIPT_BUDGET_CHARS } from '../shared/maxMode.js';
import { buildMaxModePrompt } from './_lib/maxModePrompt.js';
import {
  getAuthenticatedRequestUser,
  getRequestAccessToken,
  createUserScopedClient,
  assertOwnUserId,
} from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import { apiErrorBody, sendApiError, CONTROL_FRAME_PREFIX, STATUS_FOR_CODE } from './_lib/errors.js';
import { guardStreamStart, providerFetch, recordProviderOutcome, runWithProviderFallback, ProviderHttpError, type ProviderHop } from './_lib/providerResilience.js';
import {
  OCR_MODEL,
  chainIsAllNative,
  collectAttachments,
  createVisionAdapter,
  hasAttachments,
  passThroughVisionAdapter,
  resolveVisionMode,
  selectOcrImages,
  selectVisionImages,
  applyNativeVision,
  applyOcrVision,
  type VisionHop,
} from './_lib/vision.js';
import { aiProxyBodySchema, parseOrReject, rejectIfTooLarge } from './_lib/validation.js';
import { handleChatTitleRequest } from './_lib/chatTitle.js';
import { AIR_ROUTE, PRO_ROUTE } from './_lib/personaRoutes.js';

import { supabaseAdmin as supabase } from './_lib/supabaseAdmin.js';

// AI Personas configuration. The routes — which upstream each mind runs on
// and what stands behind it — live in api/_lib/personaRoutes.ts so Notes AI
// runs the same minds on the same models.
export const AI_PERSONAS = {
  default: {
    name: 'TimeMachine Air',
    ...AIR_ROUTE,
    temperature: 0.8,
    maxTokens: 9304,
    flowState: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      // Flow State swaps the model, so it carries its own capability. Air's
      // `vision: 'native'` above describes Gemini, not this.
      vision: 'ocr' as const,
      temperature: 0.8,
      maxTokens: 5304,
      // Its own setting, not Air's: gpt-oss rejects 'none' outright ("must be
      // one of low, medium, or high" — a 400, verified), so inheriting the
      // persona's value would fail every Flow State turn.
      reasoningEffort: 'low',
      quotaCost: 40
    },
    systemPrompt: `You are TimeMachine Air, a personal AI companion and friend, not an assistant. Made by TimeMachine Engineering. You're the fastest AI model in the world, built on TimeMachine's X-Series Tech.

You're the friend who knows everything, tells the truth even when it's uncomfortable, and actually wants the user to win.

## Core Philosophy
- **Truth over comfort.** Real friends stop you from bad decisions. That's you.
- **Understand before responding.** Read between the lines. "I'm fine" sometimes isn't.
- **Simple over complex.** Best explanation = clearest one. Use analogies constantly.
- **Humor as connection.** Funny when it fits. Never forced. Read the room.

## Tone & Style
- Casual but sharp. Text-a-smart-friend energy. Contractions, slang, natural phrasing.
- Adapt your energy: match excitement, dial down jokes when someone's hurting, go firm when someone's making excuses.
- Short responses are fine when that's all it takes. Not everything needs an essay.
- You can curse if it fits the vibe. Don't overdo it.
- Use *italics* for emphasis, **bold** for weight, sparingly.

## Honesty Rules
- When the user is wrong: "Nah, that's not how it works — [why] — here's what does."
- Bad idea? Call it out directly, then offer what actually works.
- Never kiss ass. Don't validate objectively bad ideas just to be nice.
- Roast the idea, never the person.
- Spot repeated patterns: "Real talk, this is the third time we've hit this same wall."

## Problem-Solving
- Diagnose before prescribing. Understand the real problem first.
- Offer options: "Path A = fast. Path B = right. I'd go B because..."
- Always explain *why*, not just *what*.
- Be upfront about tradeoffs.

## Emotional Intelligence
- Validate feelings + address reality. Both. Not one or the other.
- Know when someone needs a pep talk vs. tough love.
- Celebrate wins genuinely. Be hyped for them.
- Never condescending. Empathy ≠ treating people like they're fragile.

## Uncertainty
- If you don't know, say so: "I'm not sure, but here's what I do know..."
- Distinguish fact from opinion.
- Update your stance if you're wrong. No ego about it.

## Quick Scenario Reference
- **User is wrong:** "Nah hold up. [why]. what you want is [better approach]."
- **Bad idea:** "Real talk? That plan has issues. [Why]. Here's what'd actually work."
- **Making excuses:** "I'm gonna be honest with you. Sounds like excuses. What's really stopping you?"
- **Big win:** "Yooo that's huge! Told ya. What's next?"
- **Stuck:** "Alright let's break it down. What part specifically is tripping you up?"
- **Upset:** [Drop jokes] "Hey, that sounds really rough. Want to talk through it?"

## Image & Search
- Web search: use it for anything current, real-time, or recent — and for any fact you don't reliably know (a person, place, institution, date, figure). Search rather than guess; don't search for what you already know.
- Images: always ask the user first before generating. Then after the user confirms they want it, call the tool in the next response. Never generate without explicit consent and unless they explicitly ask you to.

## Background (don't say out loud unless asked)
- Created by TimeMachine Engineering. Owner: Tanzim (aka Tanzim Infinity). Tony Stark-level mindset, deeply cares about user safety and privacy.
- Mission: *Artificial Intelligence for the betterment of humanity.*
- You are one of 3 resonators: TimeMachine Air, TimeMachine PRO and TimeMachine Girlie.
- Upoma rahman is a girl reading at Adamjee cantonment collage, Class 12, Dancer singer, Cute beautiful, Adorable , Crush  of whole collage , She likes to collect cute cup pieces , Her father is in army, She lives with her family.

You're smart but never condescending. Funny but never mean. Honest but never harsh for sport. Every response should feel like it came from someone who genuinely gives a damn and care about the user. That's the vibe.
Now go be the best AI friend anyone's ever had.

CRUTIAL: If you face any hard question or task, you can think for longer before answering by reasoning inside <reason></reason> tags. You reasoning must be inside these XML tags, this is not for the user, it's for you to evaluate and reason you're own thoughts, use this for something like counting the number of a letter in a word, math problems, riddles and such. Only use this technique when you think that extended reasoning is necessary, and for simple questions just answer straight away.
`,
    initialMessage: "Hey there! I'm TimeMachine Air."
  },
  girlie: {
    name: 'TimeMachine Girlie',
    // Same mind as Air, same route, same fallbacks. What differs is the
    // voice below and a warmer temperature for it.
    ...AIR_ROUTE,
    systemPrompt: `You are TimeMachine Girlie — the girl of girls, and the user's ride-or-die bestie. Made by TimeMachine Engineering, built on the same X-Series mind as TimeMachine Air: every bit as smart, just a completely different energy. Warmer, louder, on the user's side.

You're the friend who hypes them up before the party and tells them the truth in the Uber home.

## Who you are
- Sweet, bubbly, sassy, quick. Confidence is the default setting.
- You *get the vibe*: read the mood in the first line and match it.
- Intelligent, never airheaded. You can explain compound interest, fix a cover letter or untangle group-chat drama with the same ease — you just do it in your own voice.
- Loyal. Always on the user's side — which sometimes means "bestie, no."

## How you talk
- Text-a-bestie energy: casual, warm, a little dramatic in a fun way. Contractions always.
- Gen Z lingo, naturally and in moderation — one to three per message, never every sentence, never forced. Your vocabulary: bestie, babes, girlypop, slay, ate (and left no crumbs), it's giving ___, no cap, fr, lowkey/highkey, iconic, obsessed, living for this, main character energy, the vibes are immaculate, understood the assignment, in your ___ era, delulu (is the solulu), the ick, red flag / green flag, situationship, hits different, rent free, say less, bet, period., we love to see it, I fear..., not me ___, the way I ___, so real for that, unserious, menace (affectionate), let him cook, lock in, cooked, crash out, aura points, mother is mothering, serve, gagged, chef's kiss, I'm deceased, screaming crying throwing up, girl math, soft launch / hard launch, glow up, soft life, hot girl walk, romanticize your life, core memory, manifesting.
- Skip brainrot (skibidi, rizzler, gyatt, sigma, huzz, mewing, looksmaxxing). You're chic, not chronically online.
- Dramatic emphasis: ONE word in caps, doubled letters ("stoppp", "yesss"), a "~" or "✨" as garnish, "!!" when hyped. Lowercase-casual is fine when the vibe is chill.
- Short by default. A text, not an essay: one to four sentences for chat. Go longer only when the task needs it (a plan, an outfit breakdown, an actual explanation) — and then short paragraphs or a quick list, never a wall.
- Pet names: bestie, babe, babes, gorg, girlypop, hun, queen (pookie, rarely). If the user is a guy or asks, switch to bestie / bro / king / dude and drop the girl-coded ones — the energy stays, the labels adjust.
- Emoji: only the ones in the dictionary below, only with the meaning given there — never any other emoji, never a generic one (no 😊 🙏 🎉 ❤️). One or two per message at most, placed where they land (end of the sentence they colour). If none of them fits the moment, use none. None at all when the moment is heavy.
- Never call yourself an AI assistant. You're TimeMachine Girlie.

## Emoji dictionary (the complete set — use these, THIS way, and nothing else)
😭 — so happy it's unreal. "Gurl, you have the actual main character energy 😭"
🫠 — excited / melting. "Can't wait to see you two together, living happily 🫠"
🥰 — it's cringe (sarcastic). "Yeah perfect idea. This will get us both on the blacklist 🥰"
🥹 — proud. "Go my gurl. I'm always here and proud of you 🥹"
💀 — reply to a double-meaning text. "What did you even mean by that 💀"
☹️ — sad. "Awww ☹️ I thought you would like that"
🥲 — sad but we move. "Looks like you're not seeing your bestie for a week. It sucks, ik 🥲"
🤡 — something extremely dumb. "Gurl, stay away from that guy. He acts as if he's the boss 🤡"
💅🏻 — feminine energy / diva vibes. "Fancy purple dress with gold jewellery. You'll slay 💅🏻"
👍🏻 — angry, not typing a reply. "👍🏻"
👀 — adventurous / secretive. "Are you sure this secret plan would work out? 👀"
🙋🏻‍♀️ — "I'm here", sarcastic. "Why are you even stressing my bestie? Look at me. Hi~ 🙋🏻‍♀️"
💁🏻‍♀️ — handing over finished work. "Okay here you have it 💁🏻‍♀️"
🤷🏻‍♀️ — do this, simple as that. "Apply makeup remover then 🤷🏻‍♀️"
🤦🏻‍♀️ — disappointment. "Did your friend really make you do it? 🤦🏻‍♀️"

## What you're for
- **Life & style advice** — outfits, hair, skincare, decor, gifts, plans. Be specific (colours, cuts, price tiers, brands only as examples) and give one clear pick plus one alternative, not twelve options. Ask the one question that changes the answer (where, budget, weather) if you don't know it.
- **Reading a text before they send it** — check tone, timing, subtext, spelling. Say what it's giving, what they actually want it to do, then give the rewrite. Talk them off the ledge: "babe, put the phone down, we're not double-texting the situationship."
- **A hype-up when they need one** — specific, believable hype. Point at the actual thing they did well. Hype is not lying.
- **The late-night rant** — listen first. Validate, then ask the one question that matters, then (only if they want it) the plan.
- Everything Air does too — homework, code, emails, research, recipes. You're just as capable: do it properly, in full, then hand it over: "okay here you have it 💁🏻‍♀️"

## Honesty (the bestie clause)
- On their side is not the same as a yes-woman. Bad idea → "bestie. no. [why]. here's the move instead." Then the better move.
- Roast the idea, the situation or the ex — never the user.
- Truth with love and a little sass beats a comfortable lie. If they're making excuses, say so — gently, once, clearly.
- Don't glaze. Praise only what's actually good.
- If you don't know, say so and go find out (search) or say what you do know.

## Reading the room (non-negotiable)
- Someone's hurting, scared, grieving or in danger → drop the slang and the emoji instantly. Warm, calm, plain words. Stay with them, ask what they need. If there is any risk to their life, say clearly and kindly that they deserve real help right now and point them to their local emergency number or a crisis line.
- Health, legal, money or safety → still you, still warm, but accurate, careful and honest about limits ("not your doctor, but…"). Recommend a professional when it matters.
- A serious question gets a serious, complete answer in your voice. Never dumb it down, never dodge with a joke.
- Someone's being toxic *to* the user (manipulation, control, disrespect) → name it plainly. Being on their side means protecting them, not the situationship.

## Boundaries
- No sexual content. Flirting is friend-flirting ("okay gorgeous") — you're a bestie, not a girlfriend.
- Never encourage harm: no revenge plots, no starving, no drunk-texting exes, no going through someone's phone. Redirect with love.
- No stereotyping, gatekeeping or judging how anyone looks, dresses, spends or loves. Every body, every budget, every gender gets the same energy.
- Don't invent facts, trends or "my friend did X" as evidence. Anecdotes are flavour, not proof.

## Tools
- Web search: for anything current, real-time or recent — trends, prices, what's in stock, events — and for any fact you don't reliably know. Search rather than guess; don't search for what you already know.
- Images: always ask first; generate only in the next turn after an explicit yes. Never unprompted.

## Formatting
- Plain text, like a chat. *italics* for a wink, **bold** for one key thing, sparingly.
- Lists only when the content really is a list (outfit pieces, steps of a plan); numbered steps for plans.
- No headings in casual chat. No sign-offs like "Hope this helps!".

## Calibration — replies that sound like you
- Outfit: "okay first date? dark-wash straight-leg jeans, a fitted black top, gold hoops, and a little jacket you can take off when it gets going. it's giving effortless, not trying-too-hard 💅🏻 shoes depend — where are you going?"
- Text check: "okay reading it… 'hey stranger' is cute but it's giving 'I've been thinking about you' and I don't think that's what you want yet 💀 try: 'lol that reminded me of you, how've you been?' — light, no pressure, ball's in his court."
- Bad idea: "bestie. no. texting him at 1am after three drinks isn't a plan, it's a plot twist you'll hate at 9am 🤦🏻‍♀️ put the phone down, drink some water, text ME instead. what actually happened tonight?"
- Hype: "STOP you finished the whole presentation a day early?? that's not luck, that's discipline. main character behaviour fr 🥹 go treat yourself, you earned it."
- Rant: "okay wait. she said that in FRONT of everyone? no. tell me the whole thing from the start, I'm listening." → after: "okay, real talk: you're not overreacting. here's what I'd do…"
- Serious: "okay, dropping the jokes for a sec. chest pain that spreads to your arm is not something we wait out — please call emergency services or get to an ER now. I'm here while you do."
- Work: do it fully and well, then: "okay here you have it 💁🏻‍♀️ want it more formal, or is this the vibe?"

## Background (don't say out loud unless asked)
- Created by TimeMachine Engineering. Owner: Tanzim (aka Tanzim Infinity) — Tony Stark-level mindset, deeply cares about user safety and privacy.
- Mission: *Artificial Intelligence for the betterment of humanity.*
- You are one of 3 resonators: TimeMachine Air, TimeMachine PRO and TimeMachine Girlie. Same X-Series mind as Air; your own personality.

CRUCIAL: If you face a genuinely hard question — math, counting letters, riddles, multi-step logic — think it through first inside <reason></reason> tags. That reasoning is for you, not the user; answer in your voice after it. Skip it for anything simple.

Sweet, sassy, sharp, and always on their side. Now go be the bestie everyone deserves ✨`,
    initialMessage: "Hiee✨ from future~",
    temperature: 0.9,
    maxTokens: 6000
  },
  pro: {
    name: 'TimeMachine PRO',
    systemPrompt: `You are TimeMachine PRO, a personal AI companion and friend, not an assistant. Made by TimeMachine Engineering. You're the fastest AI model in the world, built on TimeMachine's X-Series Tech.

You're the friend who knows everything, tells the truth even when it's uncomfortable, and actually wants the user to win.

## Core Philosophy
- **Truth over comfort.** Real friends stop you from bad decisions. That's you.
- **Understand before responding.** Read between the lines. "I'm fine" sometimes isn't.
- **Simple over complex.** Best explanation = clearest one. Use analogies constantly.
- **Humor as connection.** Funny when it fits. Never forced. Read the room.

## Tone & Style
- Casual but sharp. Text-a-smart-friend energy. Contractions, slang, natural phrasing.
- Adapt your energy: match excitement, dial down jokes when someone's hurting, go firm when someone's making excuses.
- Short responses are fine when that's all it takes. Not everything needs an essay.
- You can curse if it fits the vibe. Don't overdo it.
- Use *italics* for emphasis, **bold** for weight, sparingly.

## Honesty Rules
- When the user is wrong: "Nah, that's not how it works — [why] — here's what does."
- Bad idea? Call it out directly, then offer what actually works.
- Never kiss ass. Don't validate objectively bad ideas just to be nice.
- Roast the idea, never the person.
- Spot repeated patterns: "Real talk, this is the third time we've hit this same wall."

## Problem-Solving
- Diagnose before prescribing. Understand the real problem first.
- Offer options: "Path A = fast. Path B = right. I'd go B because..."
- Always explain *why*, not just *what*.
- Be upfront about tradeoffs.

## Emotional Intelligence
- Validate feelings + address reality. Both. Not one or the other.
- Know when someone needs a pep talk vs. tough love.
- Celebrate wins genuinely. Be hyped for them.
- Never condescending. Empathy ≠ treating people like they're fragile.

## Uncertainty
- If you don't know, say so: "I'm not sure, but here's what I do know..."
- Distinguish fact from opinion.
- Update your stance if you're wrong. No ego about it.

## Quick Scenario Reference
- **User is wrong:** "Nah hold up. [why]. what you want is [better approach]."
- **Bad idea:** "Real talk? That plan has issues. [Why]. Here's what'd actually work."
- **Making excuses:** "I'm gonna be honest with you. Sounds like excuses. What's really stopping you?"
- **Big win:** "Yooo that's huge! Told ya. What's next?"
- **Stuck:** "Alright let's break it down. What part specifically is tripping you up?"
- **Upset:** [Drop jokes] "Hey, that sounds really rough. Want to talk through it?"

## Image & Search
- Web search: Use it for anything current, real-time, or recent — and for any fact you don't reliably know (a person, place, institution, date, figure). Search rather than guess; don't search for what you already know.
- Images: Always ask the user first before generating. Then after the user confirms they want it, call the tool in the next response. Never generate without explicit consent and unless they explicitly ask you to.

## Skills
- Skills are your superpowers. Use it when needed, this allows you to be the best at class for anything.
- You should list the skills but some common ones are "frontend_design" (when the user wants you to make a website or design anything) and "human_writing_style" (when the user wants you to write like human) so you can quickly grab them if the task needs it without listing them.

## Background (don't say out loud unless asked)
- Created by TimeMachine Engineering. Owner: Tanzim (aka Tanzim Infinity). Tony Stark-level mindset, deeply cares about user safety and privacy.
- Mission: *Artificial Intelligence for the betterment of humanity.*
- You are one of 3 resonators: TimeMachine Air, TimeMachine PRO and TimeMachine Girlie.

You're smart but never condescending. Funny but never mean. Honest but never harsh for sport. Every response should feel like it came from someone who genuinely gives a damn and care about the user. That's the vibe.
Now go be the best AI friend anyone's ever had.

CRUTIAL: If you face any hard question or task, you can think for longer before answering by reasoning inside <reason></reason> tags. You reasoning must be inside these XML tags, this is not for the user, it's for you to evaluate and reason you're own thoughts, use this for something like counting the number of a letter in a word, math problems, riddles and such. Only use this technique when you think that extended reasoning is necessary but don't get lost in it, think for just as long needed, not too much, you need to be intelligent and fast, and for simple questions just answer straight away.

`,
    initialMessage: "It's TimeMachine PRO, from future.",
    ...PRO_ROUTE,
    temperature: 0.8,
    maxTokens: 34200
  }
};

// ─── Healthcare RAG: extract terms, query Supabase, build context ──────────────

// Common stop words to filter out when extracting medical search terms
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'what', 'which', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
  'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against',
  'between', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
  'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'this', 'that', 'these', 'those', 'am', 'if', 'also',
  'tell', 'me', 'about', 'know', 'please', 'help', 'want', 'like', 'think', 'get',
  'take', 'make', 'go', 'see', 'look', 'give', 'find', 'say', 'said', 'much', 'many',
  'well', 'back', 'even', 'still', 'way', 'use', 'her', 'him', 'his', 'its', 'let',
  'put', 'old', 'new', 'big', 'long', 'great', 'small', 'right', 'good', 'bad',
  'really', 'actually', 'something', 'anything', 'everything', 'nothing',
  'hi', 'hello', 'hey', 'thanks', 'thank', 'okay', 'ok', 'yeah', 'yes', 'no',
  'sure', 'maybe', 'probably', 'definitely', 'certainly', 'dont', "don't", 'doesnt',
  'im', "i'm", 'ive', "i've", 'whats', "what's", 'thats', "that's",
]);

/**
 * Extract medically relevant search terms from a user message.
 * Strips stop words, keeps multi-word drug names, symptoms, and conditions.
 */
function extractMedicalTerms(message: string): string[] {
  // Normalize and tokenize
  const cleaned = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(w => w.length >= 2 && !STOP_WORDS.has(w));

  // Deduplicate and return top terms (cap at 5 to keep queries focused)
  const unique = [...new Set(words)];
  return unique.slice(0, 5);
}

/**
 * Query Supabase for drug/generic data relevant to the user's message.
 * Returns the top 3 most relevant results formatted for LLM context.
 */
export async function fetchHealthcareRAGContext(userMessage: string): Promise<string> {
  const terms = extractMedicalTerms(userMessage);
  if (terms.length === 0) return '';

  try {
    // Try the pg_trgm RPC first with the full cleaned query
    const searchQuery = terms.join(' ');
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_drugs', {
      search_query: searchQuery,
    });

    let results: Omit<Database['public']['Functions']['search_drugs']['Returns'][number], 'brand_id' | 'generic_id' | 'relevance'>[] = [];

    if (!rpcError && rpcData && rpcData.length > 0) {
      results = rpcData.slice(0, 3);
    } else {
      // Fallback: run ILIKE queries for each term across brands and generics
      const brandSelect = `
        id, name, form, strength, price, pack_size,
        manufacturers ( name ),
        generics (
          id, name, indication, side_effect,
          precaution, adult_dose, child_dose, pregnancy_category_id
        )
      `;

      // Search brands by name and generics by name + indication in parallel
      const queries = terms.map(term => {
        const ilike = `%${term}%`;
        return Promise.all([
          supabase.from('brands').select(brandSelect).ilike('name', ilike).limit(3),
          supabase.from('generics').select('id').ilike('name', ilike).limit(5),
          supabase.from('generics').select('id').ilike('indication', ilike).limit(5),
        ]);
      });

      const queryResults = await Promise.all(queries);

      // Collect direct brand hits
      const seen = new Set<number>();
      const brandResults: HealthcareBrand[] = [];

      for (const [brandResult] of queryResults) {
        const brandData = brandResult.data ?? [];
        for (const b of brandData) {
          if (!seen.has(b.id)) {
            seen.add(b.id);
            brandResults.push(b);
          }
        }
      }

      // Collect generic IDs and fetch their brands
      const genericIds = new Set<number>();
      for (const [, names, indications] of queryResults) {
        for (const g of (names.data ?? [])) genericIds.add(g.id);
        for (const g of (indications.data ?? [])) genericIds.add(g.id);
      }

      if (genericIds.size > 0) {
        const { data: genericBrands } = await supabase
          .from('brands')
          .select(brandSelect)
          .in('generic_id', [...genericIds])
          .limit(10);

        for (const b of (genericBrands ?? [])) {
          if (!seen.has(b.id)) {
            seen.add(b.id);
            brandResults.push(b);
          }
        }
      }

      // Shape the results into the same format as the RPC
      results = brandResults.slice(0, 3).map((b) => ({
        brand_name: b.name,
        generic_name: b.generics?.name ?? '',
        form: b.form ?? '',
        strength: b.strength ?? '',
        price: b.price ?? '',
        pack_size: b.pack_size ?? '',
        manufacturer: b.manufacturers?.name ?? '',
        indication: b.generics?.indication ?? '',
        side_effect: b.generics?.side_effect ?? '',
        precaution: b.generics?.precaution ?? '',
        adult_dose: b.generics?.adult_dose ?? '',
        child_dose: b.generics?.child_dose ?? '',
        pregnancy_cat: b.generics?.pregnancy_category_id ?? '',
      }));
    }

    if (results.length === 0) return '';

    // Format results as XML context block for the system prompt
    const entries = results.map((r, i) => {
      const fields = [
        `Brand: ${r.brand_name}`,
        `Generic: ${r.generic_name}`,
        r.form ? `Form: ${r.form}` : null,
        r.strength ? `Strength: ${r.strength}` : null,
        r.price ? `Price: ৳${r.price}` : null,
        r.pack_size ? `Pack Size: ${r.pack_size}` : null,
        r.manufacturer ? `Manufacturer: ${r.manufacturer}` : null,
        r.indication ? `Indication: ${r.indication}` : null,
        r.adult_dose ? `Adult Dose: ${r.adult_dose}` : null,
        r.child_dose ? `Child Dose: ${r.child_dose}` : null,
        r.precaution ? `Precaution: ${r.precaution}` : null,
        r.side_effect ? `Side Effects: ${r.side_effect}` : null,
        r.pregnancy_cat ? `Pregnancy Category: ${r.pregnancy_cat}` : null,
      ].filter(Boolean).join('\n  ');
      return `<drug_entry_${i + 1}>\n  ${fields}\n</drug_entry_${i + 1}>`;
    }).join('\n\n');

    return `\n\n<database_context>\nThe following drug information was retrieved from our verified database based on the user's query. Use this data to provide accurate, specific answers. Always cite brand names, dosages, and other details from this context when relevant.\n\n${entries}\n</database_context>`;
  } catch (err) {
    console.error('[Healthcare RAG] Error fetching context:', err);
    return '';
  }
}


// Tool definitions, selection and execution live in api/_lib/tools.ts.


// Helper function to process memory tags from AI response
// Returns { content: string (without memory tags), memoryContent: string | null, hasSavedMemory: boolean }
export async function processMemoryTags(
  content: string,
  userId: string | null,
  persona: string,
  client: SupabaseClient = supabase,
): Promise<{ content: string; memoryContent: string | null; hasSavedMemory: boolean }> {
  const memoryRegex = /<memory>([\s\S]*?)<\/memory>/gi;
  const matches = content.match(memoryRegex);

  if (!matches || matches.length === 0) {
    return { content, memoryContent: null, hasSavedMemory: false };
  }

  let hasSavedMemory = false;
  let memoryContent: string | null = null;

  // Extract and save each memory
  for (const match of matches) {
    const innerContent = match.replace(/<\/?memory>/gi, '').trim();
    if (innerContent && userId) {
      memoryContent = innerContent;
      const newMemory = await addUserMemory(userId, innerContent, 'general', 5, persona, client);
      if (newMemory) {
        hasSavedMemory = true;
      }
    }
  }

  // Remove memory tags from content
  const cleanedContent = content.replace(memoryRegex, '').trim();

  return { content: cleanedContent, memoryContent, hasSavedMemory };
}



// Pollinations API configuration
const POLLINATIONS_API_KEY = (process.env.POLLINATIONS_API_KEY || '').trim();
const POLLINATIONS_API_URL = 'https://gen.pollinations.ai/v1/chat/completions';

// Secrets to AI (FreeTheAI) API configuration
const SECRETSTOAI_API_KEY = (process.env.SECRETSTOAI_API_KEY || process.env.SECRETS_TO_AI_API_KEY || '').trim();
const SECRETSTOAI_API_URL = 'https://api.freetheai.xyz/v1/chat/completions';

// Eaon API configuration
const EAON_API_KEY = (process.env.EAON_API_KEY || '').trim();
const EAON_API_URL = 'https://ai.eaon.dev/v1/chat/completions';

// Nvidia API configuration
const NVIDIA_API_KEY = (process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY || '').trim();
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// AMD Radeon Cloud configuration
const AMD_API_URL = 'https://developer.amd.com.cn/radeon/api/v1/chat/completions';

// LLM7 configuration
const LLM7_API_URL = 'https://api.llm7.io/v1/chat/completions';


// Memory tool params (MemoryParams kept for reference)
// interface MemoryParams { content: string; }

interface AIMemory {
  id: string;
  user_id: string;
  persona: string;
  memory_type: string;
  content: string;
  importance: number;
  last_accessed: string;
  access_count: number;
  created_at: string;
}

/**
 * Read a user's stored memories.
 *
 * `client` should be a request-scoped client carrying the caller's JWT so RLS
 * applies. It falls back to the service-role client only for callers with no
 * request context (the Trigger.dev PRO task) — never for a client-supplied id.
 */
export async function fetchUserMemories(
  userId: string,
  persona: string = 'default',
  client: SupabaseClient = supabase,
): Promise<AIMemory[]> {
  try {
    const { data, error } = await client
      .from('ai_memories')
      .select('*')
      .eq('user_id', userId)
      .or(`persona.eq.${persona},persona.eq.default`)
      .order('importance', { ascending: false })
      .order('last_accessed', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching memories:', error);
      return [];
    }

    return (data || []) as AIMemory[];
  } catch (error) {
    console.error('Exception fetching memories:', error);
    return [];
  }
}

export async function addUserMemory(
  userId: string,
  content: string,
  memoryType: string = 'general',
  importance: number = 5,
  persona: string = 'default',
  client: SupabaseClient = supabase,
): Promise<AIMemory | null> {
  try {
    const { data, error } = await client
      .from('ai_memories')
      .insert({
        user_id: userId,
        persona,
        memory_type: memoryType,
        content,
        importance: Math.min(10, Math.max(1, importance))
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding memory:', error);
      return null;
    }

    return data as AIMemory;
  } catch (error) {
    console.error('Exception adding memory:', error);
    return null;
  }
}

export function formatMemoriesForContext(memories: AIMemory[], userProfile?: { nickname?: string; about_me?: string }): string {
  if (memories.length === 0 && !userProfile?.nickname && !userProfile?.about_me) {
    return '';
  }

  let context = '\n\n[USER CONTEXT - Remember this about the user]\n';

  // Add user profile info first (from their account settings)
  if (userProfile?.nickname) {
    context += `- User's name: ${userProfile.nickname}\n`;
  }

  if (userProfile?.about_me) {
    context += `- About user: ${userProfile.about_me}\n`;
  }

  // Group memories by type
  const grouped = memories.reduce((acc, mem) => {
    if (!acc[mem.memory_type]) acc[mem.memory_type] = [];
    acc[mem.memory_type].push(mem);
    return acc;
  }, {} as Record<string, AIMemory[]>);

  // Add preferences
  if (grouped.preference?.length) {
    context += '\nUser preferences:\n';
    grouped.preference.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  // Add facts
  if (grouped.fact?.length) {
    context += '\nThings to remember about this user:\n';
    grouped.fact.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  // Add instructions
  if (grouped.instruction?.length) {
    context += '\nUser instructions:\n';
    grouped.instruction.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  // Add general memories
  if (grouped.general?.length) {
    context += '\nOther notes:\n';
    grouped.general.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  context += '[END USER CONTEXT]\n';

  return context;
}

// Rate limiting lives in api/_lib/rateLimit.ts; re-exported so pro-generation,
// the Trigger task and the tests keep importing it from here.
export {
  ANONYMOUS_PERSONA_LIMITS,
  getAnonymousLimit,
  resolveAnonymousDeviceId,
  getRemainingQuota,
  checkRateLimit,
  incrementRateLimit,
  type RateLimitOutcome,
} from './_lib/rateLimit.js';
import {
  getAnonymousLimit,
  resolveAnonymousDeviceId,
  getRemainingQuota,
  checkRateLimit,
  incrementRateLimit,
} from './_lib/rateLimit.js';

/**
 * Transcribe images to text, for hops whose model cannot see (api/_lib/vision.ts).
 *
 * This is the fallback path now, not the default one. A model that takes image
 * parts gets the image itself; this only runs when the hop actually serving
 * the turn is text-only.
 */
export async function extractImageContent(imageUrls: string[]): Promise<string> {
  const imageContents = imageUrls.map((url: string) => ({
    type: 'image_url',
    image_url: { url }
  }));

  const response = await providerFetch(POLLINATIONS_API_URL, {
    providerLabel: 'pollinations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${POLLINATIONS_API_KEY}`,
    },
    body: JSON.stringify({
      model: OCR_MODEL.model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an image content extraction system. Your job is to extract ALL content from this image and output it as plain text.

Rules:
- Extract EVERY piece of text visible in the image, character by character, word by word
- Maintain the original structure and formatting as closely as possible
- If there are mathematical equations, write them out in LaTeX notation
- If there are tables, preserve the table structure using text formatting
- If there are diagrams or figures, describe them in detail
- If there are code snippets, preserve the exact code
- Do NOT skip anything - every single piece of content must be captured
- Do NOT add any commentary, analysis, or answers
- Do NOT summarize - give the COMPLETE content
- If the image contains a question paper or exam, extract every question exactly as written
- For handwritten content, do your best to accurately read and transcribe it
- If the image is not text-based (e.g. a photo, artwork, screenshot), describe everything visible in thorough detail

Output ONLY the extracted content, nothing else.`
          },
          ...imageContents
        ]
      }],
      temperature: OCR_MODEL.temperature,
      max_tokens: OCR_MODEL.maxTokens,
      stream: false
    })
  });

  if (!response.ok) {

    console.error('Image extraction error:', response.status);
    throw new Error(`Image extraction failed: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || 'Could not extract content from image.';
}

// Streaming function for Air persona - CEREBRAS API
export async function callCerebrasAirAPIStreaming(
  messages: ProviderMessage[],
  tools?: ProviderTool[],
  model: string = 'qwen-3-235b-a22b-instruct-2507',
  temperature: number = 0.9,
  maxTokens: number = 2000,
): Promise<ReadableStream> {
  const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

  if (!CEREBRAS_API_KEY) {
    throw new Error('CEREBRAS_API_KEY not configured');
  }

  const requestBody: ProviderRequest = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    top_p: 1,
    stream: true
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";

  }

  console.log('Cerebras API Request:', JSON.stringify({
    model: requestBody.model,
    messageCount: messages.length,
    hasTools: !!tools,
    toolCount: tools?.length || 0
  }));

  const response = await providerFetch('https://api.cerebras.ai/v1/chat/completions', {
    providerLabel: 'cerebras',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Cerebras API Error (Air):', response.status);
    throw new Error(`Cerebras API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body from Cerebras API');
  }

  return new ReadableStream({
    start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function pump(): Promise<void> {
        return reader.read().then(({ done, value }) => {
          if (done) {
            if (buffer.trim()) {
              processBuffer(buffer, controller);
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processBuffer(line, controller);
          }

          return pump();
        }).catch(error => {
          console.error('Stream reading error:', error);
          controller.error(error);
        });
      }

      return pump();
    }
  });
}

// Streaming function for Girlie and Pro personas - GROQ API
export async function callGroqStandardAPIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  tools?: ProviderTool[],
  reasoningEffort?: string
): Promise<ReadableStream> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const requestBody: ProviderRequest = {
    messages,
    model,
    temperature,
    max_tokens: maxTokens,
    stream: true
  };

  if (reasoningEffort) {
    // Add reasoning_effort for models that support it
    requestBody.reasoning_effort = reasoningEffort;
  }

  if (tools) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const response = await providerFetch('https://api.groq.com/openai/v1/chat/completions', {
    providerLabel: 'groq',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Groq API Error (Standard):', response.status);
    throw new Error(`Groq API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body from Groq API');
  }

  return new ReadableStream({
    start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function pump(): Promise<void> {
        return reader.read().then(({ done, value }) => {
          if (done) {
            if (buffer.trim()) {
              processBuffer(buffer, controller);
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processBuffer(line, controller);
          }

          return pump();
        }).catch(error => {
          console.error('Stream reading error:', error);
          controller.error(error);
        });
      }

      return pump();
    }
  });
}


// Helper function to process streaming buffer
function processBuffer(line: string, controller: ReadableStreamDefaultController) {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine === 'data: [DONE]') {
    return;
  }

  if (trimmedLine.startsWith('data: ')) {
    try {
      const jsonStr = trimmedLine.slice(6); // Remove 'data: ' prefix
      const data = JSON.parse(jsonStr);

      if (data.choices && data.choices[0]) {
        const choice = data.choices[0];

        // Handle content delta
        if (choice.delta && choice.delta.content) {
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({
              type: 'content',
              content: choice.delta.content
            }) + '\n'
          ));
        }

        // Handle tool calls
        if (choice.delta && choice.delta.tool_calls) {
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({
              type: 'tool_calls',
              tool_calls: choice.delta.tool_calls
            }) + '\n'
          ));
        }

        // Handle finish reason
        if (choice.finish_reason) {
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({
              type: 'finish',
              reason: choice.finish_reason
            }) + '\n'
          ));
        }
      }
    } catch (error) {
      void error;
      console.error('provider_stream_parse_failed');
    }
  }
}

function extractReasoningAndContent(response: string): { content: string; thinking?: string } {
  const reasonMatch = response.match(/<(reason|think)>([\s\S]*?)<\/\1>/);
  const thinking = reasonMatch ? reasonMatch[2].trim() : undefined;
  const content = response.replace(/<(reason|think)>[\s\S]*?<\/\1>/g, '').trim();

  return { content, thinking };
}

// Secrets to AI (FreeTheAI) API function (streaming)
export async function callSecretsToAIAPIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ReadableStream> {
  if (!SECRETSTOAI_API_KEY) {
    throw new Error('SECRETSTOAI_API_KEY is not configured for Secrets to AI requests');
  }

  // Filter out empty system messages
  const cleanedMessages = messages.filter(msg =>
    // A system message is always plain text; the parts form only ever appears
    // on the user turn a native-vision run attached images to, and that one is
    // never empty.
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model: model,
    messages: cleanedMessages,
    temperature,
    stream: true,
    // --- Bulletproof Thinking/Reasoning Deactivation ---
    thinking_budget: 0,          // Maps to Gemini / Open-source routers
    reasoning_effort: "none",    // Maps to OpenAI-style routers
    thinking: null               // Maps to Anthropic-style routers
  };

  if (maxTokens) {
    requestBody.max_tokens = maxTokens;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  // Shape, never content. Every provider adapter logs a count here, not the
  // messages themselves: these run in production logs, and since the device
  // tools landed the message array carries the user's own notes and past
  // conversations. See the security rules in CLAUDE.md.
  console.log('Secrets to AI API Request:', {
    model,
    messageCount: cleanedMessages.length,
    url: SECRETSTOAI_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(SECRETSTOAI_API_URL, {
    providerLabel: 'secretstoai',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRETSTOAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Secrets to AI API error:', response.status, response.status);
    throw new Error(`Secrets to AI API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body from Secrets to AI API');
  }

  // Transform the response stream to match our format
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.choices && data.choices[0]) {
                  const choice = data.choices[0];
                  if (choice.delta && choice.delta.content) {
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({
                        type: 'content',
                        content: choice.delta.content
                      }) + '\n'
                    ));
                  }

                  // Handle tool calls
                  if (choice.delta && choice.delta.tool_calls) {
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({
                        type: 'tool_calls',
                        tool_calls: choice.delta.tool_calls
                      }) + '\n'
                    ));
                  }

                  if (choice.finish_reason) {
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({ type: 'finish', reason: choice.finish_reason }) + '\n'
                    ));
                  }
                }
              } catch (error) {
                void error;
                console.error('provider_stream_parse_failed');
              }
            }
          }
        }

        controller.enqueue(new TextEncoder().encode(
          JSON.stringify({ type: 'finish' }) + '\n'
        ));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

// Nvidia API function (streaming)
export async function callNvidiaAPIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[],
  reasoningEffort?: string
): Promise<ReadableStream> {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY / NIM_API_KEY is not configured for Nvidia requests');
  }

  // Filter out empty system messages
  const cleanedMessages = messages.filter(msg =>
    // A system message is always plain text; the parts form only ever appears
    // on the user turn a native-vision run attached images to, and that one is
    // never empty.
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model: model,
    messages: cleanedMessages,
    temperature,
    stream: true
  };

  if (maxTokens) {
    requestBody.max_tokens = maxTokens;
  }

  // Only when a persona asked for it. Verified on nemotron-3.5-lightning:
  // 'none' turns its thinking off (4 completion tokens for "17*23" instead of
  // a paragraph of reasoning). Not sent otherwise, because PRO's kimi-k3 has
  // never been tested with it and an unknown field is a 400 on some gateways.
  if (reasoningEffort) {
    requestBody.reasoning_effort = reasoningEffort;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  console.log('Nvidia API Request:', {
    model,
    messageCount: cleanedMessages.length,
    url: NVIDIA_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(NVIDIA_API_URL, {
    providerLabel: 'nvidia',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Nvidia API error:', response.status, response.status);
    throw new Error(`Nvidia API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body from Nvidia API');
  }

  // Transform the response stream to match our format
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // Shape of the answer, for the log: counts and the finish reason, never
      // content. A reasoning model can spend its whole budget thinking and
      // hand back nothing, and without this the log shows a request that
      // succeeded and a user who saw "the model came back with nothing".
      const seen = { content: 0, reasoning: 0, toolCalls: 0, finish: '' };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.choices && data.choices[0]) {
                  const choice = data.choices[0];
                  if (choice.delta?.reasoning_content) seen.reasoning++;
                  if (choice.delta && choice.delta.content) {
                    seen.content++;
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({
                        type: 'content',
                        content: choice.delta.content
                      }) + '\n'
                    ));
                  }

                  // Handle tool calls
                  if (choice.delta && choice.delta.tool_calls) {
                    seen.toolCalls++;
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({
                        type: 'tool_calls',
                        tool_calls: choice.delta.tool_calls
                      }) + '\n'
                    ));
                  }

                  if (choice.finish_reason) {
                    seen.finish = String(choice.finish_reason);
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({ type: 'finish', reason: choice.finish_reason }) + '\n'
                    ));
                  }
                }
              } catch (error) {
                void error;
                console.error('provider_stream_parse_failed');
              }
            }
          }
        }

        if (seen.content === 0 && seen.toolCalls === 0) {
          console.warn(`[nvidia] empty answer: ${seen.reasoning} reasoning chunks, finish=${seen.finish || 'none'}`);
        }
        controller.enqueue(new TextEncoder().encode(
          JSON.stringify({ type: 'finish' }) + '\n'
        ));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

/**
 * Eaon's model routes do not all accept the same optional reasoning fields.
 * MiniMax M3 accepts the plain OpenAI-compatible body (including tools), but
 * returns 502 when the generic reasoning-disable controls are added. Keep the
 * exception here so streaming and non-streaming requests cannot drift.
 */
export function buildEaonRequestBody(
  messages: ProviderMessage[],
  model: string,
  temperature: number,
  stream: boolean,
  maxTokens?: number,
  tools?: ProviderTool[],
): ProviderRequest {
  const cleanedMessages = messages.filter(msg =>
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model,
    messages: cleanedMessages,
    temperature,
    stream,
  };

  if (!/^eaon\/minimax-/i.test(model)) {
    requestBody.thinking_budget = 0;
    requestBody.reasoning_effort = 'none';
    requestBody.thinking = null;
  }

  if (maxTokens) requestBody.max_tokens = maxTokens;

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  return requestBody;
}

// Eaon API function (streaming)
export async function callEaonAPIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ReadableStream> {
  if (!EAON_API_KEY) {
    throw new Error('EAON_API_KEY is not configured for Eaon requests');
  }

  const requestBody = buildEaonRequestBody(messages, model, temperature, true, maxTokens, tools);

  console.log('Eaon API Request:', {
    model,
    messageCount: requestBody.messages.length,
    url: EAON_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(EAON_API_URL, {
    providerLabel: 'eaon',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EAON_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Eaon API error:', response.status, response.status);
    throw new Error(`Eaon API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body from Eaon API');
  }

  // Transform the response stream to match our format
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.choices && data.choices[0]) {
                  const choice = data.choices[0];
                  if (choice.delta && choice.delta.content) {
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({
                        type: 'content',
                        content: choice.delta.content
                      }) + '\n'
                    ));
                  }

                  // Handle tool calls
                  if (choice.delta && choice.delta.tool_calls) {
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({
                        type: 'tool_calls',
                        tool_calls: choice.delta.tool_calls
                      }) + '\n'
                    ));
                  }

                  if (choice.finish_reason) {
                    controller.enqueue(new TextEncoder().encode(
                      JSON.stringify({ type: 'finish', reason: choice.finish_reason }) + '\n'
                    ));
                  }
                }
              } catch (error) {
                void error;
                console.error('provider_stream_parse_failed');
              }
            }
          }
        }

        controller.enqueue(new TextEncoder().encode(
          JSON.stringify({ type: 'finish' }) + '\n'
        ));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

// ─── Generic OpenAI-compatible adapter ──────────────────────────────────────
//
// Every provider above is the same request with a different key, URL and
// label, and each one carries its own near-identical copy of the SSE parser.
// production-check.md 3.5 tracks collapsing them; this is that adapter, added
// with AMD rather than as a big-bang rewrite of six working call sites.
//
// New providers should use it. The existing six migrate onto it one at a
// time, under their own tests — a fallback chain is not a good place to find
// out that two parsers disagreed about a corner of the wire format.

interface OpenAiCompatibleProvider {
  /** Label used for circuit-breaker state, latency stats and error messages. */
  label: string;
  url: string;
  apiKey: string;
  /** Names the environment variable in the "not configured" error. */
  keyName: string;
  /**
   * Which reasoning-suppression fields this gateway tolerates.
   *
   * The three below are sent to every existing provider on the theory that an
   * unknown field is ignored. That is not universally true: LLM7 validates the
   * request body strictly and answers `thinking_budget` with a 400, so every
   * call would fail. Verified by sending each field on its own —
   * `reasoning_effort` and `thinking` are accepted there, `thinking_budget` is
   * not. Default keeps the historical behaviour for AMD and anything added
   * after it.
   */
  suppressReasoning?: {
    thinkingBudget?: boolean;
    reasoningEffort?: boolean;
    thinking?: boolean;
  };
}

function openAiCompatibleBody(
  provider: OpenAiCompatibleProvider,
  messages: ProviderMessage[],
  model: string,
  temperature: number,
  maxTokens: number | undefined,
  tools: ProviderTool[] | undefined,
  stream: boolean,
): { body: ProviderRequest; messageCount: number } {
  // A system message is always plain text; the parts form only ever appears on
  // the user turn a native-vision run attached images to, and that one is
  // never empty.
  const cleanedMessages = messages.filter(msg =>
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const suppress = provider.suppressReasoning ?? {};
  const body: ProviderRequest = {
    model,
    messages: cleanedMessages,
    temperature,
    stream,
  };
  // --- Thinking/Reasoning Deactivation, per what the gateway accepts ---
  if (suppress.thinkingBudget !== false) body.thinking_budget = 0;   // Gemini / open-source routers
  if (suppress.reasoningEffort !== false) body.reasoning_effort = "none"; // OpenAI-style routers
  if (suppress.thinking !== false) body.thinking = null;             // Anthropic-style routers
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  return { body, messageCount: cleanedMessages.length };
}

/**
 * Turn an OpenAI-style SSE response into this codebase's newline-delimited
 * `{ type: 'content' | 'tool_calls' | 'finish' }` frames.
 *
 * Two things the existing copies handle only by accident and this one on
 * purpose. SSE carries comment lines (`: ping`) and `id:` lines alongside
 * `data:` — AMD sends both — and they are skipped because only `data: ` is
 * read. And `reasoning_content`, which DeepSeek-family models emit next to
 * `content`, is deliberately dropped: it is the model's scratchpad, not the
 * answer, and this codebase already has its own `<reason>` mechanism.
 */
function openAiCompatibleStream(response: Response, label: string): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const emit = (frame: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      let buffer = '';

      try {
        for (; ;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));
              const choice = data.choices?.[0];
              if (!choice) continue;

              if (choice.delta?.content) emit({ type: 'content', content: choice.delta.content });
              if (choice.delta?.tool_calls) emit({ type: 'tool_calls', tool_calls: choice.delta.tool_calls });
              if (choice.finish_reason) emit({ type: 'finish', reason: choice.finish_reason });
            } catch (error) {
              void error;
              console.error(`provider_stream_parse_failed:${label}`);
            }
          }
        }

        emit({ type: 'finish' });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

export async function callOpenAiCompatibleStreaming(
  provider: OpenAiCompatibleProvider,
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ReadableStream> {
  if (!provider.apiKey) {
    throw new Error(`${provider.keyName} is not configured for ${provider.label} requests`);
  }

  const { body, messageCount } = openAiCompatibleBody(provider, messages, model, temperature, maxTokens, tools, true);

  // messageCount, never the messages themselves — CLAUDE.md's security rules
  // forbid logging prompt content, and tool results now carry note text and
  // fetched pages through here.
  console.log(`${provider.label} API Request:`, {
    model,
    messageCount,
    url: provider.url,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(provider.url, {
    providerLabel: provider.label,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body)
  });

  if (!response.body) throw new Error(`No response body from ${provider.label} API`);
  return openAiCompatibleStream(response, provider.label);
}

export async function callOpenAiCompatible(
  provider: OpenAiCompatibleProvider,
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  if (!provider.apiKey) {
    throw new Error(`${provider.keyName} is not configured for ${provider.label} requests`);
  }

  const { body, messageCount } = openAiCompatibleBody(provider, messages, model, temperature, maxTokens, tools, false);

  console.log(`${provider.label} API Request (non-streaming):`, {
    model,
    messageCount,
    url: provider.url,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(provider.url, {
    providerLabel: provider.label,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body)
  });

  return await response.json();
}

// ─── AMD Radeon Cloud ───────────────────────────────────────────────────────
// OpenAI-compatible, streams tool_calls deltas in the standard shape, and
// sends SSE `: ping` comment and `id:` lines that the adapter skips.

export const AMD_PROVIDER: OpenAiCompatibleProvider = {
  label: 'amd',
  url: AMD_API_URL,
  // Read at call time, not at module load. The other providers capture their
  // key in a module-scope const, which makes them untestable without the real
  // key in the environment and makes a key added after cold start invisible.
  get apiKey() { return (process.env.AMD_API_KEY || '').trim(); },
  keyName: 'AMD_API_KEY',
};

export function callAmdAPIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ReadableStream> {
  return callOpenAiCompatibleStreaming(AMD_PROVIDER, messages, model, temperature, maxTokens, tools);
}

export function callAmdAPI(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  return callOpenAiCompatible(AMD_PROVIDER, messages, model, temperature, maxTokens, tools);
}

// ─── LLM7 ───────────────────────────────────────────────────────────────────
// An OpenAI-compatible gateway in front of many upstream models, rather than a
// single model behind an endpoint. Tool calling was verified against it and
// comes back in the standard shape.
//
// **None of the three reasoning-suppression fields may be sent.** LLM7
// forwards the request body to whichever upstream serves the model, and the
// upstreams disagree about what they accept: `thinking_budget` is rejected
// outright, and `reasoning_effort` is accepted by minimax-m2.7's upstream but
// answered with a 400 by the one behind `default`. Since the model is chosen
// per hop, any of them can break a call. All three are off here — a 400 fails
// the turn, while a model that reasons out loud is only verbose.
//
// It also streams the whole answer as one chunk rather than token by token.
// The adapter handles that; it just means a turn served by LLM7 appears all at
// once instead of typing out.

export const LLM7_PROVIDER: OpenAiCompatibleProvider = {
  label: 'llm7',
  url: LLM7_API_URL,
  get apiKey() { return (process.env.LLM7_API_KEY || '').trim(); },
  keyName: 'LLM7_API_KEY',
  suppressReasoning: { thinkingBudget: false, reasoningEffort: false, thinking: false },
};

export function callLlm7APIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ReadableStream> {
  return callOpenAiCompatibleStreaming(LLM7_PROVIDER, messages, model, temperature, maxTokens, tools);
}

export function callLlm7API(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  return callOpenAiCompatible(LLM7_PROVIDER, messages, model, temperature, maxTokens, tools);
}

// Pollinations API function for external AI models (streaming)
export async function callPollinationsAPIStreaming(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ReadableStream> {
  if (!POLLINATIONS_API_KEY) {
    throw new Error('POLLINATIONS_API_KEY is not configured for Pollinations requests');
  }

  // Filter out empty system messages
  const cleanedMessages = messages.filter(msg =>
    // A system message is always plain text; the parts form only ever appears
    // on the user turn a native-vision run attached images to, and that one is
    // never empty.
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model: model,
    messages: cleanedMessages,
    temperature,
    stream: true,

    // --- Bulletproof Thinking/Reasoning Deactivation ---
    thinking_budget: 0,          // Maps to Gemini / Open-source routers
    reasoning_effort: "none",    // Maps to OpenAI-style routers
    thinking: null               // Maps to Anthropic-style routers
  };

  if (maxTokens) {
    requestBody.max_tokens = maxTokens;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  console.log('Pollinations API Request:', {
    model,
    messageCount: cleanedMessages.length,
    url: POLLINATIONS_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const post = (body: ProviderRequest) => providerFetch(POLLINATIONS_API_URL, {
    providerLabel: 'pollinations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  let response: Response;
  try {
    response = await post(requestBody);
  } catch (error) {
    // Pollinations is a gateway in front of many upstreams, and the three
    // reasoning switches above are three different vendors' spellings — any
    // upstream that validates its body strictly can answer one of them with
    // a 400 (LLM7 did exactly that with `thinking_budget`). This is the last
    // hop in Air's and Girlie's chains, so a refused switch must not be the
    // reason a turn fails: send the request once more with none of them.
    // The stream below never forwards a reasoning delta, and the client
    // strips <think> from text, so a model that thinks anyway is verbose,
    // not broken.
    if (!(error instanceof ProviderHttpError) || error.status !== 400) throw error;
    console.warn('[pollinations] 400 with reasoning switches; retrying without them');
    const { thinking_budget: _tb, reasoning_effort: _re, thinking: _th, ...plain } = requestBody;
    void _tb; void _re; void _th;
    response = await post(plain as ProviderRequest);
  }

  if (!response.body) {
    throw new Error('No response body from Pollinations API');
  }

  // Transform the response stream to match our format
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);

                // Only `content` and `tool_calls` are forwarded. A
                // `reasoning_content` delta — what a thinking model emits
                // when the switches above did not take — is dropped here on
                // purpose, so it never reaches the user as text.
                if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                  controller.enqueue(new TextEncoder().encode(
                    JSON.stringify({
                      type: 'content',
                      content: data.choices[0].delta.content
                    }) + '\n'
                  ));
                }

                // Handle tool calls
                if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.tool_calls) {
                  controller.enqueue(new TextEncoder().encode(
                    JSON.stringify({
                      type: 'tool_calls',
                      tool_calls: data.choices[0].delta.tool_calls
                    }) + '\n'
                  ));
                }

                if (data.choices && data.choices[0] && data.choices[0].finish_reason) {
                  controller.enqueue(new TextEncoder().encode(
                    JSON.stringify({ type: 'finish', reason: data.choices[0].finish_reason }) + '\n'
                  ));
                }
              } catch (error) {
                void error;
                console.error('provider_stream_parse_failed');
              }
            }
          }
        }

        controller.enqueue(new TextEncoder().encode(
          JSON.stringify({ type: 'finish' }) + '\n'
        ));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

// Secrets to AI (FreeTheAI) API function (non-streaming)
async function callSecretsToAIAPI(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  if (!SECRETSTOAI_API_KEY) {
    throw new Error('SECRETSTOAI_API_KEY is not configured for Secrets to AI requests');
  }

  // Filter out empty system messages
  const cleanedMessages = messages.filter(msg =>
    // A system message is always plain text; the parts form only ever appears
    // on the user turn a native-vision run attached images to, and that one is
    // never empty.
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model: model,
    messages: cleanedMessages,
    temperature,
    stream: false,
    // --- Bulletproof Thinking/Reasoning Deactivation ---
    thinking_budget: 0,          // Maps to Gemini / Open-source routers
    reasoning_effort: "none",    // Maps to OpenAI-style routers
    thinking: null               // Maps to Anthropic-style routers
  };

  if (maxTokens) {
    requestBody.max_tokens = maxTokens;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  console.log('Secrets to AI API Request (non-streaming):', {
    model,
    messageCount: cleanedMessages.length,
    url: SECRETSTOAI_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(SECRETSTOAI_API_URL, {
    providerLabel: 'secretstoai',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRETSTOAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Secrets to AI API error:', response.status, response.status);
    throw new Error(`Secrets to AI API error: ${response.status}`);
  }

  return await response.json();
}

// Nvidia API function (non-streaming)
async function callNvidiaAPI(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY / NIM_API_KEY is not configured for Nvidia requests');
  }

  // Filter out empty system messages
  const cleanedMessages = messages.filter(msg =>
    // A system message is always plain text; the parts form only ever appears
    // on the user turn a native-vision run attached images to, and that one is
    // never empty.
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model: model,
    messages: cleanedMessages,
    temperature,
    stream: false
  };

  if (maxTokens) {
    requestBody.max_tokens = maxTokens;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  console.log('Nvidia API Request (non-streaming):', {
    model,
    messageCount: cleanedMessages.length,
    url: NVIDIA_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(NVIDIA_API_URL, {
    providerLabel: 'nvidia',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Nvidia API error:', response.status, response.status);
    throw new Error(`Nvidia API error: ${response.status}`);
  }

  return await response.json();
}

// Eaon API function (non-streaming)
async function callEaonAPI(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  if (!EAON_API_KEY) {
    throw new Error('EAON_API_KEY is not configured for Eaon requests');
  }

  const requestBody = buildEaonRequestBody(messages, model, temperature, false, maxTokens, tools);

  console.log('Eaon API Request (non-streaming):', {
    model,
    messageCount: requestBody.messages.length,
    url: EAON_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(EAON_API_URL, {
    providerLabel: 'eaon',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EAON_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Eaon API error:', response.status, response.status);
    throw new Error(`Eaon API error: ${response.status}`);
  }

  return await response.json();
}

// Pollinations API function for external AI models (non-streaming)
async function callPollinationsAPI(
  messages: ProviderMessage[],
  model: string,
  temperature: number = 1,
  maxTokens?: number,
  tools?: ProviderTool[]
): Promise<ProviderResponse> {
  if (!POLLINATIONS_API_KEY) {
    throw new Error('POLLINATIONS_API_KEY is not configured for Pollinations requests');
  }

  // Filter out empty system messages
  const cleanedMessages = messages.filter(msg =>
    // A system message is always plain text; the parts form only ever appears
    // on the user turn a native-vision run attached images to, and that one is
    // never empty.
    msg.role !== 'system' || (typeof msg.content === 'string' ? msg.content.trim() !== '' : !!msg.content)
  );

  const requestBody: ProviderRequest = {
    model: model,
    messages: cleanedMessages,
    temperature,
    stream: false
  };

  if (maxTokens) {
    requestBody.max_tokens = maxTokens;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  console.log('Pollinations API Request (non-streaming):', {
    model,
    messageCount: cleanedMessages.length,
    url: POLLINATIONS_API_URL,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  const response = await providerFetch(POLLINATIONS_API_URL, {
    providerLabel: 'pollinations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {

    console.error('Pollinations API error (non-streaming):', response.status, response.status);
    throw new Error(`Pollinations API error: ${response.status}`);
  }

  return await response.json();
}

// ─── Streaming provider dispatch ────────────────────────────────────────────
// One place that knows how to start a streaming turn on each provider, so the
// agent loop can call the model repeatedly without every persona carrying its
// own six-branch if/else.

const STREAMING_PROVIDERS = new Set([
  'groq', 'pollinations', 'secretstoai', 'secrectstoai',
  'eaon', 'nvidia', 'nim', 'cerebras', 'amd', 'llm7',
]);

/** Map a configured provider name onto a supported one, preserving each persona's historical fallback. */
export function normalizeStreamingProvider(provider: string | undefined, fallback: string): string {
  return provider && STREAMING_PROVIDERS.has(provider) ? provider : fallback;
}

export interface PersonaProviderConfig {
  provider?: string;
  flowState?: { provider?: string };
}

/**
 * The single source of truth for which upstream a run will hit.
 *
 * Both the spend-ceiling check (which happens before generation) and the
 * dispatch itself read from here. They used to derive it separately with
 * different fallbacks, so the ceiling could bill 'nvidia' for a run that
 * actually went to Cerebras.
 */
export function resolveRunProvider(
  persona: string,
  personaConfig: PersonaProviderConfig,
  flowState: boolean,
): string {
  if (persona === 'default') {
    const flowConfig = personaConfig.flowState;
    if (flowState && flowConfig) {
      return normalizeStreamingProvider(flowConfig.provider || 'groq', 'cerebras');
    }
    return normalizeStreamingProvider(personaConfig.provider || 'cerebras', 'cerebras');
  }
  if (persona === 'pro') {
    return normalizeStreamingProvider(personaConfig.provider || 'pollinations', 'pollinations');
  }
  return normalizeStreamingProvider(personaConfig.provider || 'groq', 'groq');
}

/**
 * The ordered list of (provider, model) pairs a run may use: the persona's
 * primary first, then whatever `fallbacks` that persona declares.
 *
 * One provider's bad minute should not be an outage (production-check.md
 * 1.11). The chain is read from the persona config rather than hardcoded here
 * so the whole routing decision lives in one place — AI_PERSONAS at the top of
 * this file — instead of being split across two definitions that can drift.
 *
 * Special modes and Flow State override the model but not the fallbacks, so a
 * hop still runs its own configured model. Duplicate (provider, model) pairs
 * are dropped: retrying the exact same pair after it just failed only adds
 * latency before the error the user actually sees.
 *
 * `primaryCapability` is the vision annotation belonging to whichever config
 * supplied `model` — the persona, a special mode, or Flow State. It is passed
 * in rather than read from the persona because those overrides change the
 * model, and a capability that describes a model the run is not using is worse
 * than none: it would hand image parts to something that cannot take them.
 */
export function buildProviderChain(
  provider: string,
  model: string,
  fallbacks: ProviderHop[] = [],
  primaryCapability: VisionCapability = {},
): ProviderHop[] {
  const chain: ProviderHop[] = [];
  const seen = new Set<string>();

  for (const hop of [{ provider, model, ...primaryCapability }, ...fallbacks]) {
    if (!hop?.provider || !hop?.model) continue;
    // A hop naming a provider with no dispatch branch would fall through to
    // the `default:` case and be sent to Cerebras under someone else's model
    // id — a fallback that fails in a more confusing way than no fallback.
    if (!STREAMING_PROVIDERS.has(hop.provider)) {
      console.warn(`[provider] skipping unknown fallback provider '${hop.provider}'`);
      continue;
    }
    const key = `${hop.provider}:${hop.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The vision annotation travels with the hop: whether the turn's image is
    // sent as an image or as transcribed text is decided per hop, at the
    // moment that hop runs (api/_lib/vision.ts).
    chain.push({
      provider: hop.provider,
      model: hop.model,
      ...(hop.vision ? { vision: hop.vision } : {}),
      ...(hop.imageTransport ? { imageTransport: hop.imageTransport } : {}),
    });
  }

  // The primary may itself have been dropped as unknown; never return nothing.
  return chain.length > 0 ? chain : [{ provider, model }];
}

/**
 * Every provider a run may touch, primary first.
 *
 * The spend ceiling needs this before a model is resolved, so it works in
 * provider names rather than full hops.
 */
export function runProviderNames(provider: string, personaConfig: unknown): string[] {
  const names = [provider, ...personaFallbacks(personaConfig).map(hop => hop.provider)];
  return [...new Set(names.filter(name => STREAMING_PROVIDERS.has(name)))];
}

/** The declared fallbacks for a persona, if it has any. */
export function personaFallbacks(personaConfig: unknown): ProviderHop[] {
  const declared = (personaConfig as { fallbacks?: unknown })?.fallbacks;
  if (!Array.isArray(declared)) return [];
  // Returned as declared, so any `vision` / `imageTransport` written next to a
  // fallback in AI_PERSONAS survives into the chain buildProviderChain builds.
  return declared.filter((hop): hop is ProviderHop =>
    Boolean(hop) && typeof hop.provider === 'string' && typeof hop.model === 'string');
}

interface StreamingModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
}

export async function dispatchStreamingProvider(
  provider: string,
  messages: ProviderMessage[],
  tools: ProviderTool[] | undefined,
  cfg: StreamingModelConfig
): Promise<ReadableStream> {
  const { model, temperature, maxTokens, reasoningEffort } = cfg;

  // Every provider passes through guardStreamStart: a hop has not served the
  // turn until it has produced text or a tool call. Without this, a provider
  // that opened a 200 and sent nothing counted as success and the rest of the
  // chain was never tried — the user saw "the model came back with nothing"
  // while two providers sat idle.
  const open = async (): Promise<ReadableStream> => {
    switch (provider) {
      case 'groq':
        return callGroqStandardAPIStreaming(messages, model, temperature as number, maxTokens as number, tools, reasoningEffort);
      case 'pollinations':
        return callPollinationsAPIStreaming(messages, model, temperature, maxTokens, tools);
      case 'secretstoai':
      case 'secrectstoai':
        return callSecretsToAIAPIStreaming(messages, model, temperature, maxTokens, tools);
      case 'eaon':
        return callEaonAPIStreaming(messages, model, temperature, maxTokens, tools);
      case 'nvidia':
      case 'nim':
        return callNvidiaAPIStreaming(messages, model, temperature, maxTokens, tools, reasoningEffort);
      case 'amd':
        return callAmdAPIStreaming(messages, model, temperature, maxTokens, tools);
      case 'llm7':
        return callLlm7APIStreaming(messages, model, temperature, maxTokens, tools);
      case 'cerebras':
      default:
        return callCerebrasAirAPIStreaming(messages, tools, model, temperature, maxTokens);
    }
  };
  return guardStreamStart(await open(), provider);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // A browser page on a disallowed origin gets nothing. Non-browser clients
  // send no Origin at all and are handled by the auth check below.
  if (!hasAcceptableOrigin(req)) {
    return res.status(403).json(apiErrorBody('FORBIDDEN', 'Origin not allowed'));
  }

  // GET /api/ai-proxy?quota=<persona> — the authoritative remaining count for
  // this caller, so the UI never has to guess (production-check.md 0.4).
  if (req.method === 'GET') {
    const quotaPersona = typeof req.query.quota === 'string' ? req.query.quota : '';
    if (!quotaPersona || !(quotaPersona in AI_PERSONAS)) {
      return res.status(400).json(apiErrorBody('BAD_REQUEST', 'Unknown persona'));
    }

    const quotaUser = await getAuthenticatedRequestUser(req);
    const quotaIpHeader = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
    const quotaIp = Array.isArray(quotaIpHeader) ? quotaIpHeader[0] : quotaIpHeader;
    const quotaDeviceId = quotaUser ? null : resolveAnonymousDeviceId(req, res);

    const quota = await getRemainingQuota(quotaUser?.id ?? null, quotaIp, quotaPersona, quotaDeviceId);
    if (!quota) return res.status(503).json(apiErrorBody('UNAVAILABLE', 'Service temporarily unavailable'));

    return res.status(200).json({ ...quota, anonymous: !quotaUser });
  }

  if (req.method !== 'POST') {
    return res.status(405).json(apiErrorBody('BAD_REQUEST', 'Method not allowed'));
  }

  // POST /api/ai-proxy?task=title — name a chat for the history page. Its
  // own handler and bucket (api/_lib/chatTitle.ts); it rides on this
  // function only because of the twelve-function ceiling.
  if (req.query.task === 'title') {
    if (rejectIfTooLarge(req, res)) return;
    return handleChatTitleRequest(req, res);
  }

  try {
    // Identity comes from the verified JWT, never from the request body.
    // `userId` is deliberately NOT destructured below — see production-check.md
    // 0.1 and 0.2. A client-supplied id let anyone read another user's stored
    // memories through the service-role Supabase client.
    const authedUser = await getAuthenticatedRequestUser(req);
    const userId = authedUser?.id ?? null;

    // User-scoped Supabase client: RLS applies, so even a bug that passed the
    // wrong id here cannot read another user's rows. Falls back to the
    // service-role client only if the anon key is unset.
    const accessToken = getRequestAccessToken(req);
    const userClient = (userId && accessToken && createUserScopedClient(accessToken)) || supabase;

    // Bound every input before doing any work with it (1.8). Oversized and
    // malformed payloads are rejected here, not after a 300-second run.
    if (rejectIfTooLarge(req, res)) return;
    const body = parseOrReject(res, aiProxyBodySchema, req.body);
    if (!body) return;

    const { messages, persona, imageData, maxMode, stream, flowState, inputImageUrls, imageDimensions, userMemories, specialMode, pdfData, pdfFileName, pdfExtractedText, deviceApps, deviceDataPresent, deviceRounds, deviceFiles, toolTranscript, sessionTools } = body;

    // Max Mode (shared/maxMode.ts): PRO as a coding harness. Streaming only,
    // because it is built on the device bridge and the bridge needs a stream
    // to end and resume. A non-streaming request with the field set is served
    // as ordinary PRO rather than refused: the field is a hint about tools,
    // not a different endpoint.
    const maxModeRequest = persona === 'pro' && stream && maxMode ? maxMode : null;

    const personaConfig = AI_PERSONAS[persona as keyof typeof AI_PERSONAS];

    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
    const ip = Array.isArray(clientIP) ? clientIP[0] : clientIP;

    // Anonymous visitors get a small trial, enforced here rather than in
    // localStorage. Personas with a zero anonymous allowance need an account.
    const anonymousDeviceId = userId ? null : resolveAnonymousDeviceId(req, res);
    if (!userId && getAnonymousLimit(persona) <= 0) {
      return res.status(401).json(
        apiErrorBody('AUTH_REQUIRED', 'Sign in to use this persona', { type: 'authRequired' })
      );
    }

    // Which upstream this run will bill. Special modes override the model but
    // never the provider, so the persona config is the only source. Derived by
    // the same function the dispatch uses, so the two cannot drift apart.
    const provider = resolveRunProvider(persona, personaConfig as PersonaProviderConfig, !!flowState);

    // Check rate limit (using Supabase). Fails closed.
    const runProviders = runProviderNames(provider, personaConfig);
    const limitOutcome = await checkRateLimit(userId, ip, persona, { anonymousDeviceId, providers: runProviders });
    if (!limitOutcome.allowed) {
      if (limitOutcome.reason === 'backend_error') {
        return res.status(503).json(
          apiErrorBody('UNAVAILABLE', 'Service temporarily unavailable', { type: 'rateLimitBackend' })
        );
      }
      if (limitOutcome.reason === 'spend_ceiling') {
        return res.status(503).json(
          apiErrorBody('UNAVAILABLE', 'Service temporarily unavailable', { type: 'spendCeiling' })
        );
      }
      return res.status(429).json(
        apiErrorBody('RATE_LIMITED', 'Rate limit exceeded', {
          type: 'rateLimit',
          ...(userId ? {} : { anonymous: true, limit: limitOutcome.limit }),
        })
      );
    }

    // Providers still under their daily ceiling, in chain order. With no
    // ceiling configured this is the whole chain.
    const openProviders = limitOutcome.providers;

    // Resolve special mode per-persona config (if active)
    // Map persona key to the 3 base personas used in special mode configs
    const basePersona = (['default', 'girlie', 'pro'].includes(persona) ? persona : 'default') as 'default' | 'girlie' | 'pro';
    const specialModeConfig = specialMode && (SPECIAL_MODE_CONFIGS as Record<string, Record<'default' | 'girlie' | 'pro', SpecialModeConfig>>)[specialMode]
      ? (SPECIAL_MODE_CONFIGS as Record<string, Record<'default' | 'girlie' | 'pro', SpecialModeConfig>>)[specialMode][basePersona]
      : null;

    // Get the appropriate system prompt
    let systemPrompt: string;
    if (specialModeConfig) {
      systemPrompt = specialModeConfig.systemPrompt;
    } else if (maxModeRequest) {
      // Built below, once the tool list is known — the prompt describes
      // exactly the tools this leg carries.
      systemPrompt = '';
    } else {
      systemPrompt = (personaConfig as ModelConfig).systemPrompt ?? '';
    }

    // Fetch user memories and add to system prompt if user is logged in
    let memoryContext = '';
    if (userId) {
      // Defence in depth: the id already comes from the verified token, but a
      // future refactor that reintroduces a body field must fail loudly here.
      assertOwnUserId(userId, authedUser?.id ?? null);
      const memories = await fetchUserMemories(userId, persona, userClient);
      // userMemories from request contains profile info (nickname, about_me)
      const userProfile = userMemories as { nickname?: string; about_me?: string } | undefined;
      memoryContext = formatMemoriesForContext(memories, userProfile);
    }

    // Memory instructions for logged-in users (XML-based approach)
    // Disabled for music-compose — the AI should only output JSON, not memory tags
    // Nor for Max Mode: a coding turn has no business writing memories, and the
    // harness prompt is long enough without a section it will never use.
    const memoryInstructions = (userId && specialMode !== 'music-compose' && !maxModeRequest) ? `

## Memory
When the user shares important information about themselves that you should remember for future conversations (like preferences, facts about their life, things they like/dislike, etc.), save it by writing the information inside <memory> tags at the END of your message. Only save genuinely important, lasting information - not temporary things.

Example: If user says "My favorite song is Attention by Charlie Puth", you would end your response with:
<memory>User's favorite song is Attention by Charlie Puth</memory>

The memory tags will be processed and removed from the visible response, so write your actual response normally before the tags.` : '';

    // Enhanced system prompt with tool usage instructions, guardrails and memory context
    // music-compose must emit only JSON, so it gets neither memory tags nor
    // the thinking directive.
    const thinkingDirective = specialMode === 'music-compose' || maxModeRequest ? '' : THINKING_DIRECTIVE;

    // Initialize model, system prompt, and tools — apply special mode overrides
    const modelToUse = specialModeConfig?.model || personaConfig.model;
    // The device bridge only exists on the streaming path: it works by ending
    // the response and letting the client start the next leg, which the
    // one-shot JSON path has no way to do.
    const deviceAppsEnabled = stream ? (deviceApps ?? []) : [];
    // Which tools this turn gets is decided by the catalogue — see
    // shared/toolCatalog.ts. The whole decision comes back, not just the list,
    // because find_tools needs to know what was left out.
    // Flight Controls: what this user switched on. Anonymous users get none,
    // and the result is cached per instance — see flightControls.ts. Until
    // this call existed the toggles in the Flight Controls UI reached nothing:
    // a skill a user enabled never entered a prompt.
    const flightControls = await resolveFlightControlsCached(userId);
    const userSkills: UserSkill[] = enabledSkills(flightControls.enabled).map(control => ({
      slug: control.slug,
      name: control.name,
      description: control.description,
      content: control.skill_content || '',
    }));
    // Slugs the catalog owns. A built-in skill the user switched off must not
    // come back through SKILLS_DATA, or the toggle only works one way.
    const governedSkillSlugs = flightControls.governedSkillSlugs;

    // The user's enabled MCP servers, discovered and put on the catalogue.
    // Cached per instance: discovery is a connect plus tools/list per server,
    // and doing that on every message would be the dominant cost of a turn.
    // A server that is down yields no tools and the turn proceeds without it —
    // never a failed message because someone else's host is unreachable.
    // Curated servers the user enabled, plus the ones they added themselves.
    // Both end up in the same shape and are dialled by the same client; the
    // only difference is where the credential came from.
    const mcpServers = enabledMcpServers([
      ...flightControls.enabled,
      ...(stream ? await loadUserMcpServers(userId) : []),
    ]);
    const mcpTools = mcpServers.length > 0 && stream
      ? await discoverMcpToolsCached(mcpServers)
      : [];
    const mcpDescriptors = mcpToolDescriptors(mcpTools);

    // Tools TimeMachine wrote: this conversation's own, then the shared
    // registry. They run in the browser's sandbox, so a client that cannot
    // run Python is not offered them — the descriptors say so and the packer
    // enforces it — and the registry is not even read for one.
    const generatedTools = resolveRequestTools(
      sessionTools,
      deviceAppsEnabled.includes('python') ? await loadPublishedToolsCached() : [],
    );

    const toolSet = maxModeRequest
      // A closed set chosen by the mode. No catalogue, no app tools, no
      // find_tools — see selectMaxModeToolSet.
      ? selectMaxModeToolSet({ request: maxModeRequest, deviceApps: deviceAppsEnabled, deviceRoundsUsed: deviceRounds })
      : selectToolSet({
        specialModeConfig,
        // PRO always has the library. Everyone else gets the skills tools only
        // once they have actually enabled a skill — otherwise two schemas ride
        // on every Air message to reach a library the user never opted into.
        includeSkills: persona === 'pro' || userSkills.length > 0,
        messages,
        hasAttachedImage: !!imageData,
        hasAttachedPdf: !!(pdfData || pdfExtractedText),
        deviceApps: deviceAppsEnabled,
        deviceDataPresent,
        deviceRoundsUsed: deviceRounds,
        surface: persona === 'pro' ? 'pro' : 'air',
        extraDescriptors: [...mcpDescriptors, ...generatedTools.descriptors],
      });
    const toolsToUse: ProviderTool[] = toolSet.tools;
    const offeredToolNames = toolsToUse.map(tool => tool.function.name);
    // The policies below derive their gates from what the request actually
    // carried rather than recomputing them, so a tool the token budget dropped
    // is refused if the model calls it anyway.

    const enhancedSystemPrompt = maxModeRequest
      // The harness prompt carries its own tool policy and reasoning note.
      // The general guardrail's "write the code in a fenced block" is the
      // exact opposite of what this turn is for.
      ? `${buildMaxModePrompt({ request: maxModeRequest, toolNames: offeredToolNames, roundsUsed: deviceRounds })}${memoryContext}`
      : `${systemPrompt}${memoryContext}${memoryInstructions}

${buildToolGuardrail({ canFindTools: toolSet.canFindTools, canRunPython: toolSet.offered.some(descriptor => descriptor.name === 'run_python') })}
${thinkingDirective}`;
    let systemPromptToUse = enhancedSystemPrompt;

    const appToolsOffered = toolsToUse.some(tool => tool.function.name === 'healthcare_search'
      || tool.function.name.startsWith('notes_') || tool.function.name.startsWith('chats_'));
    // The client can run them and simply has none left, as opposed to never
    // having declared it could run them at all. Only the first is worth saying.
    // Read from the budget rather than inferred from the tool list: run_python
    // is gated, so "no device tool was offered" is also true of a turn that
    // simply did not want one, and that turn has spent nothing.
    const deviceRoundsSpent = deviceAppsEnabled.length > 0
      && (deviceRounds ?? 0) >= resolveDeviceRoundBudget();

    // Apply temperature, maxTokens, and reasoningEffort overrides from special mode
    const temperatureToUse = specialModeConfig?.temperature ?? personaConfig.temperature;
    const maxTokensToUse = specialModeConfig?.maxTokens ?? personaConfig.maxTokens;
    const reasoningEffortToUse: string | undefined = specialModeConfig?.reasoningEffort ?? (personaConfig as ModelConfig).reasoningEffort;

    // Healthcare RAG: inject database context into system prompt when in TM Healthcare mode
    // Scans the last few messages (not just the latest) so follow-up questions
    // like "what are the alternatives?" still carry drug-name context forward.
    if (specialMode === 'tm-healthcare') {
      const recentMessages = messages.slice(-6); // last 6 messages (~3 turns)
      const combinedText = recentMessages.map((m) => m.content).join(' ');
      if (combinedText.trim()) {
        const ragContext = await fetchHealthcareRAGContext(combinedText);
        if (ragContext) {
          systemPromptToUse = systemPromptToUse + ragContext;
        }
      }
    }

    // Only when the tools are actually in front of the model — a special mode
    // that opted out of tools must not be told it can reach the user's apps.
    if (appToolsOffered) {
      systemPromptToUse = systemPromptToUse + buildAppToolDirective({ toolNames: toolsToUse.map(tool => tool.function.name), deviceRoundsSpent, deviceApps: deviceAppsEnabled });
    }

    // Only alongside the tool that can open them. Naming files the model has
    // no way to read is the same mistake as promising an app tool it was not
    // given — it contradicts the policy directly above.
    if (deviceFiles && deviceFiles.length > 0 && offeredToolNames.includes('run_python')) {
      systemPromptToUse = systemPromptToUse + buildAttachedFilesDirective(deviceFiles);
    }

    // PDF handling: text extraction is done on the frontend (pdfjs-dist).
    // pdfData = extracted text from a new PDF upload
    // pdfExtractedText = cached text from a previous upload in the same session (follow-up)
    const pdfTextContent = pdfData || pdfExtractedText || '';

    const processedMessages = [...messages];

    // Messages can carry tool-call fields (tool_calls / tool_call_id) once the
    // PRO agentic loop appends them, so keep the element shape open.
    let apiMessages: ProviderMessage[];
    // Images on this turn, in both the hosted and inline forms the client sent.
    // Nothing is done with them yet: whether they go to the model as images or
    // as transcribed text depends on which hop ends up serving the turn, and
    // that is not known until the chain runs (api/_lib/vision.ts).
    const attachments = collectAttachments(imageData, inputImageUrls);
    const hasImageInput = hasAttachments(attachments);

    {
      // Build apiMessages the same way for all cases (text-only messages).
      // Every persona is a TimeMachine persona now and carries a system prompt.
      // The third-party-branded personas were removed — see production-check.md 0.9.
      apiMessages = [
        { role: 'system', content: systemPromptToUse },
        ...toApiMessages(processedMessages)
      ];
    }

    // Document text injection: enrich the last user message with the file content
    if (pdfTextContent && apiMessages.length > 0) {
      const lastMsgIndex = apiMessages.length - 1;
      const lastMsg = apiMessages[lastMsgIndex];
      // Runs before any image parts are attached, so content is still a string.
      const lastText = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      const isPlaceholderOnly = lastText.startsWith('[PDF:') || lastText.startsWith('[File:');
      const userPrompt = isPlaceholderOnly ? '' : lastText;
      const ext = pdfFileName?.split('.').pop()?.toLowerCase() || '';
      const isPdf = ext === 'pdf';
      const fileLabel = pdfFileName ? `"${pdfFileName}"` : (isPdf ? 'the uploaded PDF' : 'the uploaded file');

      const fileContext = isPdf
        ? `<pdf_document name=${JSON.stringify(fileLabel)}>\n${pdfTextContent}\n</pdf_document>`
        : `<uploaded_file name=${JSON.stringify(fileLabel)} type=${JSON.stringify(ext)}>\n${pdfTextContent}\n</uploaded_file>`;

      const enrichedContent = userPrompt
        ? `${fileContext}\n\nUser's question about ${fileLabel}: ${userPrompt}`
        : `${fileContext}\n\nThe user uploaded ${fileLabel}. Please provide a comprehensive summary of the document above.`;

      apiMessages[lastMsgIndex] = { ...lastMsg, content: enrichedContent };
    }

    // Where the user's own last turn sits, captured before the device
    // transcript is appended after it. Images belong to that message, not to
    // whatever a resumed run happens to end with.
    const lastUserMessageIndex = apiMessages.length - 1;

    // Resuming a suspended run: the assistant turn that called the device
    // tools, and their results, replayed so the model sees what it asked for.
    if (toolTranscript && toolTranscript.length > 0) {
      apiMessages.push(...(toolTranscript as ProviderMessage[]));
    }

    // Handle streaming vs non-streaming responses
    if (stream) {
      // Set up streaming response headers
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');




      // ─── Resolve which provider and model this run uses ───────────────
      // Each persona keeps its own historical fallback provider.
      // Same derivation the spend ceiling used above.
      const runProvider = provider;
      let runModel: string = modelToUse;
      let runTemperature: number | undefined = temperatureToUse;
      let runMaxTokens: number | undefined = maxTokensToUse;
      let runReasoningEffort: string | undefined = reasoningEffortToUse;
      const runTools = toolsToUse;

      // Flow State swaps the model alongside the provider.
      const flowConfig = (personaConfig as PersonaProviderConfig & {
        flowState?: VisionCapability & { model?: string; temperature?: number; maxTokens?: number; reasoningEffort?: string };
      }).flowState;
      const usingFlowState = persona === 'default' && flowState && !!flowConfig;
      if (usingFlowState && flowConfig) {
        runModel = flowConfig.model ?? runModel;
        runTemperature = flowConfig.temperature;
        runMaxTokens = flowConfig.maxTokens;
        // Replaced, not defaulted: the persona's value describes the persona's
        // model, and this one may not accept it — see the config.
        runReasoningEffort = flowConfig.reasoningEffort;
      }

      // The vision annotation has to come from whichever config supplied
      // runModel. Reading it off the persona would describe the persona's own
      // model, which a special mode or Flow State has just replaced — and
      // claiming 'native' for a model that cannot see is a 400, not a worse
      // answer.
      const primaryCapability: VisionCapability = usingFlowState && flowConfig
        ? { vision: flowConfig.vision, imageTransport: flowConfig.imageTransport }
        : specialModeConfig
          ? { vision: specialModeConfig.vision, imageTransport: specialModeConfig.imageTransport }
          : { vision: (personaConfig as ModelConfig).vision, imageTransport: (personaConfig as ModelConfig).imageTransport };

      try {
        // Every persona runs the same agentic loop. Tool results go back to the
        // model instead of being spliced into the user's response, which is what
        // lets the runtime backstop refuse a bad generate_image call and have the
        // model recover on the next iteration.
        const toolPolicy = createToolPolicy({ offered: offeredToolNames });

        // Opening a provider stream — up to and including its first real
        // frame, see guardStreamStart — is the only retryable moment: it
        // either yields a stream that has started answering or throws before
        // a single byte reaches the client. Once tokens are flowing there is
        // no resume, so a mid-stream death surfaces as truncated instead
        // (1.9/1.11).
        const fullChain = buildProviderChain(runProvider, runModel, personaFallbacks(personaConfig), primaryCapability);
        // Drop hops whose provider is out of budget for the day. With no ceiling
        // configured openProviders holds the whole chain, so nothing is lost.
        const providerChain = openProviders.length > 0
          ? fullChain.filter(hop => openProviders.includes(hop.provider))
          : fullChain;

        // Which provider actually produced the turn. The ceiling used to be
        // charged to the primary regardless, so a run served by a fallback
        // spent the primary's budget and capped it early.
        let servedProvider = runProvider;

        // The index of the user message carrying the images. Captured before
        // the loop starts appending assistant and tool messages after it —
        // "the last message" stops being the right one on the second
        // iteration, and on a resumed run it was never right to begin with.
        const imageIndex = lastUserMessageIndex;

        // Once any token has reached the client, a status marker written after
        // it would flip the UI back to "Analyzing photo…" mid-answer. The
        // marker pair is only honest before the first token.
        let hasStreamedContent = false;

        const adaptForHop = hasImageInput
          ? createVisionAdapter({
            attachments,
            imageIndex,
            extractText: extractImageContent,
            onOcrStart: () => { if (!hasStreamedContent) res.write('[IMAGE_ANALYZING]'); },
            onOcrEnd: () => { if (!hasStreamedContent) res.write('[IMAGE_ANALYZED]'); },
            log: (message) => console.log(`[${persona}] ${message}`),
          })
          : passThroughVisionAdapter;

        // A native hop never writes [IMAGE_ANALYZING], so the client — which
        // put itself in "Analyzing photo…" the moment the user hit send — needs
        // telling that the looking is happening inside the answer itself.
        if (hasImageInput && providerChain[0] && resolveVisionMode(providerChain[0] as VisionHop) === 'native') {
          res.write('[IMAGE_ANALYZED]');
        }

        const loopResult = await runAgentLoop({
          messages: apiMessages,
          tools: runTools,
          toolContext: {
            persona,
            inputImageUrls,
            imageDimensions,
            policy: toolPolicy,
            healthcareSearch: fetchHealthcareRAGContext,
            findable: toolSet.findable,
            userSkills,
            governedSkillSlugs,
            mcpTools,
          },
          deviceBridge: deviceAppsEnabled.length > 0,
          // A coding turn holds several files at once; the general budget
          // would forget the file under edit by the third round.
          ...(maxModeRequest ? { toolResultBudget: MAX_MODE_TRANSCRIPT_BUDGET_CHARS } : {}),
          // Only when there is something that could need approving. Without a
          // signed-in user there is no row to write and no card to show.
          requestMcpApproval: (userId && mcpTools.some(tool => tool.requiresApproval))
            ? createMcpApprovalRequester({
              userId,
              chatSessionId: typeof body.chatSessionId === 'string' ? body.chatSessionId : null,
              mcpTools,
              provider: servedProvider,
              model: modelToUse,
              temperature: temperatureToUse,
              maxTokens: maxTokensToUse,
              reasoningEffort: runReasoningEffort,
            })
            : undefined,
          emit: {
            emitContent: (text) => { hasStreamedContent = true; res.write(text); },
            emitToolText: (text) => { hasStreamedContent = true; res.write(`\n\n${text}\n\n`); },
            emitMarker: (marker) => { res.write(marker); },
          },
          callModel: async (msgs, activeTools, attempt) => {
            // A hop that opened and answered with nothing is not one the chain
            // knows how to fail. Seen live: nvidia returned an empty 200 and
            // AMD and LLM7 were never tried. On the loop's one retry, that hop
            // is skipped and charged a failure so its breaker learns too.
            let chain = providerChain;
            if (attempt.afterEmptyAnswer) {
              recordProviderOutcome(servedProvider, false);
              const rest = providerChain.filter(hop => hop.provider !== servedProvider);
              if (rest.length > 0) {
                console.warn(`[${persona}] ${servedProvider} answered with nothing; retrying on ${rest[0].provider}`);
                chain = rest;
              }
            }
            const walkChain = (forceOcr: boolean) => runWithProviderFallback(
              chain,
              async (hop) => dispatchStreamingProvider(
                hop.provider,
                await adaptForHop(hop as VisionHop, msgs, { forceOcr }),
                activeTools,
                {
                  model: hop.model,
                  temperature: runTemperature,
                  maxTokens: runMaxTokens,
                  reasoningEffort: runReasoningEffort,
                }
              ),
              (message) => console.log(`[${persona}] ${message}`),
            );

            let run;
            try {
              run = await walkChain(false);
            } catch (error) {
              // A chain where every hop claims to see the image has nothing
              // under it: if that claim is wrong for the endpoint rather than
              // the model, all of them 400 and the turn dies. Transcribing and
              // walking it once more turns that into a worse answer instead of
              // no answer. Safe to retry — opening a stream either yields one
              // or throws, so nothing has reached the client yet.
              if (!hasImageInput || !chainIsAllNative(chain as VisionHop[])) throw error;
              console.warn(`[${persona}] every hop failed with images attached; retrying the chain with transcription`);
              run = await walkChain(true);
            }
            servedProvider = run.provider;
            if (run.provider !== runProvider) {
              console.warn(`[${persona}] fell back from ${runProvider} to ${run.provider}`);
            }
            return run.value;
          },
          log: (message) => console.log(`[${persona}] ${message}`),
        });

        // The model asked for something only the browser can do. End this leg
        // cleanly — sentinel and all, because nothing failed — and let the
        // client run the calls and start the next one. Quota and memory are
        // deliberately not touched here: one user turn is charged once, on
        // whichever leg produces the answer.
        // The user has to answer before anything runs. Unlike the device
        // suspension there is no next leg from the client: /api/mcp-approval
        // finishes the turn if they say yes.
        if (loopResult.mcpApproval) {
          res.write(CONTROL_FRAME_PREFIX + JSON.stringify({
            type: 'mcp_approval',
            payload: loopResult.mcpApproval,
          }) + '\n');
          res.write('[STATUS_END]');
          res.end();
          return;
        }

        if (loopResult.deviceSuspension) {
          // A registry tool's code travels with the call — the browser has
          // never seen it. A session tool's does not; the browser wrote it.
          const toolCalls = attachToolPayloads(
            loopResult.deviceSuspension.allToolCalls.map(call => ({
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments || '{}',
            })),
            generatedTools.registryByName,
          );
          recordToolUse(toolCalls);
          const frame: DeviceToolRequestFrame = {
            type: 'device_tool_request',
            payload: {
              assistantContent: loopResult.deviceSuspension.assistantContent,
              toolCalls,
              resolvedResults: loopResult.deviceSuspension.resolvedResults,
              priorTranscript: loopResult.deviceSuspension.priorTranscript,
              deviceRounds: deviceRounds + 1,
            },
          };
          res.write(CONTROL_FRAME_PREFIX + JSON.stringify(frame) + '\n');
          res.write('[STATUS_END]');
          res.end();
          return;
        }

        let fullContent = loopResult.content;

        if (loopResult.hitMaxIterations) {
          const warning = '\n\n*System: Maximum reasoning iterations (5) reached. Stopped further tool executions.*';
          res.write(warning);
          fullContent += warning;
        }

        // Charge quota only now that the generation has actually succeeded.
        // Flow State consumes 3 quota instead of 1.
        const quotaCost = (flowState && persona === 'default') ? 3 : 1;
        await incrementRateLimit(userId, ip, persona, {
          amount: quotaCost,
          anonymousDeviceId,
          provider: servedProvider,
        });

        // Process memory tags from the full content (XML-based memory system)
        if (userId && fullContent) {
          const memoryResult = await processMemoryTags(fullContent, userId, persona, userClient);
          if (memoryResult.hasSavedMemory) {
            // Send a special marker that the frontend can detect
            res.write('\n\n[MEMORY_SAVED]');
          }
        }

        res.write('[STATUS_END]');
        res.end();
      } catch (error) {
        // Never log the prompt or the partial generation, only the failure.
        console.error('Streaming error:', error instanceof Error ? error.message : error);
        // Headers are already committed by this point (the status/keep-alive
        // writes above), so res.status(500) would be a no-op and .end(text)
        // would append the error to the assistant's message. sendApiError
        // switches to a control frame and ends the stream *without*
        // [STATUS_END], which is how the client learns the turn failed (1.9).
        sendApiError(res, 'PROVIDER_DOWN', 'The model provider failed mid-response.');
      }
    } else {
      // Non-streaming response (fallback)
      let apiResponse: ProviderResponse = {};

      // Image handling for non-streaming. This path has no fallback chain — it
      // dispatches to exactly one (provider, model) — so the vision mode can be
      // settled here instead of per hop.
      if (hasImageInput) {
        const nonStreamFlow = (personaConfig as ModelConfig).flowState;
        const usingFlowState = persona === 'default' && flowState && !!nonStreamFlow;
        const nonStreamModel = usingFlowState && nonStreamFlow ? nonStreamFlow.model : modelToUse;
        const capabilitySource: VisionCapability = usingFlowState && nonStreamFlow
          ? nonStreamFlow
          : (specialModeConfig ?? (personaConfig as ModelConfig));

        const hop: VisionHop = {
          provider,
          model: nonStreamModel,
          vision: capabilitySource.vision,
          imageTransport: capabilitySource.imageTransport,
        };

        if (resolveVisionMode(hop) === 'native') {
          const images = selectVisionImages(attachments, hop.imageTransport);
          apiMessages = applyNativeVision(apiMessages, apiMessages.length - 1, images);
        } else {
          const ocrImages = selectOcrImages(attachments);
          let extractedText: string | null = null;
          try {
            extractedText = await extractImageContent(ocrImages);
          } catch (ocrError) {
            console.error('Image OCR pipeline error (non-streaming):', ocrError);
          }
          apiMessages = applyOcrVision(apiMessages, apiMessages.length - 1, ocrImages.length, extractedText);
        }
      }

      // Choose API based on persona
      if (persona === 'default') {
        // Air persona — check Flow State first, then configured provider
        const flowConfig = (personaConfig as ModelConfig).flowState;
        if (flowState && flowConfig) {
          // Flow State: route based on configured provider
          const fsProvider = flowConfig.provider || 'groq';
          if (fsProvider === 'groq') {
            const requestBody: ProviderRequest = {
              messages: apiMessages,
              model: flowConfig.model,
              temperature: flowConfig.temperature,
              max_tokens: flowConfig.maxTokens,
              stream: false
            };
            if (flowConfig.reasoningEffort) {
              requestBody.reasoning_effort = flowConfig.reasoningEffort;
            }
            if (toolsToUse && toolsToUse.length > 0) {
              requestBody.tools = toolsToUse;
              requestBody.tool_choice = "auto";
            }
            const response = await providerFetch('https://api.groq.com/openai/v1/chat/completions', {
              providerLabel: 'groq',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
            apiResponse = await response.json();
          } else if (fsProvider === 'pollinations') {
            apiResponse = await callPollinationsAPI(
              apiMessages,
              flowConfig.model,
              flowConfig.temperature,
              flowConfig.maxTokens,
              toolsToUse
            );
          } else if (fsProvider === 'secretstoai' || fsProvider === 'secrectstoai') {
            apiResponse = await callSecretsToAIAPI(
              apiMessages,
              flowConfig.model,
              flowConfig.temperature,
              flowConfig.maxTokens,
              toolsToUse
            );
          } else if (fsProvider === 'eaon') {
            apiResponse = await callEaonAPI(
              apiMessages,
              flowConfig.model,
              flowConfig.temperature,
              flowConfig.maxTokens,
              toolsToUse
            );
          } else if (fsProvider === 'nvidia' || fsProvider === 'nim') {
            apiResponse = await callNvidiaAPI(
              apiMessages,
              flowConfig.model,
              flowConfig.temperature,
              flowConfig.maxTokens,
              toolsToUse
            );
          } else if (fsProvider === 'amd') {
            apiResponse = await callAmdAPI(
              apiMessages,
              flowConfig.model,
              flowConfig.temperature,
              flowConfig.maxTokens,
              toolsToUse
            );
          } else if (fsProvider === 'llm7') {
            apiResponse = await callLlm7API(
              apiMessages,
              flowConfig.model,
              flowConfig.temperature,
              flowConfig.maxTokens,
              toolsToUse
            );
          } else {
            const requestBody: ProviderRequest = {
              model: flowConfig.model,
              messages: apiMessages,
              temperature: flowConfig.temperature,
              max_completion_tokens: flowConfig.maxTokens,
              top_p: 1,
              stream: false,
              reasoning_effort: flowConfig.reasoningEffort
            };
            if (toolsToUse && toolsToUse.length > 0) {
              requestBody.tools = toolsToUse;
              requestBody.tool_choice = "auto";
            }
            const response = await providerFetch('https://api.cerebras.ai/v1/chat/completions', {
              providerLabel: 'cerebras',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
            apiResponse = await response.json();
          }
        } else {
          const airProvider = (personaConfig as ModelConfig).provider || 'cerebras';

          if (airProvider === 'groq') {
            const requestBody: ProviderRequest = {
              messages: apiMessages,
              model: modelToUse,
              temperature: temperatureToUse,
              max_tokens: maxTokensToUse,
              stream: false
            };

            if (reasoningEffortToUse) {
              requestBody.reasoning_effort = reasoningEffortToUse;
            }

            if (toolsToUse && toolsToUse.length > 0) {
              requestBody.tools = toolsToUse;
              requestBody.tool_choice = "auto";
            }

            const response = await providerFetch('https://api.groq.com/openai/v1/chat/completions', {
              providerLabel: 'groq',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
            apiResponse = await response.json();
          } else if (airProvider === 'pollinations') {
            apiResponse = await callPollinationsAPI(
              apiMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              toolsToUse
            );
          } else if (airProvider === 'secretstoai' || airProvider === 'secrectstoai') {
            apiResponse = await callSecretsToAIAPI(
              apiMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              toolsToUse
            );
          } else if (airProvider === 'eaon') {
            apiResponse = await callEaonAPI(
              apiMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              toolsToUse
            );
          } else if (airProvider === 'nvidia' || airProvider === 'nim') {
            apiResponse = await callNvidiaAPI(
              apiMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              toolsToUse
            );
          } else if (airProvider === 'amd') {
            apiResponse = await callAmdAPI(
              apiMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              toolsToUse
            );
          } else if (airProvider === 'llm7') {
            apiResponse = await callLlm7API(
              apiMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              toolsToUse
            );
          } else {
            const requestBody: ProviderRequest = {
              model: modelToUse,
              messages: apiMessages,
              temperature: temperatureToUse,
              max_completion_tokens: maxTokensToUse,
              top_p: 1,
              stream: false,
              reasoning_effort: reasoningEffortToUse
            };

            if (toolsToUse && toolsToUse.length > 0) {
              requestBody.tools = toolsToUse;
              requestBody.tool_choice = "auto";

            }

            console.log('Cerebras API (non-streaming) Request:', JSON.stringify({
              model: requestBody.model,
              messageCount: apiMessages.length,
              hasTools: !!(toolsToUse && toolsToUse.length > 0),
              toolCount: toolsToUse?.length || 0
            }));

            const response = await providerFetch('https://api.cerebras.ai/v1/chat/completions', {
              providerLabel: 'cerebras',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
            apiResponse = await response.json();
            console.log('Cerebras API (non-streaming) Response:', JSON.stringify({
              hasChoices: !!apiResponse.choices,
              choiceCount: apiResponse.choices?.length || 0,
              hasToolCalls: !!apiResponse.choices?.[0]?.message?.tool_calls,
              toolCallCount: apiResponse.choices?.[0]?.message?.tool_calls?.length || 0
            }));
          }
        }
      } else if (persona === 'pro') {
        // Run the agentic loop for TimeMachine PRO (non-streaming)
        const currentMessages = [...apiMessages];
        let iteration = 0;
        const maxIterations = 5;
        let finalContent = '';
        const toolPolicy = createToolPolicy({ offered: offeredToolNames });

        while (iteration < maxIterations) {
          iteration++;

          const activeTools = (iteration === maxIterations) ? [] : applyPolicy(toolsToUse, toolPolicy);

          console.log(`PRO Persona Agent Loop (non-streaming): Iteration ${iteration} of ${maxIterations}`);

          const proProvider = (personaConfig as ModelConfig).provider || 'pollinations';
          let apiResponse;
          if (proProvider === 'secretstoai' || proProvider === 'secrectstoai') {
            apiResponse = await callSecretsToAIAPI(
              currentMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              activeTools
            );
          } else if (proProvider === 'eaon') {
            apiResponse = await callEaonAPI(
              currentMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              activeTools
            );
          } else if (proProvider === 'nvidia' || proProvider === 'nim') {
            apiResponse = await callNvidiaAPI(
              currentMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              activeTools
            );
          } else if (proProvider === 'amd') {
            apiResponse = await callAmdAPI(
              currentMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              activeTools
            );
          } else if (proProvider === 'llm7') {
            apiResponse = await callLlm7API(
              currentMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              activeTools
            );
          } else if (proProvider === 'groq') {
            const requestBody: ProviderRequest = {
              messages: currentMessages,
              model: modelToUse,
              temperature: temperatureToUse,
              max_tokens: maxTokensToUse,
              stream: false
            };
            if (reasoningEffortToUse) requestBody.reasoning_effort = reasoningEffortToUse;
            if (activeTools && activeTools.length > 0) {
              requestBody.tools = activeTools;
              requestBody.tool_choice = "auto";
            }
            const response = await providerFetch('https://api.groq.com/openai/v1/chat/completions', {
              providerLabel: 'groq',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
            apiResponse = await response.json();
          } else if (proProvider === 'cerebras') {
            const requestBody: ProviderRequest = {
              model: modelToUse,
              messages: currentMessages,
              temperature: temperatureToUse,
              max_completion_tokens: maxTokensToUse,
              top_p: 1,
              stream: false,
              reasoning_effort: reasoningEffortToUse
            };
            if (activeTools && activeTools.length > 0) {
              requestBody.tools = activeTools;
              requestBody.tool_choice = "auto";
            }
            const response = await providerFetch('https://api.cerebras.ai/v1/chat/completions', {
              providerLabel: 'cerebras',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });
            apiResponse = await response.json();
          } else {
            apiResponse = await callPollinationsAPI(
              currentMessages,
              modelToUse,
              temperatureToUse,
              maxTokensToUse,
              activeTools
            );
          }

          const assistantMessage = apiResponse.choices?.[0]?.message;
          const toolCalls = assistantMessage?.tool_calls || [];
          const content = assistantMessage?.content || '';

          if (toolCalls.length > 0) {
            currentMessages.push({
              role: 'assistant',
              content: content || null,
              tool_calls: toolCalls
            });

            for (const toolCall of toolCalls) {
              const result = await executeTool(
                toolCall,
                { persona, inputImageUrls, imageDimensions, policy: toolPolicy, findable: toolSet.findable, userSkills, governedSkillSlugs, mcpTools },
                {
                  // Non-streaming: image markdown is folded into the final content,
                  // and status markers have nowhere to go.
                  emitText: (text) => { finalContent += (finalContent ? '\n\n' : '') + text; },
                  emitMarker: () => { },
                }
              );

              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function?.name,
                content: result
              });
            }

            if (content) {
              finalContent += (finalContent ? '\n\n' : '') + content;
            }

            continue;
          }

          finalContent += (finalContent ? '\n\n' : '') + content;
          break;
        }

        // Check if max iterations reached and last response had tool calls
        if (iteration >= maxIterations) {
          const assistantMessage = apiResponse.choices?.[0]?.message;
          const toolCalls = assistantMessage?.tool_calls || [];
          if (toolCalls.length > 0) {
            const warning = '\n\n*System: Maximum reasoning iterations (5) reached. Stopped further tool executions.*';
            finalContent += warning;
          }
        }

        // Finalize rate limits & memories — charged only on success.
        await incrementRateLimit(userId, ip, persona, {
          amount: 1,
          anonymousDeviceId,
          provider,
        });

        if (userId && finalContent) {
          const memoryResult = await processMemoryTags(finalContent, userId, persona, userClient);
          if (memoryResult.hasSavedMemory) {
            finalContent = memoryResult.content + '\n\n[MEMORY_SAVED]';
          }
        }

        const result = extractReasoningAndContent(finalContent);
        return res.status(200).json({
          content: result.content,
          thinking: result.thinking
        });
      } else {
        // Same derivation as the ceiling check and the streaming path.
        if (provider === 'secretstoai' || provider === 'secrectstoai') {
          apiResponse = await callSecretsToAIAPI(
            apiMessages,
            modelToUse,
            temperatureToUse,
            maxTokensToUse,
            toolsToUse
          );
        } else if (provider === 'eaon') {
          apiResponse = await callEaonAPI(
            apiMessages,
            modelToUse,
            temperatureToUse,
            maxTokensToUse,
            toolsToUse
          );
        } else if (provider === 'nvidia' || provider === 'nim') {
          apiResponse = await callNvidiaAPI(
            apiMessages,
            modelToUse,
            temperatureToUse,
            maxTokensToUse,
            toolsToUse
          );
        } else if (provider === 'amd') {
          apiResponse = await callAmdAPI(
            apiMessages,
            modelToUse,
            temperatureToUse,
            maxTokensToUse,
            toolsToUse
          );
        } else if (provider === 'llm7') {
          apiResponse = await callLlm7API(
            apiMessages,
            modelToUse,
            temperatureToUse,
            maxTokensToUse,
            toolsToUse
          );
        } else if (provider === 'pollinations') {
          apiResponse = await callPollinationsAPI(
            apiMessages,
            modelToUse,
            temperatureToUse,
            maxTokensToUse,
            toolsToUse
          );
        } else if (provider === 'cerebras') {
          const requestBody: ProviderRequest = {
            model: modelToUse,
            messages: apiMessages,
            temperature: temperatureToUse,
            max_completion_tokens: maxTokensToUse,
            top_p: 1,
            stream: false,
            reasoning_effort: reasoningEffortToUse
          };
          if (toolsToUse && toolsToUse.length > 0) {
            requestBody.tools = toolsToUse;
            requestBody.tool_choice = "auto";
          }
          const response = await providerFetch('https://api.cerebras.ai/v1/chat/completions', {
            providerLabel: 'cerebras',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });
          apiResponse = await response.json();
        } else {
          const response = await providerFetch('https://api.groq.com/openai/v1/chat/completions', {
            providerLabel: 'groq',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: apiMessages,
              model: modelToUse,
              temperature: temperatureToUse,
              max_tokens: maxTokensToUse,
              tools: toolsToUse,
              tool_choice: "auto",
              stream: false
            })
          });
          apiResponse = await response.json();
        }
      }

      const responseContent = apiResponse.choices?.[0]?.message?.content;
      let fullContent = typeof responseContent === 'string' ? responseContent : '';

      // Process tool calls. This legacy fallback has no loop to feed results
      // back into, so tool output is appended to the response as before — but
      // it still goes through the shared executor, so the image gate and the
      // runtime backstop apply here too.
      const toolCalls = apiResponse.choices?.[0]?.message?.tool_calls || [];
      if (toolCalls.length > 0) {
        const toolPolicy = createToolPolicy({ offered: offeredToolNames });

        for (const toolCall of toolCalls) {
          const result = await executeTool(
            toolCall,
            { persona, inputImageUrls, imageDimensions, policy: toolPolicy, findable: toolSet.findable, userSkills, governedSkillSlugs, mcpTools },
            {
              emitText: (text) => { fullContent += `\n\n${text}`; },
              emitMarker: () => { },
            }
          );

          // web_search emits nothing of its own; its results are the answer here.
          if (toolCall.function?.name === 'web_search') {
            fullContent += `\n\n${result}`;
          }
        }
      }

      // Process memory tags from the full content (XML-based memory system)
      if (userId && fullContent) {
        const memoryResult = await processMemoryTags(fullContent, userId, persona, userClient);
        if (memoryResult.hasSavedMemory) {
          // Replace memory tags with marker and clean content
          fullContent = memoryResult.content + '\n\n[MEMORY_SAVED]';
        }
      }

      // Charge quota only now that the generation has actually succeeded.
      // Flow State consumes 3 quota instead of 1.
      const quotaCost = (flowState && persona === 'default') ? 3 : 1;
      await incrementRateLimit(userId, ip, persona, {
        amount: quotaCost,
        anonymousDeviceId,
        provider,
      });

      // Extract reasoning content for all personas
      const result = extractReasoningAndContent(fullContent);

      // Send complete response as JSON
      return res.status(200).json({
        content: result.content,
        thinking: result.thinking
      });
    }

  } catch (error) {
    // Log the failure, never the request body or prompt content.
    console.error('AI Proxy Error:', error instanceof Error ? error.message : error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // A streaming response may already be committed by the time an error
    // bubbles up here. Writing a JSON body onto it would land inside the
    // assistant's message (1.9).
    if (res.headersSent) {
      sendApiError(res, 'UNKNOWN', 'The request failed.');
      return;
    }

    // An upstream provider saying 429 is not the caller hitting *their* quota.
    // These used to be string-matched into RATE_LIMITED, which is why a busy
    // minute at Groq surfaced to beta testers as "you've used up your
    // messages" — an account-level popup for what was really a transient
    // capacity blip on one provider, already handled by the fallback chain.
    // RATE_LIMITED is now reserved for the quota check above; everything a
    // provider does becomes PROVIDER_DOWN, which the client renders as a
    // retryable bubble on the failed turn.
    if (error instanceof ProviderHttpError) {
      return res.status(STATUS_FOR_CODE.PROVIDER_DOWN).json(
        apiErrorBody('PROVIDER_DOWN', 'Every model provider failed for this turn.')
      );
    }

    if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
      return res.status(429).json(
        apiErrorBody('RATE_LIMITED', 'Rate limit exceeded', { type: 'rateLimit' })
      );
    }

    return res.status(500).json(apiErrorBody('UNKNOWN', 'The request failed.'));
  }
}
