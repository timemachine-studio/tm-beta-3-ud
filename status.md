# Current status

Updated 2026-09-10. Assigned work: build the first two owner requirements directly, without working through `superplan.md`; check whether Air and PRO already have an agent loop; then fix two rough edges from the first pass and cut Air's per-message token cost.

## What was asked, and what happened

**1. Main chat can use TM Notes, TM Healthcare, and future TM apps — no specialist mode first. Done.**

**2. TM can list past chats with titles, find relevant conversations, and read their actual contents. Done.**

**3. Both Air and PRO have an agent loop. Already true — skipped, as instructed.** `runAgentLoop` in `api/_lib/agentLoop.ts` is called by `api/ai-proxy.ts` for Air and girlie and by `trigger/proGeneration.ts` for PRO. One shared loop, five iterations, policy-enforced refusals. Nothing was added.

Requirements 1 and 2 turned out to be the same problem: **the model runs on a server, and the data does not live there.** Notes are in `localStorage['tm-notes']`. Chat history is `localStorage['chatSessions']` for anonymous users, the user's own RLS-scoped Supabase rows for signed-in ones, and per the storage direction it is heading to on-device IndexedDB for everyone. Only healthcare was already server-reachable. So the work is one mechanism, used three ways.

## The mechanism: a device tool bridge

Device tools are declared on the server, offered to the model, and executed in the browser. When the model calls one, the run suspends, the browser does the work against local storage, and the run resumes with the result appended.

```
model calls notes_create
  → runAgentLoop returns { deviceSuspension } instead of executing
  → route writes a `device_tool_request` control frame, then [STATUS_END], ends
  → aiProxyService runs the call locally, emits the shimmer label, saves the note
  → re-POSTs the same request with toolTranscript grown, deviceRounds + 1
  → loop resumes; text keeps streaming into the same chat message
```

The server stays stateless — there is no suspended run to resume, because the client replays the transcript the same way it already replays `messages`. That is what makes the same code work for anonymous and signed-in users, and what will keep it working when history moves to IndexedDB.

Seven tools now reach the user's own data from the main chat, with no intent gate and no mode to open first:

| Tool | Runs | Reaches |
| --- | --- | --- |
| `notes_search`, `notes_read`, `notes_create`, `notes_edit` | device | TM Notes |
| `chats_search`, `chats_read` | device | chat history, both stores |
| `healthcare_search` | server | the `search_drugs` database |

Decisions taken from the owner in this session: device bridge over a server-side Supabase read; notes read **and** write; PRO gets the bridge too; no approval prompts, but always show shimmer text naming the job.

### Files

New: `shared/deviceTools.ts` (the contract both sides speak), `src/services/notes/notesRepository.ts` (notes store + Markdown ⇄ blocks), `src/services/chat/chatArchive.ts` (bounded list/search/read over both history stores), `src/services/agent/deviceToolRunner.ts` (the executors), `src/components/chat/AppObjectCard.tsx` (the saved-note card).

