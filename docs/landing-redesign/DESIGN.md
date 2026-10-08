---
name: TimeMachine /welcome — Momentum
description: Local landing design record. The latest correction section supersedes earlier iteration measurements.
colors:
  background: "#030305"
  foreground: "#f5f5f7"
  accent: "#b88aff"
  muted: "#a8a8b4"
  line: "rgba(255,255,255,.12)"
  violet: "#bd93ff"
  pink: "#f28bba"
  cyan: "#72d6ea"
  primary-ink: "#121217"
  primary-hover: "#dfdbe9"
  secondary-surface: "rgba(20,20,28,.82)"
  secondary-ink: "#dedce8"
  secondary-border: "#393744"
  secondary-hover: "#25232f"
  input-surface: "#101117"
  input-border: "#35313f"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(36px, 4.3vw, 62px)"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(2rem, 4.3vw, 3.7rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-.035em"
  hero-body:
    fontSize: "clamp(1rem, 1.65vw, 1.25rem)"
    lineHeight: 1.6
  tile-title:
    fontSize: "18px"
    fontWeight: 550
    letterSpacing: "-.02em"
  label:
    fontSize: "14px"
    fontWeight: 500
rounded:
  pill: "50px"
  glass: "28px"
  stage: "30px"
  nav: "22px"
  input: "12px"
  composer: "18px"
spacing:
  button: "12px 22px"
  tile: "30px"
  stage: "28px"
  grid-gap: "24px"
  section: "160px"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
    padding: "{spacing.button}"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary-surface}"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.pill}"
    padding: "{spacing.button}"
    typography: "{typography.label}"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  optimizer-input:
    backgroundColor: "{colors.input-surface}"
    rounded: "{rounded.input}"
    padding: "14px"
  glass-card:
    rounded: "{rounded.glass}"
    padding: "{spacing.tile}"
---

# Design System: TimeMachine /welcome

## Latest correction — authoritative as-built composition

The user's approved concept, not the prior enlarged iteration, defines the layout. Desktop headline is one line at `clamp(36px,4.3vw,62px)`. Header is capped at 860px; hero at 500px; demo at 900px/64vw. At 1440px the demo begins around y=507 and is about 900×388px. Feature tabs are on top, with a compact greeting/suggestions surface and inline composer/model selector. There is no extra demo heading or window toolbar.

Sequence is hero → demo → asymmetric Notes/Optimizer/Max Mode bento → closing → footer. Extra Minds, Contour, and privacy marketing sections are no longer rendered here; their existing detail pages remain accessible through links. Max Mode uses three compact linked command cards, without the oversized illustration. Textareas use regular-weight type. Bento panels have selective violet/pink/cyan perimeter highlights, not uniform grey outlines or glossy metallic fills.

The latest request increases density: twelve CSS rails, 14px desktop and 10px mobile gaps. Each light has a sequential -1.35-second phase offset. Violet remains dominant, with a sparse cool seam toward the right. Static noise affects light alpha through `welcome-light-grain`; light animation remains CSS-driven and the backdrop continues behind the demo. Pause/offscreen/hidden-document/reduced-motion protections and fine-pointer/scroll response remain. The only production raster used on this compact route is the original shallow-2.5D logo.

The following earlier iteration record is historical where it conflicts with this correction.

## Overview

This is a local implementation record, not a deployment record or the design system for the chat application. Its authority is limited to `/welcome`, implemented in `src/components/landing/LandingPage.tsx`, `WelcomeDemos.tsx`, and `welcome.css`. The approved visual reference is `concepts/06-momentum-dark-refinement.png` in this directory.

**Creative North Star: "Momentum"**

Near-black space, large white type, violet architectural light, and restrained translucent panels frame a hands-on product introduction. Pink and cyan distinguish the other minds. Artwork has shallow 2.5D satin depth, broad graphic faces, narrow edge lighting, and soft grounded shading. The confirmed material direction excludes chrome and mirror gloss; it also excludes completely flat vector treatment.

**Key Characteristics:**

- Black breathing room around bright editorial type.
- Independently animated CSS hero light planes and original TimeMachine artwork.
- Functional, clearly labeled local demos inside restrained dark panels.

## Colors

Violet is the leading accent; pink identifies Girlie and cyan identifies PRO. Air uses violet. The shared accent and muted custom properties are declared on the welcome root; many individual treatments use explicit CSS values. Foreground also supplies the bright primary button surface. The line color provides quiet panel boundaries; secondary buttons and input borders have stronger dedicated strokes. These are landing tokens, not replacements for global application tokens.

## Typography

The page uses Inter with platform sans-serif fallbacks. Display and section headings use tight tracking, balanced wrapping, and compact leading. Supporting hero copy has a maximum width of 560px; section descriptions use 540px. Mind descriptions use 33ch on desktop and 50ch on mobile. Fine print, status text, and demo captions use 11–12px. Mobile hero type changes to `clamp(2.5rem,9.5vw,3.8rem)`; section descriptions decrease from 17px to 15px.

## Layout

