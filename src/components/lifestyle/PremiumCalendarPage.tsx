import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
    MapPin, Clock, AlignLeft, X, Check, Search, MoreHorizontal
} from 'lucide-react';

// --- Types & Constants & Helpers ---
type EventColor = 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'yellow';

interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    color: EventColor;
    description?: string;
    location?: string;
    calendarId: string;
}

interface CalendarCategory {
    id: string;
    name: string;
    color: EventColor;
    active: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const COLORS: Record<EventColor, { bg: string, text: string, border: string, dot: string }> = {
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', dot: 'bg-purple-400' },
    green: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
    red: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-400' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', dot: 'bg-orange-400' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: 'bg-yellow-400' },
};

function getStorageKey(key: string) { return `tm_lifestyle_premium_${key}`; }

function loadFromStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(getStorageKey(key));
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function saveToStorage<T>(key: string, value: T) {
    try { localStorage.setItem(getStorageKey(key), JSON.stringify(value)); } catch { /* ignore */ }
}

function dateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function PremiumCalendarPage() {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState<Date>(today);

    const [calendars, setCalendars] = useState<CalendarCategory[]>(() => loadFromStorage('calendars', [
        { id: 'personal', name: 'Personal', color: 'blue', active: true },
        { id: 'work', name: 'Work', color: 'purple', active: true },
        { id: 'birthdays', name: 'Birthdays', color: 'orange', active: true },
    ]));

    const [events, setEvents] = useState<CalendarEvent[]>(() => loadFromStorage('events', [
        { id: '1', title: 'Team Sync', date: dateKey(today.getFullYear(), today.getMonth(), today.getDate()), startTime: '10:00', endTime: '11:00', color: 'purple', location: 'Zoom', calendarId: 'work' },
        { id: '2', title: 'Lunch with Sarah', date: dateKey(today.getFullYear(), today.getMonth(), today.getDate() + 1), startTime: '12:30', endTime: '14:00', color: 'blue', location: 'Downtown Cafe', calendarId: 'personal' },
    ]));

    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

    // Form State
    const [fTitle, setFTitle] = useState('');
    const [fDate, setFDate] = useState('');
    const [fStart, setFStart] = useState('09:00');
    const [fEnd, setFEnd] = useState('10:00');
    const [fCalId, setFCalId] = useState('personal');
    const [fLoc, setFLoc] = useState('');
    const [fDesc, setFDesc] = useState('');

    // Derived state
    const viewYear = currentDate.getFullYear();
    const viewMonth = currentDate.getMonth();

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const persistEvents = (e: CalendarEvent[]) => { setEvents(e); saveToStorage('events', e); };
    const persistCalendars = (c: CalendarCategory[]) => { setCalendars(c); saveToStorage('calendars', c); };

    const handlePrevMonth = () => setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
    const handleToday = () => {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(today);
    };

    const toggleCalendar = (id: string) => {
        persistCalendars(calendars.map(c => c.id === id ? { ...c, active: !c.active } : c));
    };

    const activeCalIds = useMemo(() => new Set(calendars.filter(c => c.active).map(c => c.id)), [calendars]);

    const activeEventsMap = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        events.forEach(e => {
            if (!activeCalIds.has(e.calendarId)) return;
            if (!map[e.date]) map[e.date] = [];
            map[e.date].push(e);
        });
        // Sort by time
        Object.values(map).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));
        return map;
    }, [events, activeCalIds]);

    const openNewEvent = (presetDateStr?: string) => {
        setEditingEvent(null);
        setFTitle('');
        setFDate(presetDateStr || dateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()));
        setFStart('09:00');
        setFEnd('10:00');
        setFCalId('personal');
        setFLoc('');
        setFDesc('');
        setIsEventModalOpen(true);
    };

    const openEditEvent = (ev: CalendarEvent) => {
        setEditingEvent(ev);
        setFTitle(ev.title);
        setFDate(ev.date);
        setFStart(ev.startTime);
        setFEnd(ev.endTime);
        setFCalId(ev.calendarId);
        setFLoc(ev.location || '');
        setFDesc(ev.description || '');
        setIsEventModalOpen(true);
    };

    const saveEvent = () => {
        if (!fTitle.trim() || !fDate) return;
        const color = calendars.find(c => c.id === fCalId)?.color || 'blue';

        if (editingEvent) {
            persistEvents(events.map(e => e.id === editingEvent.id
                ? { ...e, title: fTitle, date: fDate, startTime: fStart, endTime: fEnd, calendarId: fCalId, location: fLoc, description: fDesc, color }
                : e
            ));
        } else {
            persistEvents([...events, {
                id: Date.now().toString(),
                title: fTitle, date: fDate, startTime: fStart, endTime: fEnd, calendarId: fCalId, location: fLoc, description: fDesc, color
            }]);
        }
        setIsEventModalOpen(false);
    };

    const deleteEvent = (id: string) => {
        persistEvents(events.filter(e => e.id !== id));
        setIsEventModalOpen(false);
    };

    // Build grid dates
    const gridCells = [];
    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const dk = dateKey(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1, d);
        gridCells.push({ day: d, dateKey: dk, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        const dk = dateKey(viewYear, viewMonth, d);
        gridCells.push({ day: d, dateKey: dk, isCurrentMonth: true });
    }
    // Next month padding (to fill 6 rows = 42 cells)
    const remaining = 42 - gridCells.length;
    for (let d = 1; d <= remaining; d++) {
        const dk = dateKey(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, d);
        gridCells.push({ day: d, dateKey: dk, isCurrentMonth: false });
    }

    return (
        <div className="flex h-[calc(100vh-140px)] w-full max-w-[1600px] mx-auto px-4 md:px-8 gap-6 -mt-4">

            {/* Sidebar */}
            <div className="hidden lg:flex flex-col w-72 shrink-0 gap-6">
                {/* Create Button */}
                <button
                    onClick={() => openNewEvent()}
                    className="flex items-center gap-3 px-6 py-4 rounded-full bg-white text-black font-bold text-sm tracking-wide shadow-[0_4px_24px_rgba(255,255,255,0.15)] hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] transition-all"
                >
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 blur-sm opacity-50"></div>
                        <Plus className="w-6 h-6 relative z-10" />
                    </div>
                    Create Event
                </button>

                {/* Mini Calendar (Simplified) */}
                <div className="rounded-3xl p-5 bg-white/[0.03] border border-white/5 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white/90 text-sm">{MONTHS[viewMonth]} {viewYear}</h3>
                        <div className="flex gap-1">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-white/10 rounded-lg text-white/50"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-white/10 rounded-lg text-white/50"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-y-1 text-center">
                        {DAYS.map(d => <div key={d} className="text-[10px] font-medium text-white/40 mb-2">{d.charAt(0)}</div>)}
                        {gridCells.map((cell, i) => {
                            const isT = cell.dateKey === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
                            const isSel = cell.dateKey === dateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                            const cellEvents = activeEventsMap[cell.dateKey] || [];

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(new Date(cell.dateKey))}
                                    className={`aspect-square flex items-center justify-center rounded-full text-[11px] relative mx-auto w-7
                     ${!cell.isCurrentMonth ? 'text-white/20' : 'text-white/80'}
                     ${isSel && !isT ? 'bg-white/20 text-white font-bold' : ''}
                     ${isT ? 'bg-purple-500 text-white font-bold shadow-lg shadow-purple-500/30' : 'hover:bg-white/10'}
                   `}
                                >
                                    <span>{cell.day}</span>
                                    {cellEvents.length > 0 && !isT && (
                                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-white/50" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* My Calendars Sidebar list */}
                <div className="flex-1 mt-4">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">My Calendars</h3>
                        <button className="text-white/30 hover:text-white/80"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-1">
                        {calendars.map(cal => (
                            <button
                                key={cal.id}
                                onClick={() => toggleCalendar(cal.id)}
                                className="flex items-center w-full px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group"
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 border transition-all ${cal.active ? `${COLORS[cal.color].bg} ${COLORS[cal.color].border}` : 'border-white/20'
                                    }`}>
                                    {cal.active && <Check className={`w-3 h-3 ${COLORS[cal.color].text}`} />}
                                </div>
                                <span className={`text-sm font-medium transition-colors ${cal.active ? 'text-white/90' : 'text-white/40'}`}>
                                    {cal.name}
                                </span>
                                <MoreHorizontal className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 text-white/30" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Calendar View */}
            <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                {/* Main Header */}
                <div className="flex items-center justify-between px-6 md:px-8 py-5 md:py-6 border-b border-white/5 relative z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl md:text-4xl font-black text-white px-2">
                            {MONTHS[viewMonth]} {viewYear}
                        </h2>
                        <div className="hidden md:flex items-center gap-2 bg-white/5 rounded-full p-1 border border-white/10 ml-4">
                            <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-white/10 text-white/70 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                            <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-white/10 text-white/70 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                        <button onClick={handleToday} className="hidden md:block px-4 py-2 ml-2 rounded-full border border-white/10 font-bold text-sm text-white/80 hover:bg-white/10 transition-colors">
                            Today
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center bg-white/5 rounded-full px-4 py-2 border border-white/10">
                            <Search className="w-4 h-4 text-white/40 mr-2" />
                            <input type="text" placeholder="Search..." className="bg-transparent text-sm text-white focus:outline-none w-32 placeholder:text-white/30" />
                        </div>
                        <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-sm font-bold text-white/80 hover:bg-white/10 transition-colors">
                            Month <ChevronRight className="w-4 h-4 rotate-90" />
                        </button>
                        {/* Mobile Create */}
                        <button onClick={() => openNewEvent()} className="lg:hidden p-3 rounded-full bg-white text-black shadow-xl">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-white/5 shrink-0 relative z-10">
                    {DAYS.map(day => (
                        <div key={day} className="py-3 text-center text-xs font-bold text-white/40 uppercase tracking-widest border-r border-white/5 last:border-0 border-opacity-50">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid Body */}
                <div className="flex-1 grid grid-cols-7 grid-rows-6 relative z-10 overflow-hidden bg-white/[0.01]">
                    {gridCells.map((cell, i) => {
                        const isT = cell.dateKey === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
                        const dayEvents = activeEventsMap[cell.dateKey] || [];

                        return (
                            <div
                                key={i}
                                className={`border-r border-b border-white/5 group relative transition-colors ${!cell.isCurrentMonth ? 'bg-black/20' : 'hover:bg-white/[0.03]'}`}
                                onClick={() => {
                                    setSelectedDate(new Date(cell.dateKey));
                                    if (cell.isCurrentMonth) openNewEvent(cell.dateKey);
                                }}
                            >
                                <div className="flex flex-col h-full p-1.5 md:p-2">
                                    <div className="flex items-center justify-between mb-1 opacity-70">
                                        <span className={`text-xs md:text-sm p-1.5 w-7 h-7 flex items-center justify-center rounded-full font-medium ${isT ? 'bg-purple-500 text-white shadow-md' :
                                            cell.isCurrentMonth ? 'text-white/80' : 'text-white/30'
                                            }`}>
                                            {cell.day}
                                        </span>
                                    </div>
                                    {/* Event Stack */}
                                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar no-scrollbar pointer-events-none">
                                        {dayEvents.slice(0, 4).map(ev => {
                                            const style = COLORS[ev.color] || COLORS.blue;
                                            return (
                                                <div
                                                    key={ev.id}
                                                    onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                                                    className={`pointer-events-auto truncate px-2 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold ${style.bg} ${style.text} border ${style.border} hover:brightness-125 transition-all cursor-pointer shadow-sm`}
                                                >
                                                    <span className="hidden md:inline mr-1 opacity-70">{ev.startTime}</span>
                                                    {ev.title}
                                                </div>
                                            )
                                        })}
                                        {dayEvents.length > 4 && (
                                            <div className="text-[10px] font-medium text-white/40 px-2 py-0.5">
                                                +{dayEvents.length - 4} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Event Modal */}
            <AnimatePresence>
                {isEventModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsEventModalOpen(false)}
                        />
                        <motion.div
                            layoutId="event-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-[500px] rounded-[32px] bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden"
                            style={{ background: 'linear-gradient(180deg, rgba(30,30,35,1) 0%, rgba(20,20,20,1) 100%)' }}
                        >
                            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/20 to-transparent pointer-events-none" />

                            <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10">
                                <h3 className="text-xl font-bold text-white">{editingEvent ? 'Edit Event' : 'New Event'}</h3>
                                <div className="flex items-center gap-2">
                                    {editingEvent && (
                                        <button onClick={() => deleteEvent(editingEvent.id)} className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors">
                                            <X className="w-5 h-5 absolute opacity-0" />{/* hack to keep size */}
                                            <span className="text-sm font-medium">Delete</span>
                                        </button>
                                    )}
                                    <button onClick={() => setIsEventModalOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-5 relative z-10 max-h-[70vh] overflow-y-auto custom-scrollbar">

                                <input
                                    type="text"
                                    placeholder="Add title"
                                    value={fTitle}
                                    onChange={e => setFTitle(e.target.value)}
                                    className="w-full text-2xl font-black bg-transparent text-white placeholder:text-white/20 border-0 border-b border-white/10 focus:border-purple-500 focus:ring-0 pb-3 transition-colors outline-none"
                                    autoFocus
                                />

                                <div className="flex items-center gap-4 text-white/70 bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <Clock className="w-5 h-5 shrink-0 text-white/40" />
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-white/30 tracking-wider mb-1 block">Date</label>
                                            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full bg-transparent outline-none font-medium [color-scheme:dark]" />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] uppercase font-bold text-white/30 tracking-wider mb-1 block">Start</label>
                                                <input type="time" value={fStart} onChange={e => setFStart(e.target.value)} className="w-full bg-transparent outline-none font-medium [color-scheme:dark]" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] uppercase font-bold text-white/30 tracking-wider mb-1 block">End</label>
                                                <input type="time" value={fEnd} onChange={e => setFEnd(e.target.value)} className="w-full bg-transparent outline-none font-medium [color-scheme:dark]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-4">
                                        <CalendarIcon className="w-5 h-5 text-white/30" />
                                        <select value={fCalId} onChange={e => setFCalId(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 appearance-none">
                                            {calendars.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <MapPin className="w-5 h-5 text-white/30" />
                                        <input type="text" placeholder="Add location" value={fLoc} onChange={e => setFLoc(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-purple-500/50" />
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <AlignLeft className="w-5 h-5 text-white/30 mt-3" />
                                        <textarea placeholder="Add description" rows={3} value={fDesc} onChange={e => setFDesc(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-purple-500/50 resize-none custom-scrollbar" />
                                    </div>
                                </div>

                            </div>

                            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3 relative z-10">
                                <button onClick={() => setIsEventModalOpen(false)} className="px-6 py-3 rounded-xl text-white/60 font-medium hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={saveEvent} className="px-8 py-3 rounded-xl bg-white text-black font-bold shadow-lg hover:scale-105 transition-all">
                                    Save
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
