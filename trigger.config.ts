import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Your Trigger.dev project ref (starts with proj_). Find it in the
  // Trigger.dev dashboard after creating your free project, then either paste
  // it here or set TRIGGER_PROJECT_REF in your shell environment.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_REPLACE_WITH_YOUR_PROJECT_REF",

  // Task files live in ./trigger
  dirs: ["./trigger"],

  // PRO generations can legitimately run 15+ minutes. This is the compute-time
  // cap for a single run, not a platform request timeout.
  maxDuration: 3600,
});
