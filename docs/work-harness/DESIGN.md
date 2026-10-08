---
name: TimeMachine Work
description: A viewport-wide operational workspace in TimeMachine's seasonal glass materials.
colors:
  seasonal-accent: "rgb(var(--tm-chat-accent-rgb, var(--tm-season-rgb, 192 132 252)))"
  brand-accent: "var(--tm-chat-accent-vivid, rgb(var(--tm-chat-accent-rgb, 192 132 252)))"
  ink: "var(--color-ink)"
  muted-ink: "rgb(var(--tm-ink-rgb) / .7)"
  light-structure-paper: "rgb(var(--tm-paper-rgb) / .55)"
  surface: "var(--color-surface)"
  edge: "rgb(var(--tm-ink-rgb) / .16)"
typography:
  brand:
    fontFamily: "Montserrat, var(--font-display)"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-.02em"
  headline:
    fontFamily: "var(--font-sans)"
    fontSize: "clamp(25px, 2.3vw, 30px)"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "14px"
    lineHeight: 1.6
  navigation:
    fontFamily: "var(--font-sans)"
    fontSize: "13px"
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "12px"
rounded:
  compact: "6px"
  task-pane: "26px"
  composer: "28px"
  library-row: "24px"
  pill: "999px"
spacing:
  tight: "6px"
  control: "8px"
  row: "12px"
  pane: "16px"
  mobile-gutter: "20px"
  desktop-gutter: "32px"
components:
  navigation-active:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 14px"
    height: "40px"
  session-search:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  composer:
    textColor: "{colors.ink}"
    rounded: "{rounded.composer}"
    padding: "16px 18px 12px"
  task-pane:
    textColor: "{colors.ink}"
    rounded: "{rounded.task-pane}"
  library-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.library-row}"
  send:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    width: "40px"
    height: "40px"
  read-only-badge:
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  sidebar-toggle:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    width: "36px"
    height: "36px"
---

# Design System: TimeMachine Work

## Overview

**Creative North Star: "Agenta-inspired operations, TimeMachine identity"**

This is a scoped record of the built Work harness, not a replacement for the main TimeMachine or landing-page design system. Its integrated navigation and workspace follow the user's Agenta reference; its seasonal accents, glass materials and whole-name Montserrat wordmark remain TimeMachine's.

The workspace is calm and operational. An uninterrupted working surface carries compact navigation and controls, while generous space around the task composer gives the user's goal priority. In dark mode, Work reveals the same underlying Chat application shell and AppAtmosphere gradient through a transparent Work shell. Light mode retains Work's subtle seasonal glass and paper wash. Both follow the active Auto or manually selected theme without a separate Work palette.

**Key Characteristics:**
- Full-screen integrated sidebar and content.
- Rounded seasonal glass controls and cards with compact operational typography.
- A whole-name bold wordmark with dark-mode glow.
- Visible capability and access states grounded in actual connections.

## Colors

The palette combines theme-inverting neutrals with the active seasonal accent. Frontmatter records live CSS bindings so changes to theme, warmth or season keep a single source of truth.

### Primary

- **Seasonal accent:** focus outlines, caret, selected navigation, status markers and restrained action emphasis. The theme provider chooses the seasonal RGB and vivid title color; Work does not assign a new persona palette.
- **Brand accent:** the wordmark uses the vivid title binding shared with TimeMachine's chat identity.

### Neutral

- **Light structure paper:** a translucent paper substrate supports Work's subtle seasonal wash in light mode. The dark shell is transparent so the shared Chat atmosphere remains visible. Sidebar and composer use their own glass recipes, recorded in the sidecar.
- **Ink and muted ink:** primary content and compact supporting text invert with light/dark mode.
- **Edge:** theme-relative hairlines separate navigation, footers, inputs and working panes.
- **Selected surfaces:** navigation and selected sessions both use the seasonal pill-glass recipe. The latter still carries explicit status text.

