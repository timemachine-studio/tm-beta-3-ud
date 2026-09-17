/**
 * TimeMachine Contour — File Converter (detection)
 *
 * The conversion itself lives in src/services/convert; this is what the
 * textbox understands. `/convert`, `/convert png`, `convert to webp`,
 * `mp4 to mp3` all open the tool, with the target already picked when the
 * words named one. A bare pair of extensions only counts when both are real
 * formats and the second can be written — "km to miles" is the unit
 * converter's, "ts to js" is nobody's.
 */

import { type FileFormat, formatByExt } from '../../../services/convert/formats';

export interface FileConvertResult {
  /** The output format named in the text, if any. */
  target: FileFormat | null;
  /** The input format named in the text ("png to webp"), for the hint. */
  sourceHint: FileFormat | null;
  /** What was typed after the command, for the hint when it named nothing. */
  query: string;
}

const COMMAND = /^\/(?:convert|converter|file-?convert)\b\s*(.*)$/i;
const CONVERT_TO = /^convert\b(?:\s+(?:my|this|a|an|the)\b)?(?:\s+([a-z0-9]+))?(?:\s+(?:file|image|photo|picture|audio|song|track|video|clip|document|doc))?\s+(?:to|into|as)\s+\.?([a-z0-9]+)\s*$/i;
const PAIR = /^\.?([a-z0-9]{2,5})\s+(?:to|→|->|into)\s+\.?([a-z0-9]{2,5})$/i;

function outputFormat(ext: string | undefined): FileFormat | null {
  if (!ext) return null;
  const format = formatByExt(ext);
  return format?.output ? format : null;
}

/** Parse the words after the command: "png", "to png", "→ webp". */
export function parseTarget(text: string): FileFormat | null {
  const match = text.trim().match(/^(?:to|into|as|→|->)?\s*\.?([a-z0-9]+)\s*$/i);
  return outputFormat(match?.[1]);
}

export function detectFileConvert(input: string): FileConvertResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const command = trimmed.match(COMMAND);
  if (command) {
    const query = command[1].trim();
    return { target: parseTarget(query), sourceHint: null, query };
  }

  const convertTo = trimmed.match(CONVERT_TO);
  if (convertTo) {
    const target = outputFormat(convertTo[2]);
    if (!target) return null;
    return { target, sourceHint: convertTo[1] ? formatByExt(convertTo[1]) : null, query: trimmed };
  }

  const pair = trimmed.match(PAIR);
  if (pair) {
    const source = formatByExt(pair[1]);
    const target = outputFormat(pair[2]);
    if (!source?.input || !target) return null;
    return { target, sourceHint: source, query: trimmed };
  }

  return null;
}
