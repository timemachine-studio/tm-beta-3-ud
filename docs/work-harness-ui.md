# Work harness UI

Updated 2026-09-27. This records the implemented Work surface, Chat / Work switch and Connections / Activity extension. It extends TM's existing visual system; it does not define a replacement global design system. The [scoped product record](work-harness/PRODUCT.md), [current direction contract](work-harness-next.md#design-contract) and [implementation contract](work-harness-implementation.md#surface-contract) supply the approved context; [setup and current limits](work-harness-setup.md) supplies the execution boundaries.

## Inherited appearance

Work stays inside the existing chat shell and seasonal atmosphere. Its sidebar/workspace structure follows the supplied Agenta reference while retaining TM's identity and native routes. It reads TM's semantic ink/surface tokens and `--tm-ink-rgb`, `--tm-paper-rgb`, `--tm-shadow-rgb`, `--tm-edge-rgb` and `--tm-chat-accent-rgb`. Air, Girlie and PRO retain the current persona/season accent; theme values come from `src/index.css` and `src/stylesheet/light.css`, rather than a fixed Work palette.

The complete `TimeMachine Work` wordmark uses Montserrat with the inherited display fallback, weight 700, normal letter spacing and the vivid chat accent. Its size is 24px on desktop and 20px at 900px and below. Dark appearance uses the main brand's three fading glow rings (20px at .6 opacity, 40px at .3, 60px at .1); light appearance retains the incumbent global removal of text shadows. `Work` is not a separate lighter suffix. Montserrat is the user's explicit brand requirement.

Body typography inherits the existing sans stack. Home's left-aligned heading uses weight 600, `clamp(26px, 3vw, 34px)` and 1.2 line height. Sidebar navigation uses 14px text; recent-session labels use 12px with 11px status text. File text/editing uses the existing system monospace stack. The Work composer uses 15px text with 1.6 line height, while rendered Markdown uses 14px with 1.75 line height.

## Glass and depth

`src/components/work/work.css` supplies translucent gradients, thin edges, inset highlights and ambient shadows. The composer/control material lets the seasonal field pass through; the sidebar and task panes add paper tint to separate navigation and readable content.

| Surface | Current material |
| --- | --- |
| Chat / Work switch | Ink gradient at .09 → .035 opacity, glass blur, 145% saturation; selected lens mixes ink (.16) and persona accent (.11). |
| Cloud / Local, composer, starter actions | Glass blur; saturation is respectively 145%, 155% and 140%. Composer/Cloud–Local use the Work pane ink gradient (.075 → .025). |
| Sidebar | Pane blur, 150% saturation, Work pane gradient over paper at .35 opacity. Active navigation uses the lighter control gradient. |
| Task conversation and workspace | Pane blur, 150% saturation, pane gradient over paper at .35 opacity. |
| Access and error notices | Pane blur, 150% saturation, Work pane gradient. |

The inherited `--tm-blur-glass` and `--tm-blur-pane` are 28px and 36px in dark appearance, with coarse-pointer values of 14px and 20px; light appearance defines 32px and 44px. Small buttons use a lighter ink/persona control gradient (.095/.065) and inset edges; they do not each add a backdrop filter. The main pane shadow is `0 8px 26px rgb(var(--tm-shadow-rgb) / .16)` plus an inset highlight. Panel corners use `--tm-radius-panel` (currently 28px), ordinary controls are pills, the sidebar has 22px corners, and sidebar rows have 12px corners.

The incumbent light stylesheet globally removes backdrop filters. Scoped rules restore blur on the Work surfaces listed above, including the sidebar, and the Chat / Work switch, using 140% saturation in light appearance. This is a local material exception; it does not restyle the main chat. Legacy floating-history CSS remains in the file, but no floating history view is currently rendered.

## Layout and behavior

