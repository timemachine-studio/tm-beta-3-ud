/**
 * TimeMachine Contour - Snippets Manager Module
 * Allows users to save, edit, and quickly copy text snippets and prompts.
 */

export interface Snippet {
    id: string;
    title: string;
    content: string;
}

export interface SnippetResult {
    isManager: true;
    snippets: Snippet[];
}

const STORAGE_KEY = 'tm_contour_snippets';

export function loadSnippets(): Snippet[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveSnippets(snippets: Snippet[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
    } catch {
        //
    }
}

export function createSnippetResult(): SnippetResult {
    return {
        isManager: true,
        snippets: loadSnippets(),
    };
}
