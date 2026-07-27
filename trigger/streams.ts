import { streams } from "@trigger.dev/sdk";

// Output stream for TimeMachine PRO generations.
//
// Chunks are raw text using the exact same wire protocol the web app already
// understands today: plain model text, [STATUS:...] / [STATUS_END] /
// [IMAGE_ANALYZED] markers, [MEMORY_SAVED], and \u001e{json}\n control frames.
// The frontend parser does not need to know the transport changed.
export const proOutputStream = streams.define<string>({
  id: "pro-output",
});