The fixed mode switch is centered at the top (17px), with a 36px minimum button height. Its selected lens uses a shared Framer Motion layout animation: spring, zero bounce, duration .28 seconds. Selecting a mode changes local view state without sending, navigating or resetting the mind. Chat remains mounted and is hidden while Work is shown; Work mounts on first visit and remains mounted across subsequent switches within the same user/session. The switch is absent in group chat, branded overrides and the existing Max Mode route.

Work fills the available shell with 24px outer horizontal padding. Its desktop grid is a 240px sidebar and a flexible content column with a 22px gap; collapsing the sidebar gives the content one flexible column. The header is 78px high. Home is capped at 640px, with a compact left-aligned heading and one task composer; its top margin is `clamp(35px, 10vh, 110px)`. The composer's own 860px cap applies within its parent, so Home's composer remains constrained by the 640px Home column. Three compact outcome buttons wrap naturally and fill the draft. Library views use an 850px cap. Access status is a secondary inline notice above the content.

The sidebar defaults open when Work first mounts above 900px, and closed at 900px and below. A persistent 40×40px header toggle opens/closes it at every size; a 40×40px close button is also present inside the sidebar. The initial default is determined at mount rather than reset on every resize. Hidden navigation remains mounted but uses `hidden` and `display: none`, removing its controls from the focus order. Escape from inside the sidebar closes it and returns focus to the header toggle; the close button also restores that focus. Selecting a section, task or New task keeps the sidebar open on desktop and closes it on mobile. Sidebar collapse changes layout without unmounting Home, the selected task panel or artifact editors, retaining task drafts and unsaved file edits.

Cloud / Local identifies the environment. Local requires a separate explicit entry into the existing PRO browser workspace; changing environments does not start execution or select PRO. The UI explains that cloud files are not copied automatically and this is a separate browser execution environment, not unrestricted host access.

An active task places its conversation on the left and workspace on the right (.85fr/1.15fr, 20px gap). Workspace tabs are Overview, Files and Activity. Plans expose approval; active tasks expose Stop. Files provide preview, copy, download and Markdown-to-Word export; generated files can be edited when execution permits, while originals are read only. Hidden file editors stay mounted so selecting another file retains drafts.

At 900px and below, the mode switch moves below the brand (70px), with reserved chat header/message space. Work uses 16px horizontal padding, a 64px header and a single-column shell with 58px top padding for the switch. Opening the sidebar places navigation above the content in normal flow, with a 350px minimum sidebar height; it is not a modal overlay. Home's top margin becomes 38px. Conversation / Workspace buttons select one task pane in a single-column layout. Starter actions remain compact and wrap to available space; they are not forced to full width. Composer corners become 22px and pane padding becomes 18px. The header's Tasks shortcut is hidden on mobile; Sessions remains available in the sidebar.

## Navigation and native library

The sidebar contains New task; Home, Agents, Automations, Skills and Sessions; recent sessions; and Connections plus Settings & theme in the footer. Connections receives the same selected-row treatment and `aria-current="page"` as the main navigation. The desktop Tasks header shortcut opens Sessions. Recent sessions display up to 12 entries from the current owner's real task history, with the selected task and stored status indicated. Sessions lists that same history; an empty account receives an explanatory empty state. Navigation does not fabricate sessions or completion statistics.

Agents selects Air, Girlie or PRO through TM's existing model routes, and explicitly explains that custom Agenta configuration needs a hosted connection. Existing tasks retain their original mind. Skills offers three native-worker task templates: Research brief, Document planning and Table analysis. Choosing one fills the Home goal and instructions. Automations explains that recurring schedules and external triggers are not connected; no working scheduling controls or fabricated automation records are presented.

## Connections and Activity

Connections is an explicit account-configuration view, reached from the sidebar footer. Its four rows describe Native cloud, Local workspace, OpenHands and Agenta. Native cloud's `Worker enabled` label reflects the permitted account's cloud capability configuration; it is not evidence that a hosted worker is healthy or has executed a task. Local describes the existing PRO browser workspace and its requirement for the device to remain open.

