import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Your Trigger.dev project ref (starts with proj_). Find it in the
  // Trigger.dev dashboard after creating your free project, then either paste
  // it here or set TRIGGER_PROJECT_REF in your shell environment.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_REPLACE_WITH_YOUR_PROJECT_REF",

  // Task files live in ./trigger
  dirs: ["./trigger"],

  // The default runtime is "node", which is Node 21 — it has no global
  // WebSocket. The task imports api/ai-proxy.ts, whose module-scope
  // createClient() constructs a Supabase RealtimeClient, and realtime-js
  // fails the build with "Node.js detected but native WebSocket not found."
  // Vercel already runs this code on 22 (package.json engines), so the two
  // halves of the deploy were on different Node versions.
  runtime: "node-22",

  // PRO generations can legitimately run 15+ minutes. This is the compute-time
  // cap for a single run, not a platform request timeout.
  maxDuration: 3600,
});
