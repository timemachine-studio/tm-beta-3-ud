import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Pill,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronRight,
  X,
  User,
  Users,
  Beaker,
  Package,
  Building2,
  Search,
  Stethoscope,
  Repeat2,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DrugSearchBar } from './DrugSearchBar';
import { DrugSearchResult, SearchCategory, searchDrugs, getAlternativeBrands } from '../../services/healthcare/healthcareService';

// ─── Detail field helper ──────────────────────────────────────────────────────
function DetailSection({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  accent?: string;
}) {
  if (!value) return null;
  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest ${accent ?? 'text-white/40'}`}>
        {icon}
        {label}
      </div>
      <p className="text-white/80 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

// ─── Drug Result Card ─────────────────────────────────────────────────────────
function DrugCard({
  drug,
  onSelect,
}: {
  drug: DrugSearchResult;
  onSelect: () => void;
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onSelect}
      className="w-full text-left p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-white/8 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Brand + form + strength */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-white font-semibold text-base">{drug.brand_name}</span>
            {drug.strength && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs">
                {drug.strength}
              </span>
            )}
            {drug.form && (
              <span className="px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/50 text-xs">
                {drug.form}
              </span>
            )}
          </div>

          {/* Generic */}
          <p className="text-white/50 text-sm mb-2">
            Generic: <span className="text-white/70">{drug.generic_name}</span>
          </p>

          {/* Manufacturer + pack */}
          <div className="flex items-center gap-3 text-white/35 text-xs">
            {drug.manufacturer && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {drug.manufacturer}
              </span>
            )}
            {drug.pack_size && (
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {drug.pack_size}
              </span>
            )}
          </div>

          {/* Indication snippet */}
          {drug.indication && (
            <p className="mt-2 text-white/30 text-xs line-clamp-2 leading-relaxed">
              {drug.indication}
            </p>
          )}
        </div>

        {/* Price + arrow */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {drug.price && (
            <span className="text-emerald-400 font-mono text-sm">
              ৳{drug.price}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400/60 transition-colors" />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Alternative Brands Section ──────────────────────────────────────────────
function AlternativeBrandsSection({
  drug,
  onSelectAlternative,
}: {
  drug: DrugSearchResult;
  onSelectAlternative: (alt: DrugSearchResult) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<DrugSearchResult[]>([]);
  const [filtered, setFiltered] = useState<DrugSearchResult[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAlternatives = useCallback(async () => {
    if (hasLoaded) return;
    setIsLoading(true);
    try {
      const data = await getAlternativeBrands(drug.generic_id, drug.brand_id);
      setAlternatives(data);
      setFiltered(data);
      setHasLoaded(true);
    } catch {
      setAlternatives([]);
      setFiltered([]);
    } finally {
      setIsLoading(false);
    }
  }, [drug.generic_id, drug.brand_id, hasLoaded]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasLoaded) loadAlternatives();
  };

  const handleFilter = (val: string) => {
    setFilter(val);
    if (filterTimer.current) clearTimeout(filterTimer.current);
    if (!val.trim()) {
      setFiltered(alternatives);
      return;
    }
    filterTimer.current = setTimeout(async () => {
      // If local list is large enough, filter client-side; otherwise fetch from server
      const q = val.toLowerCase();
      const local = alternatives.filter((a) => a.brand_name.toLowerCase().includes(q));
      if (local.length > 0) {
        // Re-sort: exact > prefix > substring
        local.sort((a, b) => {
          const score = (r: DrugSearchResult) => {
            const n = r.brand_name.toLowerCase();
            if (n === q) return 3;
            if (n.startsWith(q)) return 2;
            return 1;
          };
          return score(b) - score(a);
        });
        setFiltered(local);
      } else {
        // Fetch from server for broader search
        const data = await getAlternativeBrands(drug.generic_id, drug.brand_id, val);
        setFiltered(data);
      }
    }, 200);
  };

  useEffect(() => {
    return () => { if (filterTimer.current) clearTimeout(filterTimer.current); };
  }, []);

  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={handleToggle}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
      >
        <Repeat2 className="w-4 h-4" />
        {isOpen ? 'Hide alternative brands' : 'See alternative brands'}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* Search/filter bar */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/6 border border-white/10">
                <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => handleFilter(e.target.value)}
                  placeholder="Filter alternative brands..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none"
                  autoComplete="off"
                />
                {filter && (
                  <button onClick={() => { setFilter(''); setFiltered(alternatives); }} className="text-white/30 hover:text-white/60">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-white/40 text-xs">Loading alternatives…</span>
                </div>
              )}

              {/* Results list */}
              {!isLoading && filtered.length > 0 && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  <p className="text-white/25 text-xs px-1">
                    {filtered.length} alternative brand{filtered.length !== 1 ? 's' : ''} with {drug.generic_name}
                  </p>
                  {filtered.map((alt, i) => (
                    <motion.button
                      key={`${alt.brand_id}-${i}`}
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.02 } }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectAlternative(alt)}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-emerald-500/25 hover:bg-white/6 transition-all text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium text-sm">{alt.brand_name}</span>
                          {alt.strength && (
                            <span className="text-emerald-400/70 text-xs">{alt.strength}</span>
                          )}
                          {alt.form && (
                            <span className="text-white/35 text-xs">{alt.form}</span>
                          )}
                        </div>
                        {alt.manufacturer && (
                          <p className="text-white/30 text-xs mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {alt.manufacturer}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {alt.price && (
                          <span className="text-emerald-400/60 font-mono text-xs">৳{alt.price}</span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-emerald-400/50 transition-colors" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && hasLoaded && filtered.length === 0 && (
                <div className="text-center py-6">
                  <Pill className="w-6 h-6 text-white/15 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">
                    {filter ? 'No matching brands found.' : 'No alternative brands available.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DrugDetailPanel({
  drug,
  onClose,
  onSelectAlternative,
}: {
  drug: DrugSearchResult;
  onClose: () => void;
  onSelectAlternative: (alt: DrugSearchResult) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto
                 bg-black/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/8 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-bold text-xl">{drug.brand_name}</h2>
            <p className="text-white/50 text-sm mt-0.5">{drug.generic_name}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Quick badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {drug.form && (
            <span className="px-2.5 py-1 rounded-full bg-white/8 border border-white/10 text-white/60 text-xs">
              {drug.form}
            </span>
          )}
          {drug.strength && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs">
              {drug.strength}
            </span>
          )}
          {drug.pregnancy_cat && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-600/30 text-emerald-300 text-xs">
              Pregnancy: Cat {drug.pregnancy_cat}
            </span>
          )}
          {drug.price && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-mono">
              ৳{drug.price}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 space-y-6">
        {(drug.manufacturer || drug.pack_size) && (
          <div className="p-4 rounded-xl bg-white/4 border border-white/8 flex gap-6">
            {drug.manufacturer && (
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Manufacturer</p>
                <p className="text-white/80 text-sm">{drug.manufacturer}</p>
              </div>
            )}
            {drug.pack_size && (
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Pack Size</p>
                <p className="text-white/80 text-sm">{drug.pack_size}</p>
              </div>
            )}
          </div>
        )}

        <DetailSection
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Indications / Uses"
          value={drug.indication}
          accent="text-emerald-400/70"
        />
        <DetailSection
          icon={<User className="w-3.5 h-3.5" />}
          label="Adult Dose"
          value={drug.adult_dose}
          accent="text-blue-400/70"
        />
        <DetailSection
          icon={<Users className="w-3.5 h-3.5" />}
          label="Child Dose"
          value={drug.child_dose}
          accent="text-cyan-400/70"
        />
        <DetailSection
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          label="Precautions"
          value={drug.precaution}
          accent="text-amber-400/70"
        />
        <DetailSection
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          label="Side Effects"
          value={drug.side_effect}
          accent="text-rose-400/70"
        />

        {/* Alternative Brands */}
        <AlternativeBrandsSection drug={drug} onSelectAlternative={onSelectAlternative} />

        {/* Disclaimer */}
        <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 flex gap-3">
          <Info className="w-4 h-4 text-amber-400/70 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200/60 text-xs leading-relaxed">
            For reference only. Always consult a qualified healthcare professional
            before taking any medication. Do not self-medicate.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function HealthcarePage() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DrugSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (query: string, category?: SearchCategory) => {
    if (!query || isSearching) return;
    setIsSearching(true);
    setHasSearched(true);
    setLastQuery(query);
    setSelectedDrug(null);
    try {
      const data = await searchDrugs(query, category);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={`h-screen overflow-y-auto bg-gradient-to-t from-green-950 to-black to-50% ${theme.text} relative`}>
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="absolute bottom-[10%] right-[-15%] w-[500px] h-[500px] rounded-full bg-green-500/5 blur-3xl" />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-teal-500/4 blur-3xl" />
      </div>

      <div className="relative z-10 w-full min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="px-6 sm:px-10 pt-8 pb-0">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm">Back</span>
          </motion.button>
        </div>

        {/* Hero — full width, centered */}
        <div className="flex flex-col items-center justify-center px-4 pt-16 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
              TimeMachine Healthcare
            </h1>
            <p className="text-white/40 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
              Search by brand, generic name, symptom, or condition — get dosage &amp; drug info instantly.
            </p>
          </motion.div>

          {/* Search bar — wide */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full max-w-2xl"
          >
            <DrugSearchBar
              onSearch={handleSearch}
              onSelect={(drug) => {
                setResults([drug]);
                setSelectedDrug(drug);
                setHasSearched(true);
                setLastQuery(drug.brand_name);
              }}
            />
            <p className="text-center text-white/20 text-xs mt-3">
              Try "Napa", "Paracetamol", "fever", "antibiotic", "infection"…
            </p>
          </motion.div>
        </div>

        {/* Results area — full width with horizontal padding */}
        <div className="flex-1 px-6 sm:px-10 lg:px-16 pb-16">
          {/* Loading */}
          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20 gap-3"
              >
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
                <span className="text-white/40 text-sm">Searching drug database…</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          {!isSearching && hasSearched && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between mb-4"
              >
                <p className="text-white/30 text-sm">
                  {results.length > 0
                    ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${lastQuery}"`
                    : `No results for "${lastQuery}"`}
                </p>
                {results.length > 0 && (
                  <span className="text-white/20 text-xs hidden sm:block">Select a result for full details</span>
                )}
              </motion.div>

              {/* Empty state */}
              {results.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  <Search className="w-10 h-10 text-white/15 mx-auto mb-4" />
                  <p className="text-white/30 text-sm mb-1">No drugs found.</p>
                  <p className="text-white/20 text-xs">Try a different spelling, brand name, or symptom.</p>
                </motion.div>
              )}

              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {results.map((drug, i) => (
                  <DrugCard
                    key={`${drug.brand_id}-${i}`}
                    drug={drug}
                    onSelect={() => setSelectedDrug(drug)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Initial empty state hint cards */}
          {!hasSearched && !isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.2 } }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            >
              {[
                {
                  icon: <Pill className="w-5 h-5 text-emerald-400" />,
                  title: 'Brand Search',
                  desc: 'Search by brand name like "Napa" or "Fimoxyl"',
                },
                {
                  icon: <Beaker className="w-5 h-5 text-teal-400" />,
                  title: 'Generic Search',
                  desc: 'Find by active ingredient like "Paracetamol" or "Amoxicillin"',
                },
                {
                  icon: <Stethoscope className="w-5 h-5 text-green-400" />,
                  title: 'Symptom Search',
                  desc: 'Describe a condition like "fever", "infection", or "pain"',
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.25 + i * 0.06 } }}
                  className="p-5 rounded-2xl bg-white/4 border border-white/8 text-center"
                >
                  <div className="flex justify-center mb-3">{card.icon}</div>
                  <p className="text-white/70 text-sm font-medium mb-1">{card.title}</p>
                  <p className="text-white/30 text-xs leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Ask TimeMachine button — hidden on mobile (shown as floating below) */}
        <div className="hidden sm:flex justify-center pb-6 px-4">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/', { state: { healthcareMode: true } })}
            className="flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-medium text-emerald-200 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 95, 70, 0.12))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            <MessageCircle className="w-4.5 h-4.5" />
            Ask TimeMachine
          </motion.button>
        </div>

        {/* Footer disclaimer */}
        <p className="text-center text-white/15 text-xs pb-20 sm:pb-8 px-4">
          TimeMachine Healthcare is for informational purposes only. Always consult a licensed physician or pharmacist before starting any medication.
        </p>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedDrug && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDrug(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <DrugDetailPanel
              drug={selectedDrug}
              onClose={() => setSelectedDrug(null)}
              onSelectAlternative={(alt) => setSelectedDrug(alt)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Floating Ask TimeMachine button — mobile only */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/', { state: { healthcareMode: true } })}
        className="sm:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium text-emerald-200 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 95, 70, 0.2))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 4px 24px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <MessageCircle className="w-4 h-4" />
        Ask TimeMachine
      </motion.button>
    </div>
  );
}
