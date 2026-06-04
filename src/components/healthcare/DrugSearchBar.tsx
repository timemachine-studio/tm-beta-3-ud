import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Pill, Stethoscope, ChevronDown } from 'lucide-react';
import { getAutocompleteSuggestions, DrugSearchResult, SearchCategory } from '../../services/healthcare/healthcareService';

const CATEGORY_OPTIONS: { value: SearchCategory; label: string }[] = [
  { value: 'brand', label: 'Drug Name' },
  { value: 'generic', label: 'Generic' },
  { value: 'indication', label: 'Symptom' },
];

interface DrugSearchBarProps {
  onSelect: (drug: DrugSearchResult) => void;
  onSearch: (query: string, category: SearchCategory) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

export function DrugSearchBar({ onSelect, onSearch, placeholder }: DrugSearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('brand');
  const [suggestions, setSuggestions] = useState<DrugSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback(async (q: string, cat: SearchCategory) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const results = await getAutocompleteSuggestions(q, cat);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setFocusedIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val, category);
    }, DEBOUNCE_MS);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    // Cancel any pending debounce so it doesn't re-open the dropdown
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSuggestions([]);
    setIsOpen(false);
    onSearch(query.trim(), category);
  };

  const handleSelect = (drug: DrugSearchResult) => {
    setQuery(drug.brand_name);
    setIsOpen(false);
    setSuggestions([]);
    onSelect(drug);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[focusedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div
          className={`
            flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-3 sm:px-5 sm:py-4 rounded-2xl
            bg-white/8 border border-white/15
            backdrop-blur-xl
            transition-all duration-200
            ${isOpen ? 'border-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.15)]' : 'hover:border-white/25'}
          `}
        >
          {/* Category selector — full width on mobile, inline on sm+ */}
          <div className="flex-shrink-0 relative">
            <select
              value={category}
              onChange={(e) => {
                const newCat = e.target.value as SearchCategory;
                setCategory(newCat);
                if (query.trim().length >= 2) {
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  fetchSuggestions(query, newCat);
                }
              }}
              className="appearance-none w-full sm:w-auto bg-white/10 border border-white/15 rounded-xl pl-3 pr-7 py-1.5 text-white text-xs font-medium cursor-pointer outline-none hover:bg-white/15 focus:border-emerald-400/50 transition-colors"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
          </div>

          {/* Divider — hidden on mobile */}
          <div className="hidden sm:block w-px h-6 bg-white/10 flex-shrink-0" />

          {/* Search input row */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className="flex-shrink-0">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-white/40" />
              )}
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => query.trim().length >= 2 && suggestions.length > 0 && setIsOpen(true)}
              placeholder={placeholder ?? (
                category === 'brand' ? 'Search drug / brand name...' :
                category === 'generic' ? 'Search generic / ingredient...' :
                'Search symptom or condition...'
              )}
              className="flex-1 min-w-0 bg-transparent text-white placeholder-white/30 text-sm sm:text-base outline-none"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Clear button */}
            <AnimatePresence>
              {query.length > 0 && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={handleClear}
                  className="flex-shrink-0 p-1 rounded-full text-white/30 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Search button */}
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
            >
              Search
            </motion.button>
          </div>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-xl bg-black/80 shadow-2xl"
          >
            {suggestions.map((drug, i) => (
              <motion.button
                key={`${drug.brand_id}-${i}`}
                type="button"
                onClick={() => handleSelect(drug)}
                className={`
                  w-full flex items-start gap-3 px-5 py-3.5 text-left
                  transition-colors duration-100
                  ${focusedIndex === i ? 'bg-emerald-500/15' : 'hover:bg-white/8'}
                  ${i < suggestions.length - 1 ? 'border-b border-white/5' : ''}
                `}
              >
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {drug.indication ? (
                    <Stethoscope className="w-4 h-4 text-emerald-400/70" />
                  ) : (
                    <Pill className="w-4 h-4 text-emerald-400/70" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{drug.brand_name}</span>
                    {drug.strength && (
                      <span className="text-emerald-400/80 text-xs">{drug.strength}</span>
                    )}
                    {drug.form && (
                      <span className="text-white/40 text-xs">{drug.form}</span>
                    )}
                  </div>
                  <div className="text-white/40 text-xs mt-0.5 truncate">
                    {drug.generic_name}
                    {drug.manufacturer ? ` · ${drug.manufacturer}` : ''}
                  </div>
                  {drug.indication && (
                    <div className="text-white/30 text-xs mt-0.5 truncate">
                      {drug.indication.slice(0, 80)}{drug.indication.length > 80 ? '…' : ''}
                    </div>
                  )}
                </div>

                {/* Price badge */}
                {drug.price && (
                  <div className="flex-shrink-0 text-xs text-emerald-400/60 font-mono mt-0.5">
                    ৳{drug.price}
                  </div>
                )}
              </motion.button>
            ))}

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-white/20 text-xs">Press Enter to see all results</span>
              <span className="text-white/20 text-xs">{suggestions.length} found</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
