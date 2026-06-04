/**
 * TimeMachine Contour - Quick Event Module
 * Parses `/event <title>` command to quickly save an event to the calendar.
 */

export interface QuickEventResult {
    title: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
}

const STORAGE_KEY = 'tm_lifestyle_premium_events';

interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    color: string;
    description?: string;
    location?: string;
    calendarId: string;
}

function pad(n: number) {
    return n.toString().padStart(2, '0');
}

export function detectQuickEvent(input: string): QuickEventResult | null {
    const match = input.match(/^\/event\s+(.+)$/i);
    if (!match) return null;

    const title = match[1].trim();
    const now = new Date();

    // Format dates for the event
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Default to next hour, running for 1 hour
    let startHour = now.getHours() + 1;
    let endHour = startHour + 1;

    // Cap at end of day
    if (startHour > 23) startHour = 23;
    if (endHour > 23) endHour = 23;

    return {
        title,
        date: dateStr,
        startTime: `${pad(startHour)}:00`,
        endTime: `${pad(endHour)}:00`,
    };
}

export function saveQuickEvent(event: QuickEventResult): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const events: CalendarEvent[] = raw ? JSON.parse(raw) : [];

        const newEvent: CalendarEvent = {
            id: Date.now().toString(),
            title: event.title,
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            color: 'purple',
            calendarId: 'personal',
        };

        events.push(newEvent);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        return true;
    } catch (error) {
        console.error('Failed to save quick event:', error);
        return false;
    }
}
