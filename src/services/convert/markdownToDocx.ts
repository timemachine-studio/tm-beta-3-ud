/**
 * Markdown → .docx through the `docx` package.
 *
 * Walks the mdast tree and emits one Word paragraph per block: headings,
 * paragraphs, bullet and numbered lists (nested), fenced code, quotes, rules,
 * pipe tables, links. Bold, italic, strikethrough and inline code carry
 * through as runs. Images are written as their alt text — the writer has no
 * way to fetch a remote image and a data URL is not worth the file size.
 */

import type { MdNode } from './documentEngine';
import { inlineToText } from './documentEngine';

type Docx = typeof import('docx');
type ParagraphChild = InstanceType<Docx['TextRun']> | InstanceType<Docx['ExternalHyperlink']>;
type Block = InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']>;

interface RunStyle { bold?: boolean; italics?: boolean; strike?: boolean; code?: boolean }

const CODE_FONT = 'Consolas';
const NUMBERING = 'tm-numbers';

export async function markdownToDocx(markdown: string, title: string): Promise<Blob> {
  const [docx, { unified }, { default: remarkParse }, { default: remarkGfm }] = await Promise.all([
    import('docx'), import('unified'), import('remark-parse'), import('remark-gfm'),
  ]);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const writer = new DocxWriter(docx);
  const children = writer.blocks(tree.children as MdNode[]);

  const document = new docx.Document({
    title,
    creator: 'TimeMachine',
    numbering: {
      config: [{
        reference: NUMBERING,
        levels: [0, 1, 2].map((level) => ({
          level,
          format: docx.LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: docx.AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [{ children: children.length > 0 ? children : [new docx.Paragraph('')] }],
  });
  return docx.Packer.toBlob(document);
}

class DocxWriter {
  constructor(private readonly docx: Docx) {}

  blocks(nodes: MdNode[], listLevel = -1): Block[] {
    return nodes.flatMap((node) => this.block(node, listLevel));
  }

  private block(node: MdNode, listLevel: number): Block[] {
    const { Paragraph, HeadingLevel } = this.docx;
    switch (node.type) {
      case 'heading': {
        const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
        return [new Paragraph({ heading: levels[Math.min(6, Math.max(1, node.depth ?? 1)) - 1], children: this.inline(node.children) })];
      }
      case 'paragraph':
        return [new Paragraph({ children: this.inline(node.children), spacing: { after: 160 } })];
      case 'code':
        return (node.value ?? '').split('\n').map((line) => new Paragraph({
          children: [new this.docx.TextRun({ text: line || ' ', font: CODE_FONT, size: 18 })],
          shading: { type: this.docx.ShadingType.CLEAR, fill: 'F2F2F2' },
          spacing: { after: 0 },
        }));
      case 'blockquote': {
        // The quote's paragraphs become one ruled paragraph; anything else
        // inside it (a list, a code block) follows as itself.
        const paragraphs = (node.children ?? []).filter((child) => child.type === 'paragraph');
        const rest = (node.children ?? []).filter((child) => child.type !== 'paragraph');
        const out: Block[] = [];
        if (paragraphs.length > 0) {
          out.push(new Paragraph({
            children: this.inline(quoteChildren(paragraphs)),
            indent: { left: 720 },
            border: { left: { style: this.docx.BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 8 } },
            spacing: { after: 160 },
          }));
        }
        out.push(...this.blocks(rest, listLevel));
        return out;
      }
      case 'thematicBreak':
        return [new Paragraph({ border: { bottom: { style: this.docx.BorderStyle.SINGLE, size: 6, color: 'BBBBBB' } }, spacing: { after: 200 } })];
      case 'list':
        return (node.children ?? []).flatMap((item) => this.listItem(item, !!node.ordered, listLevel + 1));
      case 'table':
        return [this.table(node)];
      case 'html':
        return [new Paragraph({ children: [new this.docx.TextRun({ text: node.value ?? '', font: CODE_FONT, size: 18 })] })];
      default:
        return node.children ? this.blocks(node.children, listLevel) : [];
    }
  }

  private listItem(item: MdNode, ordered: boolean, level: number): Block[] {
    const { Paragraph } = this.docx;
    const out: Block[] = [];
    const children = item.children ?? [];
    let first = true;
    for (const child of children) {
      if (child.type === 'list') {
        out.push(...this.block(child, level));
        continue;
      }
      const runs = child.type === 'paragraph' ? this.inline(child.children) : this.inline([child]);
      const box = item.checked == null ? [] : [new this.docx.TextRun({ text: item.checked ? '☑ ' : '☐ ' })];
      if (first) {
        out.push(new Paragraph({
          children: [...box, ...runs],
          ...(ordered ? { numbering: { reference: NUMBERING, level: Math.min(2, level) } } : { bullet: { level: Math.min(2, level) } }),
          spacing: { after: 60 },
        }));
        first = false;
      } else {
        out.push(new Paragraph({ children: runs, indent: { left: 720 * (level + 1) }, spacing: { after: 60 } }));
      }
    }
    return out;
  }

  private table(node: MdNode): Block {
    const { Table, TableRow, TableCell, Paragraph, WidthType } = this.docx;
    const rows = (node.children ?? []).map((row, rowIndex) => new TableRow({
      tableHeader: rowIndex === 0,
      children: (row.children ?? []).map((cell) => new TableCell({
        children: [new Paragraph({ children: this.inline(cell.children, rowIndex === 0 ? { bold: true } : {}) })],
      })),
    }));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  inline(nodes: MdNode[] | undefined, style: RunStyle = {}): ParagraphChild[] {
    if (!nodes) return [];
    const { TextRun, ExternalHyperlink } = this.docx;
    return nodes.flatMap((node): ParagraphChild[] => {
      switch (node.type) {
        case 'text':
          return [new TextRun({ text: node.value ?? '', ...runProps(style) })];
        case 'inlineCode':
          return [new TextRun({ text: node.value ?? '', font: CODE_FONT, size: 18, ...runProps({ ...style, code: true }) })];
        case 'strong': return this.inline(node.children, { ...style, bold: true });
        case 'emphasis': return this.inline(node.children, { ...style, italics: true });
        case 'delete': return this.inline(node.children, { ...style, strike: true });
        case 'break': return [new TextRun({ text: '', break: 1 })];
        case 'image': return [new TextRun({ text: node.alt ? `[${node.alt}]` : '', italics: true })];
        case 'link': {
          const runs = this.inline(node.children, style).filter((run): run is InstanceType<Docx['TextRun']> => run instanceof TextRun);
          if (!node.url) return runs;
          return [new ExternalHyperlink({
            link: node.url,
            children: runs.length > 0 ? runs : [new TextRun({ text: node.url, style: 'Hyperlink' })],
          })];
        }
        default:
          return node.children ? this.inline(node.children, style) : [new TextRun({ text: inlineToText([node]) })];
      }
    });
  }
}

function runProps(style: RunStyle): { bold?: boolean; italics?: boolean; strike?: boolean } {
  return { bold: style.bold, italics: style.italics, strike: style.strike };
}

/** A quote's paragraphs as one inline run, joined with line breaks. */
function quoteChildren(paragraphs: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) out.push({ type: 'break' });
    out.push(...(paragraph.children ?? []));
  });
  return out;
}
