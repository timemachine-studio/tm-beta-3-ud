# TimeMachine Work

<!-- impeccable:product-schema 1 -->

This record covers the Work harness only. It does not replace the main TimeMachine or landing-page identity. Facts below come from the user's approved requests and the current implementation; deployment is not implied.

## Platform

web

## Users

TimeMachine users who want to delegate research, writing, analysis and coding tasks, review a plan, steer the task and receive usable files. The user has specified premium access; building subscriptions and billing is deferred.

## Product Purpose

Provide an outcome-oriented Work interface alongside the existing conversational Chat interface. TimeMachine remains the identity and model-routing authority, using Air, Girlie and PRO rather than replacing them with another product's accounts or model defaults.

## Operating Context

Cloud is the primary target, with local execution an explicit option. Chat / Work switching keeps the existing chat intact. Work navigation contains Home, Agents, Automations, Skills and Sessions. The sidebar is toggleable at every screen size and collapsing it must not reset task drafts, selected tasks or unsaved artifact edits. Active tasks expose a steering conversation and a workspace for plans, files and activity.

## Capabilities and Constraints

- The native implementation contains owner-scoped task APIs, persistent schema, a bounded worker, plan approval, steering, cancellation and editable text artifacts. Hosted operation still requires the documented database, entitlement and worker setup; source code and synthetic UI fixtures are not proof of deployed execution.
- The local option currently opens TimeMachine's existing PRO browser workspace. It is not an OpenHands host agent or unrestricted access to the user's computer.
- Full OpenHands execution and Agenta administration/evaluations/automations are requested targets, not completed integrations. Disconnected services must be identified as unavailable rather than represented by simulated working controls.
- GitHub organization fork requests were denied. OpenHands has a local source checkout and its official typed client is installed. Agenta now has a working sparse source checkout of its API contracts; its full app has not been installed. Neither is a completed remote organization fork.
- Optional server adapters can monitor an administrator-assigned OpenHands conversation and export/read metadata-only Agenta model-call traces. They are disabled by default, require verified owner-scoped connections, and do not enable upstream execution or full feature parity.
- Connections in the sidebar footer reads private account configuration, not live health. Activity exposes explicit, cancellable task-specific remote checks. No service keys or backend URLs appear in these views; configured and remotely checked are distinct states.
- No billing system, live migrations, hosted deployment, commits or pushes are authorized by the current request.

## Brand Commitments

The user requires the current TimeMachine aesthetic: seasonal persona colors, glassmorphic/liquid-glass materials and the same whole-name Montserrat bold styling and dark-mode glow as the main TimeMachine Air title. The supplied Agenta sidebar/workspace reference governs the requested structural direction; it does not authorize replacing TM's identity with Agenta branding.

## Evidence on Hand

The implementation and setup records are [implementation contract](../work-harness-implementation.md), [current revision](../work-harness-next.md) and [setup](../work-harness-setup.md). The isolated fixture in `tests/fixtures/work-ui.js` explicitly labels synthetic task and artifact data and intercepts only the Work API. The UI record documents captures and verification scope; no fabricated execution, usage, cost or parity claims are permitted.

## Product Principles

- Preserve user agency: review before execution, visible task state, steering and cancellation.
- Keep identities, entitlements and task data owner-scoped.
- Preserve drafts and original files; distinguish editable outputs from read-only sources.
- Expose actual capabilities and recoverable errors, not unavailable features disguised as working controls.