The welcome root owns a `100dvh` vertical scroll container. The main wrapper is capped at 1200px with 32px side clearance. The sticky navigation sits 20px below the scroll container top. The hero centers its copy, has a 680px minimum height, and uses 205px top / 150px bottom padding. The 940px demo stage overlaps the hero by 40px. At widths of at least 1600px the hero minimum is 740px, top padding is 235px, and overlap is 80px.

Page order is hero → interactive demo → Notes / Prompt Optimizer / Max Mode bento → Minds → Contour shortcuts → privacy → closing CTA → footer. The bento is directly after the demo. Its two columns use `1.1fr 1fr`, with Notes spanning both rows beside the optimizer and Max Mode. Minds follow later in three columns.

At 1000px and below, section rhythm decreases to 120px and tile padding to 24px. At 760px and below, wrapper side clearance is 20px; desktop links and login give way to a menu; the hero minimum becomes 580px; demo overlap is removed; sections use 96px rhythm; bento, Minds, and shortcut gallery become single columns. At 359px and below, clearance becomes 14px and navigation/tab spacing tightens. Anchor destinations reserve 120px scroll clearance. The footer wraps on mobile.

## Elevation & Depth

UI panels use tonal layering and borders rather than box shadows. Glass uses a dark diagonal translucent gradient and 24px backdrop blur. The generated product images carry shallow bevels, edge light, and contact shading. Following the user's Raycast interaction correction, the hero uses seven unequal CSS light planes, rotated -42 degrees, clustered behind a two-line heading. Different lengths and offsets break the wallpaper repetition; a radial scene mask dissolves the cluster into black. Static SVG grain is clipped to the planes. The retained `assets/hero-reference.webp` is an exploration/reference asset, not the runtime background.

Each plane has a traveling radial light sweep: 9 seconds alternating by default, 11 seconds/-6 seconds on even planes, and 13 seconds/-3 seconds on every third plane. Sweeps travel from 5% to 70% and vary opacity .65–1; narrow edges breathe over 7 seconds. Fine-pointer movement shifts the viewpoint by at most 17px horizontally and 12px vertically. Scroll adds a bounded .13× offset. These event-driven updates use one coalesced animation frame, not a continuous JavaScript loop. Air/Girlie/PRO controls switch light hue and the shared chat-preview model. Pause, hidden document, offscreen hero, and reduced motion stop nonessential motion. Reduced transparency, increased contrast, and missing backdrop-filter use opaque panels.

The product demonstration now has a compact window toolbar, a stable content region, and feature tabs below it. Switching views uses a 260ms opacity/8px transition while mounted hidden panes preserve edits. Reduced motion removes that entrance. Scripted Tokyo responses differ by model and remain explicitly labeled as examples, not answers generated from the visitor's input.

## Shapes

Buttons and mind selectors are pills. Glass cards use broad rounded corners; the stage is slightly rounder. Inputs use smaller rounded corners, while the chat composer has an intermediate radius. Mobile bento corners become 24px and navigation becomes 18px. Borders, not heavy shadows, define the UI surfaces.

## Components

- **Navigation:** translucent horizontal bar with brand, section links, login, and primary CTA. Mobile menu is an inline dropdown. Escape closes it and returns focus to the toggle. A skip link appears on focus.
- **Buttons:** bright primary and bordered dark secondary variants. Shared minimum height is 44px, with smaller navigation and demo variants. Hover changes the fill; active scales to .98. Focus uses a 2px violet outline offset by 5px; disabled controls use .45 opacity.
- **Product stage:** Chat, Contour, Notes, and Max Mode tabs use roving tab focus, Left/Right/Home/End keys, linked tabpanels, and a violet active underline. The bar labels the content Demo.
- **Chat preview:** suggestion chips fill a draft. Playing shows a scripted example, explicitly unrelated to the draft. Only the explicit “Start chat with draft” action invokes the existing `sendFirst` application handoff; model selection adds the appropriate mention.
- **Prompt Optimizer:** generates a local template, permits edits, copies with a manual-selection fallback, and can transfer its draft to the chat preview. “Use in chat” fills the composer; it does not send. Status text uses a live status region.
- **Notes:** editable unsaved textarea and a scripted summary that does not analyze edits. **Max Mode:** manual Plan/Edit/Auto walkthrough; no files change and no commands run.
- **Artwork:** optimized original generated product assets live under `public/landing/odyssey/`: `logo-final.webp`, `minds-final.webp`, and `workspace-final.webp`. The retained `assets/hero-reference.webp` records the hero exploration, superseded in runtime by CSS light planes. Each has a `.webp.json` prompt/timestamp provenance sidecar. Prompt text is also retained in this directory's `assets/`. Minds and workspace illustrations use contain sizing. Below-fold images are lazy loaded. The TimeMachine silhouette is retained; no reference brand marks are used.

## Do's and Don'ts

- Do keep this record scoped to `/welcome` and refresh it from the source when the page changes.
- Do preserve the approved shallow satin material and independently animated architectural hero lighting.
- Do keep the bento directly after the demo, with Minds later in the page.
- Do label scripted and template previews and reserve real application handoff for explicit entry actions.
- Don't introduce chrome, mirror reflections, or purely flat artwork as replacements for the approved depth.
- Don't represent local demos as model responses, saved edits, or executed workspace actions.
- Don't apply this landing palette and layout to unrelated chat surfaces or treat this record as evidence of deployment.
