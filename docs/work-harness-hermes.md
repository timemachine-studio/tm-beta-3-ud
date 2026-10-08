# Hermes discovery and Agenta layout

The latest user direction replaces the five pending layout concepts with the Agenta product demo as the interface reference. Their subsequent screenshot correction explicitly removes the inset screen frame: Work fills the viewport with no outer border, rounded container, width cap or page margin. The TimeMachine Work title occupies the sidebar top; New task follows the Sessions navigation item. Duplicate header Tasks and Settings controls are removed, while sidebar Settings and the navigation toggle remain reachable. Work uses compact cloud/local controls, grouped searchable sessions, a 760px composer and a compact setup footer. Existing drafts and task panels retain their state across navigation. Seasonal colors remain theme-aware. Desktop and mobile browser checks show no horizontal overflow and confirm Home/Skills navigation preserves the draft.

The final visual correction restores liquid glass across the full-screen canvas, sidebar and composer with translucent theme washes, blurred panels, reflective edges and a soft composer shadow. The tint resolves through the existing theme variables: Auto follows the active TimeMachine mind, while a manually pinned Settings season stays fixed across mind switches. Isolated browser checks saw Auto PRO use cyan `34 211 238`; manually pinned Winter stayed blue `59 130 246` after changing the mind. Reduced-transparency, high-contrast and unavailable-backdrop modes use solid surfaces.

A later refinement gives the working controls a rounder glass treatment: pill-shaped navigation, New task, session search, mind picker, starter actions and status chips; a 28px composer; 24px library rows; and 26px conversation/workspace panes separated by a small gap. These are interior surfaces, so Work still fills the viewport without an outer frame. The same live theme tint drives the pill and card materials, with solid fallbacks for reduced transparency.

In dark mode Work now leaves its full-screen shell transparent so the existing Chat app shell and `AppAtmosphere` paint the *same* seasonal gradient behind both modes. This removes the competing Work-specific dark wash while retaining the glass controls above it. Light mode keeps the Work paper/glass surface. Reduced-transparency, high-contrast and browsers without backdrop-filter use a solid shell.

The sidebar uses one persistent toggle. When open it appears as an X at the sidebar’s top right; closing rotates/crossfades it into the sidebar icon at the working area’s top left. It carries the sidebar’s expanded state and keeps focus after closing. Escape in the sidebar uses the same close path. On narrow screens, the open sidebar places the Chat/Work switch beneath its title and moves navigation below the switch, avoiding overlap.

Sources: https://agenta.ai/ and https://github.com/NousResearch/hermes-agent . Hermes was downloaded to `D:/TM-Odysseus/upstream-work/hermes-agent` at commit `04ea129bbf84a7b8905eaab9ee575ff345a8f464`. Its MIT license remains in that checkout. No upstream runtime was installed or started, and no upstream source was copied into the application.

The requested organization fork was attempted using `gh repo fork NousResearch/hermes-agent --org timemachine-studio --clone=false`. GitHub returned HTTP 403, “Must have admin rights to Repository.” No personal-account fork was substituted.

## Implemented boundary

`GET /api/work?hermes=1` requires the verified TM user and premium entitlement. Discovery is disabled by default with `TM_WORK_HERMES_MONITORING_ENABLED=false`. It reads only an administrator-assigned, owner-dedicated connection from the proposed private `work_hermes_connections` table. This migration has not been applied. The administrator must attest the dedicated server/profile; a URL or API token alone does not prove tenant or sandbox isolation.

The bounded existing transport permits only allowlisted origins, refuses redirects and reads the scoped credential from a server environment reference. Hermes uses Bearer authentication and preserves a configured API/profile prefix. The adapter calls only `/v1/capabilities` and, if advertised, `/v1/skills`. It returns seven selected capability flags and up to 50 skill metadata records. Raw instructions, model configuration, URLs and credentials are excluded. Duplicate skill names and malformed payloads fail closed. Entitlement and assignment revision are checked again after I/O; assignment changes invalidate the response.

The Connections and Skills views expose an explicit read-only check. A successful check means metadata was returned. Advertised capabilities do not enable features; catalog entries do not mean skills are installed or enabled. Execution remains false.

## Remaining work

Hermes launch, stop/steer, approvals, memory writes, skill installation, delegation and schedules are disconnected. Integrating these requires an explicit choice of execution backend and reconciliation with the existing OpenHands adapter, TM ownership, task revisions, confirmation ledger, event history, cancellation and model routing. Do not introduce a parallel agent loop or enable provider calls implicitly. Live migrations, credentials, deployment and execution have not been performed.