**The Theme Authority Rule.** Read the existing TM theme bindings; do not hard-code the capture's purple or cream as Work's permanent palette.

## Typography

**Display Font:** Montserrat for the complete TimeMachine Work wordmark, with the existing display stack as fallback.

**Body Font:** the existing SF Pro Display / Apple system / Inter sans-serif stack through `--font-sans`.

The wordmark carries the identity; the interface type remains quiet and compact. Home's task question uses the headline role, while library headings use a slightly larger fixed title treatment. Composer text is body-sized; navigation and helper text step down without competing with the goal.

### Hierarchy

- **Brand:** bold whole-name title at the top of the sidebar. Dark mode inherits the main title's accent glow; light mode removes its text shadow.
- **Headline:** responsive Home question; at narrow widths it settles at the lower scale value.
- **Body:** composer, descriptions and task content. Long task prose uses more generous line-height (1.75).
- **Navigation:** compact labels paired with small outline icons.
- **Label:** section locations and session groups; setup and footer details step down to 11px, badges to 10px.

## Layout

The Work root fills the viewport: zero outer padding, no outer maximum width, no boxed frame, no shell radius and no outer shadow. The desktop shell is a two-column grid with a fixed sidebar (260px) and a flexible content column. The sidebar is joined to the workspace by a single vertical hairline, with no gap. Content has its own internal gutters; these are not an outer page frame.

The wordmark sits in the sidebar's first row; one persistent toggle occupies its top-right corner while open. Home, Agents, Automations, Skills and Sessions form the primary navigation; New task follows Sessions. Searchable real sessions are grouped under Air, Girlie and PRO. Connections, Settings & theme and the workspace identity occupy the sidebar footer. The content toolbar contains location, Cloud/Local switch and refresh, without a duplicate sidebar toggle.

Home's composer region is centered within the content column and capped at 760px. Its top space adapts to viewport height. Libraries have a wider content measure (920px). A task's steering thread and workspace are separate rounded panes with a 14px gap; the setup/access notice is a compact divided footer rather than a competing hero card.

At 900px and below the layout becomes one column, uses 20px content gutters and reserves toolbar space for the fixed Chat/Work switch. The sidebar begins hidden on narrow viewports; when opened it appears in document flow above the content. The same toggle moves from the closed toolbar position (top 72px, left 20px) to the sidebar's top right (top 16px, right 16px). The Chat/Work switch moves down to top 70px and navigation begins beneath it (about 126px), keeping the wordmark unobscured; closed, the switch returns to top 17px. Section choice closes the sidebar on narrow screens. Task workspace panes switch to a single visible pane rather than forcing desktop columns onto a phone.

**The Viewport Rule.** Keep the Work shell edge-to-edge; constrain the content that needs a reading or composing measure, not the entire application.

**The Shared Atmosphere Rule.** In dark mode, reveal the existing Chat app shell and AppAtmosphere through the Work shell; do not recreate that gradient inside Work.

## Elevation & Depth

The full-screen shell remains structurally flat, with no outer card edge or shadow. Its dark background is transparent to the existing Chat app shell and AppAtmosphere gradient; light mode keeps the Work seasonal wash over translucent paper. Inside it, rounded glass carries the hierarchy. The sidebar adds a faint inner rim, tint and blur. Pill controls use a translucent tint and reflection; the composer, task panes, library choices and Hermes panel use a richer card-glass layer. The composer has a tinted border, bright top reflection, faint bottom tint and diffuse shadow. This depth belongs to internal surfaces, not an outer application frame.

The title's dark glow is the inherited three-layer TM accent treatment (20px, 40px and 60px, with .6, .3 and .1 alpha). Light mode removes the title glow. Work retains its own glass blur in light mode despite the incumbent global flattening policy. Reduced transparency, increased contrast and missing backdrop-filter support restore a solid Work shell background and opaque internal surfaces; reduced motion removes animation and transitions. Exact shadow and motion recipes live in the sidecar.

