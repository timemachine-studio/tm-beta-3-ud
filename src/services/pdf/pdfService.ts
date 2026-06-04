/**
 * PDF text extraction service — runs in the browser using pdfjs-dist.
 * Extracts all text from a PDF file so it can be sent directly to the AI model.
 */

// @ts-ignore - pdfjs-dist types may not be perfectly aligned
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite ?url import gives us a bundled URL to the worker file
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker — use local bundled worker (Vite resolves the ?url import)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const MAX_CHARS = 80000; // ~20K tokens — safely within context window limits

/**
 * Extract all text content from a PDF file.
 * Returns the extracted text and page count.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
  }).promise;

  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Reconstruct text with proper spacing
    let lastY: number | null = null;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        const currentY = (item as any).transform?.[5];

        // If Y position changed significantly, it's a new line
        if (lastY !== null && currentY !== undefined && Math.abs(currentY - lastY) > 2) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }

        pageText += item.str;
        if (currentY !== undefined) lastY = currentY;
      }
    }

    pageTexts.push(pageText.trim());
  }

  let text = pageTexts.join('\n\n');

  if (!text.trim()) {
    throw new Error('No text content could be extracted from the PDF. It may contain only scanned images.');
  }

  // Safety truncation for very large documents
  if (text.length > MAX_CHARS) {
    const keepEnd = Math.floor(MAX_CHARS * 0.15);
    const keepStart = MAX_CHARS - keepEnd;
    text = text.slice(0, keepStart)
      + '\n\n[... DOCUMENT TRUNCATED — middle portion omitted due to length. The beginning and end of the document are shown. ...]\n\n'
      + text.slice(-keepEnd);
  }

  return { text, pageCount };
}
