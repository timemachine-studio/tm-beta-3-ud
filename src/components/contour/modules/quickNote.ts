/**
 * TimeMachine Contour - Quick Note Module
 * Parses `/note <text>` command to quickly save a note without opening the app.
 */

export interface QuickNoteResult {
    content: string;
}

const STORAGE_KEY = 'tm-notes';

// These types match the ones in NotesPage.tsx for compatibility
type BlockType = 'text';
interface Block {
    id: string;
    type: BlockType;
    content: string;
}

interface Note {
    id: string;
    title: string;
    blocks: Block[];
    createdAt: string;
    updatedAt: string;
    starred: boolean;
}

export function detectQuickNote(input: string): QuickNoteResult | null {
    const match = input.match(/^\/note\s+(.+)$/i);
    if (!match) return null;

    return { content: match[1].trim() };
}

export function saveQuickNote(content: string): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const notes: Note[] = raw ? JSON.parse(raw) : [];

        // Find the "Quick Notes" folder/note, or create it if it doesn't exist
        let quickNote = notes.find((n) => n.title.toLowerCase() === 'quick notes');

        if (quickNote) {
            // Append as a new block
            quickNote.blocks.push({
                id: Math.random().toString(36).slice(2, 10),
                type: 'text',
                content,
            });
            quickNote.updatedAt = new Date().toISOString();
        } else {
            // Create new "Quick Notes"
            quickNote = {
                id: Date.now().toString(),
                title: 'Quick Notes',
                blocks: [
                    {
                        id: Math.random().toString(36).slice(2, 10),
                        type: 'text',
                        content,
                    },
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                starred: true,
            };
            notes.unshift(quickNote);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        return true;
    } catch (error) {
        console.error('Failed to save quick note:', error);
        return false;
    }
}