## Shapes

Pills now organize navigation, search, New task, selected sessions, starter actions, model selection and small badges (999px radius). The composer has a generous 28px curve; separate task panes use 26px curves, becoming 24px on narrow screens. Library choices and Hermes use 24px curves. Hairlines define these glass surfaces without heavy outlines. The sidebar and full-screen shell retain square outer corners.

## Components

### Buttons

General controls use seasonal pill glass with subtle inset highlights. They darken or tint on hover, compress slightly when pressed, show an accent focus outline and fade when disabled. New task and starter actions use the same translucent pill family with tinted hairlines. The send action is circular and accent-tinted, and remains disabled when there is no usable goal or cloud access.

### Chips

Source attachments show compact file labels and a removal action. Hermes' Read only badge is a pill with muted type, translucent glass and a hairline; it identifies capability rather than a selectable state. Library trailing states use the same pill material.

### Cards / Containers

The composer is the main glass surface on Home, with the deeper pane blur (36px in the dark theme; theme values may vary). Task thread and workspace are separately rounded glass panes with a desktop gap. Agent, skill and session choices use rounded glass rows with an icon, title, supporting copy and a trailing pill. Hermes is a rounded glass panel with divided internal rows. Reduced-transparency, increased-contrast and unsupported-blur modes resolve the pill and card recipes to a solid surface.

### Inputs / Fields

The task textarea has a transparent interior, seasonal caret and inherited body font. The composer supplies its border and glass surface. Task instructions are a native disclosure below a dividing line. Session and Hermes catalog searches are bordered pill-glass fields with a focus-within outline; Hermes uses slightly roomier padding. Labels remain available to assistive technology even where the visible label is compact or hidden.

### Navigation

Selected sections and sessions use seasonal pill glass. Session rows truncate long titles and retain an explicit status line. Groups use native disclosures and counts, with pill-shaped summaries. Sidebar visibility does not reset the task draft, selected session or unsaved artifact editor. Home remains mounted while browsing other sections; changing task identity may invoke the existing unsaved-edit confirmation.

The sidebar uses one persistent pill-glass toggle (36px square): at desktop width it sits at left 212px when open and left 24px when closed. Its X and PanelLeft icons rotate and crossfade as the same button moves; there is no separate close button in the sidebar. Its accessible name, expanded state and controlled-sidebar reference follow the open state. Closing returns focus to this persistent button, and Escape inside the sidebar takes the same close path. Reduced-motion settings remove the transition without hiding either state.

### Capability states

Access/setup messaging uses a compact footer with a contextual action. Connection configuration and remote checks are distinct states. Hermes discovery is explicitly read-only: checks read metadata, and skill listings describe capabilities without installing or executing them. In the source inspected for this record, Check Hermes is gated by premium Work access and an in-progress check; server-side assignment determines whether a connection can be read. The UI does not itself pre-disable that check solely because no assigned connection exists. Task launch, tool approval, memory writes, installation and schedules remain disconnected. Do not represent unavailable integrations as working controls.

## Do's and Don'ts

### Do:

- **Do** preserve TM's seasonal theme bindings and whole-name bold identity.
- **Do** reveal the shared Chat atmosphere in dark mode and preserve Work's seasonal paper wash in light mode.
- **Do** keep the viewport shell flush and give the composer its own reading measure.
- **Do** preserve draft and editor state when showing or hiding navigation.
- **Do** distinguish configuration, explicit checks and actual execution.
- **Do** retain keyboard focus, disclosure semantics and opaque-material fallbacks.

### Don't:

- **Don't** restore an outer boxed frame, padded shell or page-wide maximum width.
- **Don't** add duplicate Tasks or Settings controls to the content header.
- **Don't** replace TM identity with Agenta branding or fixed screenshot colors.
- **Don't** claim a source checkout, fixture or metadata response proves deployed execution.
- **Don't** imply Hermes skills, schedules or task execution are available from discovery alone.
