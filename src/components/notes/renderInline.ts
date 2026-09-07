// ─── inline markdown renderer ────────────────────────────────────────
// Lives in its own module rather than inside NotesPage so it can be unit
// tested (production-check.md 0.5) without tripping react-refresh's
// components-only export rule.

// Only these forms may reach a style attribute. Anything else — including a
// value carrying a quote to break out of the attribute — is dropped.
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*[\d\s,.%]+\)|rgba\(\s*[\d\s,.%]+\)|[a-zA-Z]{3,20})$/;

function safeColor(value: string): string {
  const trimmed = value.trim();
  return SAFE_COLOR.test(trimmed) ? trimmed : 'inherit';
}

// Exported for the XSS regression test in renderInline.test.ts.
export function renderInline(text: string): string {
  return text
    // Escape quotes as well as angle brackets: the colour tags below
    // interpolate into an HTML *attribute*, where a bare " ends it and lets the
    // rest of the value become new attributes (production-check.md 0.5).
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/gs, '<em>$1</em>')
    .replace(/__(.+?)__/gs, '<u>$1</u>')
    .replace(
      /\[color:([^\]]+)\](.*?)\[\/color\]/gs,
      (_match, color: string, inner: string) => `<span style="color:${safeColor(color)}">${inner}</span>`,
    )
    .replace(
      /\[bg:([^\]]+)\](.*?)\[\/bg\]/gs,
      (_match, color: string, inner: string) =>
        `<span style="background-color:${safeColor(color)};border-radius:3px;padding:0 2px">${inner}</span>`,
    )
    .replace(/\n/g, '<br>');
}