`Check configuration` reads the account's private, server-assigned OpenHands and Agenta configuration only after the user chooses it. It is disabled without allowed Work access and during a check. No service keys or backend URLs appear in the UI, and the browser cannot choose an arbitrary upstream endpoint. Agenta's metadata-export setting appears only after a configured connection is returned. The explanatory note directs a saved task's user to Activity for a separate remote check.

| View / state | Meaning |
| --- | --- |
| Connections: `Not checked` | No account-configuration result has been read in this view. |
| Connections: `Configured · remote not checked` | The server reports an assigned configuration; no remote response is implied. |
| Connections: `Not connected` | The returned account configuration is unavailable. |
| Activity: `Not checked` | This service's assigned remote data has not been checked in the mounted task monitor. |
| Activity: `Remote response received · monitoring only` | The explicit task-specific read returned a connected remote snapshot; it does not enable execution. |
| Activity: `Not connected` | The task-specific read returned a disconnected result. |

Activity retains the native event history and Model calls disclosure, then adds an `Upstream connections` disclosure. Each named service has its own `Check connection` button, loading status and recoverable error. Opening the disclosure does not make a request. OpenHands can read an administrator-assigned conversation's status, runtime status and event metadata; it cannot start or resume sandbox execution. Agenta can read metadata-only model traces, excluding private prompts, file contents and reasoning. Empty remote event/trace results have explicit messages. Optional hosted adapters remain disabled by default; these views do not provide Agenta agent management, schedules or evaluations, or full OpenHands execution.

The new surfaces reuse the inherited palette, glass shell and pill controls. Connections stays within the existing library cap (850px), with a compact heading (28px, weight 600) and a wrapping heading/action row. Its service rows use thin semantic edges and a desktop definition-list layout (180px label column, flexible detail column, 20px gap, 24px vertical padding). Labels use 15px at weight 600; detail text uses 14px with 1.7 line height and a 65ch reading cap. At 600px and below, each row stacks into one column with an 8px gap and 20px vertical padding. Service icons carry the persona accent, while status and explanation remain readable semantic text rather than health-color badges.

Activity's monitors sit inside the existing scrollable workspace pane, separated by thin edges and 18px spacing. Service titles use 14px at weight 600; conversation/runtime values use 13px with 11px labels. Event times retain tabular numerals, and trace metadata wraps within its column. The monitors add no independent card material or new fixed overlay. Mobile Activity scrolls inside the workspace pane; its wrapping controls and stacked content fit the reviewed 390px viewport.

**The Configuration Is Not Health Rule.** Keep account configuration, an unchecked assignment and a received remote response visibly distinct. An enabled native capability is also configuration, not execution proof.

**The Explicit Read Rule.** Connections and upstream Activity checks are manual reads. Rechecking clears the prior result/error and aborts the previous request; unmount cleanup also aborts. Aborted replies cannot replace the current result, expose a late error or change the current loading state. Leaving Connections unmounts its check, while Home and the selected task/file editors remain mounted behind the section switch, retaining steering and unsaved generated-file drafts.

## Accessibility and verification limits

Controls have visible focus outlines, named groups and labels; selection is represented by `aria-pressed`, `aria-selected` or `aria-current`. The sidebar toggle exposes `aria-expanded` and `aria-controls="work-sidebar"`. Workspace tabs support arrow keys and Home/End. Errors use alerts, notices use a polite live region, and dirty files display an unsaved notice and protect page/task departure.

Reduced motion removes CSS transitions/spinners and makes the selected lens change immediately. Reduced transparency or increased contrast removes backdrop filters, raises border opacity and uses opaque semantic surfaces for the composer, task panes, sidebar and switch. The preference rules explicitly repeat the light glass selector to override its `:is()` specificity, including starter buttons. Both standard and WebKit filter declarations are covered. Browsers without backdrop-filter support receive solid pane/sidebar/switch fallbacks.

