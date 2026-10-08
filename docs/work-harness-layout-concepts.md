# Work layout concepts · 2026-09-28

Status: five image-generated concepts requested; user selection pending. These are layout explorations, not implemented UI or evidence of connected cloud execution. The existing dirty worktree and private harness implementation remain intact.

The user rejected the current Home layout and asked for five concepts using Apple Design, Impeccable and image generation, followed by a choice before implementation. Preserve the TimeMachine seasonal glass identity, existing model routes, Chat/Work switch, Cloud/Local distinction, task plan/files/activity and owner-bound harness behavior. Replace the oversized empty Home composition and redundant controls. Make setup status secondary while remaining truthful.

| Choice | Structure | Main benefit | Tradeoff |
| --- | --- | --- | --- |
| 1 · Split Studio | Icon rail, sessions column, focused task entry, context inspector | Task entry and context are available together | Most regions on desktop |
| 2 · Floating Dock | Horizontal navigation, broad desk, file pane, bottom dock | Open workspace with little permanent chrome | Dock and overflow require careful mobile adaptation |
| 3 · Finder Workspace | Unified window with navigation, session list and task document | Stable places for navigation, task history and work | More conventional desktop structure |
| 4 · Session Notebook | Session list and inline composer beside task details | Returning to work takes priority | First-time empty state needs a clear composer |
| 5 · Task Canvas | Horizontal navigation, task worksheet and artifact shelf | Goal, plan and work stages are easy to understand | More fields visible before task creation |

Apple Design informs material hierarchy, familiar spatial relationships, readable type, direct feedback and reversible panel behavior. Impeccable informs purposeful density, hierarchy and composition. The image mockups are illustrative: sample draft rows are explicitly labeled, and cloud setup remains required. Generated text and decorative details are not authoritative implementation requirements.

After selection, record the chosen image and structural commitments, then implement semantic responsive UI with real empty/loading/error/setup states. Desktop should retain the selected composition; mobile should use a compact navigation drawer and one principal pane at a time, retaining drafts when panels change. Seasonal colors must resolve from Auto or the manual setting in both appearance modes. Existing runtime and entitlement gates must stay intact.
