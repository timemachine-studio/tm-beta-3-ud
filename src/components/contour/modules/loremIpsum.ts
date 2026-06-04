/**
 * TimeMachine Contour - Lorem Ipsum Generator Module
 *
 * Generates placeholder text in various formats.
 */

export interface LoremResult {
  text: string;
  wordCount: number;
  paragraphCount: number;
  type: 'paragraphs' | 'sentences' | 'words';
  isPartial: boolean;
}

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'suspendisse', 'potenti',
  'nullam', 'ac', 'tortor', 'vitae', 'purus', 'faucibus', 'ornare', 'eget',
  'arcu', 'dictum', 'varius', 'duis', 'massa', 'ultricies', 'mi', 'quis',
  'hendrerit', 'nunc', 'scelerisque', 'viverra', 'mauris', 'pellentesque',
  'pulvinar', 'elementum', 'integer', 'enim', 'neque', 'volutpat', 'blandit',
  'cursus', 'risus', 'nec', 'feugiat', 'pretium', 'nibh', 'praesent', 'semper',
  'feugiat', 'nibh', 'sed', 'pulvinar', 'proin', 'gravida', 'hendrerit', 'lectus',
];

const FIRST_SENTENCE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function generateSentence(wordCount?: number): string {
  const count = wordCount || (5 + Math.floor(Math.random() * 12));
  const words = Array.from({ length: count }, () => randomWord());
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}

function generateParagraph(sentenceCount?: number): string {
  const count = sentenceCount || (3 + Math.floor(Math.random() * 4));
  return Array.from({ length: count }, () => generateSentence()).join(' ');
}

export function generateLorem(type: 'paragraphs' | 'sentences' | 'words', count: number): LoremResult {
  let text: string;
  let wordCount: number;
  let paragraphCount: number;

  if (type === 'words') {
    const words = Array.from({ length: count }, () => randomWord());
    words[0] = 'Lorem';
    if (count > 1) words[1] = 'ipsum';
    text = words.join(' ') + '.';
    wordCount = count;
    paragraphCount = 1;
  } else if (type === 'sentences') {
    const sentences = [FIRST_SENTENCE];
    for (let i = 1; i < count; i++) {
      sentences.push(generateSentence());
    }
    text = sentences.join(' ');
    wordCount = text.split(/\s+/).length;
    paragraphCount = 1;
  } else {
    const paragraphs = [FIRST_SENTENCE + ' ' + generateParagraph(3)];
    for (let i = 1; i < count; i++) {
      paragraphs.push(generateParagraph());
    }
    text = paragraphs.join('\n\n');
    wordCount = text.split(/\s+/).length;
    paragraphCount = count;
  }

  return { text, wordCount, paragraphCount, type, isPartial: false };
}

const LOREM_PATTERN = /^lorem(?:\s+ipsum)?(?:\s+(\d+)\s*(p(?:aragraphs?)?|s(?:entences?)?|w(?:ords?)?)?\s*)?$/i;

export function detectLorem(input: string): LoremResult | null {
  const match = input.match(LOREM_PATTERN);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1]) : 0;
  const typeChar = (match[2] || 'p').charAt(0).toLowerCase();

  if (!count) {
    return { text: '', wordCount: 0, paragraphCount: 0, type: 'paragraphs', isPartial: true };
  }

  const type = typeChar === 's' ? 'sentences' : typeChar === 'w' ? 'words' : 'paragraphs';
  const clampedCount = Math.min(count, type === 'words' ? 500 : type === 'sentences' ? 50 : 10);

  return generateLorem(type, clampedCount);
}