The earlier sidebar-slice verification reported 760 passing tests across 102 files, passing TypeScript checks, scoped ESLint and a production build. Browser checks exercised desktop/mobile defaults, opening and closing, desktop/mobile navigation policy, Escape focus return, task-draft retention and unsaved artifact retention through sidebar collapse. Artifact retention and the active-task capture used the explicitly synthetic, isolated `tests/fixtures/work-ui.js` fixture; they do not prove backend execution. An axe scan reported zero violations in the exercised state, with incomplete contrast results requiring manual review and an existing generic conversation `aria-label` warning. This is not a blanket accessibility certification.

The current sidebar captures are:

| Capture | Exercised appearance/state |
| --- | --- |
| [Desktop](../.impeccable/review/work-sidebar-desktop.png) | Dark desktop, default open sidebar. |
| [Collapsed desktop](../.impeccable/review/work-sidebar-collapsed.png) | Dark desktop with expanded content after collapse. |
| [Mobile closed](../.impeccable/review/work-sidebar-mobile-closed.png) | Dark mobile, default closed sidebar. |
| [Mobile open](../.impeccable/review/work-sidebar-mobile-open.png) | Dark mobile navigation in normal flow. |
| [Task](../.impeccable/review/work-sidebar-task.png) | Synthetic plan, conversation and files for UI verification only. |
| [Light desktop](../.impeccable/review/work-sidebar-light-desktop.png) | Light desktop glass/sidebar appearance. |
| [Light mobile](../.impeccable/review/work-sidebar-light-mobile.png) | Light mobile appearance. |

Source checks, automated tests and desktop/mobile browser captures establish only the behavior and appearances they exercise; they do not guarantee contrast across every persona, season, appearance or preference combination. The visual review accepted the inherited typography, glass material, seasonal ground and supplied sidebar/workspace structure after the scoped product record was corrected to persist the toggle requirement. Hosted cloud execution still requires the migration, entitlement and worker setup described in the setup document. This record makes no deployment or upstream parity claim; OpenHands and full Agenta integrations are not deployed by this UI change.

## Connections / Activity verification

The Connections / Activity continuation reported 819 passing tests across 107 files, passing TypeScript checks, scoped ESLint and a production build. Existing build chunk-size warnings remain. Browser QA used the explicitly synthetic Work fixture to verify that steering text and an unsaved generated-file draft survived Connections → Home → Activity navigation, and that the exercised mobile states had no horizontal overflow at 390px. A separate delayed synthetic configuration read began once, was aborted once when leaving Connections for Home, and produced no late alert; the unsaved artifact remained. No native worker or provisioned upstream was called by that probe. These checks establish UI retention, cancellation and layout behavior, not backend execution.

All six captures below were reviewed. Activity captures use synthetic task/remote metadata and are not proof of live provider operation.

| Capture | Exercised appearance/state |
| --- | --- |
| [Connections desktop](../.impeccable/review/work-connections-desktop.png) | Dark desktop account-configuration view. |
| [Activity desktop](../.impeccable/review/work-integrations-desktop.png) | Dark desktop task-specific upstream monitoring. |
| [Connections mobile](../.impeccable/review/work-connections-mobile.png) | Dark mobile stacked configuration rows. |
| [Connections light mobile](../.impeccable/review/work-connections-light-mobile.png) | Light mobile configuration view. |
| [Connections light desktop](../.impeccable/review/work-connections-light-desktop.png) | Light desktop configuration view with the sidebar collapsed. |
| [Activity light mobile](../.impeccable/review/work-integrations-light-mobile.png) | Light mobile upstream monitoring in the scrollable workspace pane. |

The detector's only reported warning was overused-font usage for Montserrat. It was retained because the user pins Montserrat to TM's brand; the warning does not authorize a new global typography direction. Finish-review found no material fixes and accepted shipment of the local Connections / Activity slice only. This disposition does not approve the full harness target or deployment. No live provider runs, migrations, hosted deployment, commits or pushes were performed by this slice.