Changed: `agentLoop.ts` (suspension), `tools.ts` (healthcare tool, device tool selection, `buildAppToolDirective`, `resolveDeviceRoundBudget`), `ai-proxy.ts` and `pro-generation.ts` + `trigger/proGeneration.ts` (both ends of the bridge), `aiProxyService.ts` (the multi-leg client loop), `useChat.ts` (opt-in), `validation.ts` (transcript bounds), `chatService.ts` / `storedChatValidation.ts` (archive methods, card persistence), `NotesPage.tsx` (`?note=` deep link), `ChatMessage.tsx`, `types/chat.ts`.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` (**29 files / 208 tests**, up from 24/153) and `npm run build` all pass on Node 24.20.0. The 55 new tests cover Markdown ⇄ block round-tripping, note CRUD, storage-failure surfacing, archive search and paging, PostgREST filter escaping, loop suspension including mixed server/device batches, tool and data gating, budget resolution, directive shaping, and the whole client leg loop driven through a mocked transport.

Driven in a real browser against live providers, **anonymous** (device stores):

- *"Write three bullet points on why the sky is blue and save them as a note called Sky Notes."* → shimmer read **Saving a note**, the note card rendered with **Open in Notes**, the note really landed in `tm-notes`, and the second leg wrote the answer. Server logs show one suspension and one resume, with the tool result present in the resumed request.
- *"Earlier we had a conversation about the sky. Find that old chat, read it, and tell me exactly what you told me back then."* → chained `chats_search` → `chats_read` → `notes_search` → `notes_read` across four device rounds and quoted the earlier conversation back verbatim. Titles alone would not have answered it; it read the actual messages.
- *"Look up Napa in the medicine database."* → returned real rows (Beximco Pharmaceuticals Ltd., three strengths/forms) and said plainly that the database does not list a dosing schedule rather than inventing one. Server-side, no suspension, two loop iterations.
- `/notes?note=<id>` opened that exact note in the editor and cleared the parameter — verified both by direct navigation and by clicking the card, which is a client-side route change into a lazy chunk.

And again **signed in** (the Supabase archive path, which unit tests only cover for the local store):

- Listing recent chats returned real sessions with titles and dates. The model garbled a couple of titles when writing them out — a small-model rendering slip, not a query fault: `searchCloud` keys results by session id and cannot emit one twice, and the History page shows those sessions are genuinely distinct rows.
- Reading one named conversation returned the right message count and the right first speaker, matching History exactly. That was the last untested cloud query.
- On a cleared store, `notes_create` was the only notes tool offered — the data gate working — and saving still produced the card in one round. Clicking that card opened the note with all three bullets intact.

No live PRO run was exercised — that needs a signed-in account and a deployed Trigger task. PRO shares the loop, the payload and the frame with Air, and its suspension path is unit-tested, but it has not been seen end to end.

## Second pass: the two rough edges, and Air's token cost

**Fixed: the model is now told why its lookups ran out.** `buildAppToolDirective` replaces the old constant and is built from the tool list actually going into the request. Three states: tools available, rounds spent, or no device apps at all. The third was a bug in the first pass — a client that declared no device apps was still told it could reach Notes and History, contradicting the tool policy directly above it.

**Fixed: the round budget is 6, not 4.** Six covers the deepest chain where each step genuinely needs the one before it — find a chat, read it, read another range, write the note — plus one for a wrong first guess and one spare. Past that the model is looping rather than working, and a bigger number buys more of the same. `DEVICE_ROUND_BUDGET` overrides it per deployment (0 disables the bridge, above 10 is clamped); the client keeps a separate hard stop at 10 as a safety valve against a server that never stops asking.

Two things that shaped the number. A round costs one model call whatever tool it spends on, so the tool kind is irrelevant — an earlier suggestion of mine to count reads differently was wrong on cost grounds. And a batch of tool calls in one model turn runs together for one round, so the directive now tells the model to ask for everything it knows it needs at once. That buys rounds back without raising the ceiling.

### Fixed on the way out: eight providers were logging whole prompts

Not two, as first reported — eight. Every provider adapter except Cerebras `console.log`ged the full `messages` array on both its streaming and non-streaming path, which CLAUDE.md's own security rules forbid outright ("Don't log prompt content, tokens, or request bodies"). It predates this work, but the device tools make it materially worse: note contents and past-conversation text now travel in those messages, so any fallback wrote the user's own private data into production logs — on the product whose headline feature is privacy.

All eight now log `messageCount` instead, matching what Cerebras already did. Verified live rather than by inspection: a note-reading turn that fell through eaon to nvidia logged `messageCount: 7` with the note's contents absent from the logs, and still answered correctly, so the request bodies are untouched. A first mechanical pass at this rewrote the request bodies as well as the log lines — caught before it ran, but the reason the fix is verified against a live run rather than a grep.

### Where Air's tokens go

Measured, not estimated (~4 chars/token, ~3 for JSON):

| | tokens |
| --- | --- |
| Air persona prompt | ~1,014 |
| `TOOL_GUARDRAIL` | ~101 |
| `THINKING_DIRECTIVE` | ~97 |
| app tools + directive **before this pass** | ~1,666 |
| app tools + directive **after** — no notes, no history | **~397** |
| — notes only | ~908 |
| — notes and history | ~1,335 |
| conversation history | **unbounded** |

Four cuts, all safe:

1. **Tool schemas trimmed**, 1,510 → 1,178 tokens. `limit` came off `notes_search`, `chats_search` and `chats_read` — the executors clamp whatever they are given, so it cost more in schema than it ever bought in control. Descriptions are one line each.
2. **Readers are withheld from an empty store** (`deviceDataPresent`). A user with no notes cannot search them, so those three tools are not sent — but `notes_create` always is, because it is how an empty store stops being empty. This is not the intent gate the design set out to avoid: it does not guess what the user means, it reflects what exists. Someone with nothing stored yet now pays ~397 instead of ~1,666, and that is most people on the free tier.
3. **The directive scales with the tools**, ~157 → ~60 tokens when only writers are present, and it stops naming apps that are not there.
4. **`chats_read` returns 12 messages at up to 1,200 chars each**, down from 20 at 2,000. A read result is replayed into every leg that follows it, so its size is multiplied by the rounds after it — which is also why the page size is fixed by the executor rather than asked of the model.

**The unbounded one is not mine and I have not touched it.** `toApiContext` in `useChat.ts` filters out the greeting and failed turns and sends *every remaining message*, every turn — there is no cap anywhere in the client or `toApiMessages`. At 20 turns that is ~5,600 tokens of history against ~2,900 of everything else; at 50 turns it is ~14,000 and dominates completely. Capping it is a product decision, not a refactor — the AI visibly "forgets" whatever falls off the end — so it wants a deliberate choice about where to cut and whether to summarise. It is the largest single saving available on Air by a wide margin.

## What is rough

1. **Device rounds multiply provider-fallback latency.** Seen live: with `groq` failing and `eaon` timing out at 45s per attempt, a five-round history question took about two and a half minutes, because every leg re-walks the provider chain from the top. On a healthy chain the same shape is seconds. The fix is small and worth doing next — carry the provider that actually served a leg back in the suspension frame and start the next leg there, instead of re-discovering the same two failures six times.
2. **"Open in Notes" inherits the app's stale-chunk failure mode.** `/notes` is a lazy route, so if the chunk cannot be fetched when the card is clicked, the root ErrorBoundary catches a `Failed to fetch dynamically imported module` and replaces the page. Reproduced in dev with the server stopped; the production equivalent is a long-lived tab clicking through after a deploy has replaced the hashed chunks. Every lazy route already shares this and the Reload button is the standard remedy — but the note card is a new and inviting reason to hit a lazy route from an old tab. Catching that specific import failure and reloading once would close it.
3. **PRO costs a whole Trigger job per device round.** That is what "both, same run" means in practice. Worth measuring before it is on for every PRO user; `deviceBridge` in the PRO payload is the switch if it needs turning off for PRO alone.
4. **A PRO turn suspended when the page reloads is lost.** The reattach path in `useChat.ts:540` has no way to start the next leg, so it falls through with the partial text. The user sees half an answer, not an error.
5. **`<memory>` tags are only processed on the final leg.** One written in a suspended leg is displayed correctly but never saved. Low impact — a suspended leg is usually one sentence — but real.
6. **Notes have a second writer now.** `NotesPage` still loads the whole array into React state and writes it back. Today chat and Notes are different routes so they cannot both be mounted, but a split view or a second tab would clobber. The real fix is the shared IndexedDB repository (D2 / LS.2), and it should land before a third writer does.
7. **Notes and chat sessions share one `localStorage` budget.** `writeNotes` throws loudly on `QuotaExceededError` as the storage rules require, but `saveLocalSession` still swallows it (CLAUDE.md #16). Adding notes brings that ceiling closer.
8. **Search is lexical.** `chats_search` and `notes_search` do substring matching. "what did we say about my startup" will not find a chat that only ever said "my company".
9. **The rate-limit check runs on every leg.** Quota is charged once, on the leg that answers, but a user who runs out between legs gets a 429 mid-turn.

## Suggestions

- **Sticky provider within a turn** — see rough edge 1. Small change, and it is the difference between a two-second and a two-minute answer on a degraded chain.
- **Decide what to do about conversation history.** Nothing else on Air comes close. Even a blunt "last 20 turns verbatim" cap would halve the cost of a long chat.
- Superplan item 4 — real app objects created from chat — is now half-built. `AppObjectRef` and the card exist; pointing them at a second app is small work, and worth doing while the shape is fresh.
- Do the IndexedDB notes repository next, not later. It is the one piece where waiting makes the work bigger rather than smaller.

## Not done, deliberately

Superplan items 5–8 (isolated execution, workflow assembly, the tool catalog and marketplace, generated tools) and the permission-grant model in D10 were not touched. Nothing was committed or pushed. `.env` was not modified — the anonymous cap was raised only in the dev server's own process while testing. `.claude/launch.json` is new and untracked; it just points the preview at Node 24's npm.
