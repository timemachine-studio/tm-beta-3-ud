import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChefHat, Clock, ArrowRight, Star, Heart, Flame, Sparkles, X } from 'lucide-react';
import { ChefAIKitchen } from './ChefAIKitchen';
import { supabase } from '../../lib/supabase';

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
});

export function CookBookPage() {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [isKitchenMode, setIsKitchenMode] = useState(false);

    // Kitchen State
    const [recipes, setRecipes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);

    const categories = ['All', 'Breakfast', 'Dinner', 'Healthy', 'Italian', 'Japanese'];

    useEffect(() => {
        const fetchRecipes = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('kitchen_recipes')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) {
                    throw error;
                }
                setRecipes(data || []);
            } catch (error) {
                console.error('Error fetching recipes:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecipes();
    }, []);

    const filteredRecipes = recipes.filter(recipe => {
        const matchesSearch = recipe.title.toLowerCase().includes(search.toLowerCase());
        const tags = recipe.tags || [];
        const matchesCategory = activeCategory === 'All' || tags.includes(activeCategory);
        return matchesSearch && matchesCategory;
    });

    const featuredRecipe = recipes.find(r => r.featured);

    return (
        <div className="relative w-full">
            <AnimatePresence mode="wait">
                {isKitchenMode ? (
                    <ChefAIKitchen
                        key="kitchen"
                        onClose={() => setIsKitchenMode(false)}
                    />
                ) : (
                    <motion.div
                        key="cookbook"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.98 }}
                        transition={{ duration: 0.5 }}
                        className="px-6 sm:px-10 max-w-7xl mx-auto w-full pb-32"
                    >
                        {/* Header & Search */}
                        <motion.div {...fadeUp(0.1)} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                            <div>
                                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
                                    Kitchen
                                </h1>
                                <p className="text-white/40 text-lg">
                                    Discover premium, curated recipes for every occasion.
                                </p>
                            </div>
                            <div className="relative w-full md:w-80 group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-white/30 group-focus-within:text-orange-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-11 pr-4 py-3 border border-white/10 rounded-2xl leading-5 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all backdrop-blur-md shadow-inner"
                                    placeholder="Search recipes, ingredients..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </motion.div>

                        {/* Featured Recipe Hero */}
                        {featuredRecipe && search === '' && activeCategory === 'All' && (
                            <motion.div
                                {...fadeUp(0.2)}
                                onClick={() => setSelectedRecipe(featuredRecipe)}
                                className="relative w-full h-[400px] md:h-[500px] rounded-[32px] overflow-hidden mb-16 group cursor-pointer"
                            >
                                <img
                                    src={featuredRecipe.image}
                                    alt={featuredRecipe.title}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                                <div className="absolute top-6 left-6 px-3 py-1.5 rounded-full bg-orange-500/90 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5">
                                    <Flame className="w-3.5 h-3.5" /> Featured Recipe
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                                    <div className="max-w-3xl">
                                        <div className="flex gap-2 mb-4">
                                            {(featuredRecipe.tags || []).map((tag: string) => (
                                                <span key={tag} className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white/90 text-sm font-medium border border-white/10">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
                                            {featuredRecipe.title}
                                        </h2>
                                        <div className="flex items-center gap-6 text-white/80 text-sm font-medium">
                                            <span className="flex items-center gap-2"><ChefHat className="w-4 h-4 text-orange-400" /> {featuredRecipe.chef}</span>
                                            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-orange-400" /> {featuredRecipe.time}</span>
                                            <span className="flex items-center gap-2"><Star className="w-4 h-4 text-orange-400 fill-orange-400" /> {featuredRecipe.rating}</span>
                                        </div>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="absolute bottom-8 right-8 md:bottom-12 md:right-12 w-14 h-14 rounded-full bg-white flex items-center justify-center text-black hover:bg-orange-400 hover:text-white transition-colors shadow-2xl"
                                    >
                                        <ArrowRight className="w-6 h-6" />
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {/* Categories */}
                        <motion.div {...fadeUp(0.3)} className="flex items-center gap-3 overflow-x-auto pb-6 mb-8 custom-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${activeCategory === cat
                                        ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </motion.div>

                        {/* Recipe Grid */}
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Sparkles className="w-8 h-8 text-white/50 animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <AnimatePresence mode="popLayout">
                                    {filteredRecipes.map((recipe, i) => (
                                        <motion.div
                                            key={recipe.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={{ duration: 0.4, delay: i * 0.05 }}
                                            onClick={() => setSelectedRecipe(recipe)}
                                            className="group cursor-pointer relative rounded-3xl bg-white/5 border border-white/10 overflow-hidden hover:border-white/20 transition-all hover:shadow-2xl hover:shadow-orange-500/10"
                                        >
                                            <div className="relative h-64 overflow-hidden">
                                                <img
                                                    src={recipe.image}
                                                    alt={recipe.title}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                                                <button className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-pink-500 hover:bg-white transition-all border border-white/10" onClick={(e) => e.stopPropagation()}>
                                                    <Heart className="w-4 h-4" />
                                                </button>
                                                <div className="absolute top-4 left-4 flex gap-1.5">
                                                    <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-bold">
                                                        {recipe.difficulty}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex items-center justify-between mb-3 text-white/50 text-xs font-medium uppercase tracking-wider">
                                                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {recipe.time}</span>
                                                    <span className="flex items-center gap-1.5 text-orange-400"><Star className="w-3.5 h-3.5 fill-orange-400" /> {recipe.rating}</span>
                                                </div>
                                                <h3 className="text-xl font-bold text-white mb-2 leading-tight group-hover:text-orange-400 transition-colors">
                                                    {recipe.title}
                                                </h3>
                                                <p className="text-white/40 text-sm mb-5 flex items-center gap-2">
                                                    <ChefHat className="w-4 h-4" /> By {recipe.chef}
                                                </p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {(recipe.tags || []).slice(0, 2).map((tag: string) => (
                                                        <span key={tag} className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-white/60">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {(recipe.tags || []).length > 2 && (
                                                        <span className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-white/40">
                                                            +{(recipe.tags || []).length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}

                        {!isLoading && filteredRecipes.length === 0 && (
                            <div className="text-center py-20">
                                <ChefHat className="w-16 h-16 text-white/10 mx-auto mb-4" />
                                <h3 className="text-xl font-medium text-white/40">No recipes found</h3>
                                <p className="text-white/20 mt-2">Try adjusting your search or category filter, or populate Supabase.</p>
                            </div>
                        )}

                        {/* Floating AI Button */}
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsKitchenMode(true)}
                            className="fixed bottom-10 inset-x-0 mx-auto w-fit px-8 py-4 rounded-full bg-gradient-to-r from-orange-600/90 to-pink-600/90 backdrop-blur-xl border border-white/20 shadow-[0_0_40px_rgba(234,88,12,0.4)] text-white font-bold flex items-center justify-center gap-3 group z-40 hover:from-orange-500/90 hover:to-pink-500/90 transition-all"
                        >
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            Ask TimeMachine
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Recipe Detail Modal */}
            <AnimatePresence>
                {selectedRecipe && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedRecipe(null)}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-4xl bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl my-auto"
                        >
                            <div className="relative h-64 sm:h-80 md:h-96 w-full">
                                <img
                                    src={selectedRecipe.image}
                                    alt={selectedRecipe.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-transparent" />
                                <button
                                    onClick={() => setSelectedRecipe(null)}
                                    className="absolute top-6 right-6 p-2 rounded-full bg-black/50 backdrop-blur-md text-white/70 hover:text-white hover:bg-white/20 transition-all border border-white/10"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="absolute bottom-6 left-6 right-6">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {(selectedRecipe.tags || []).map((tag: string) => (
                                            <span key={tag} className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white/90 text-sm font-medium border border-white/10">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
                                        {selectedRecipe.title}
                                    </h2>
                                </div>
                            </div>

                            <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                                <div className="md:col-span-1 border-r-0 md:border-r border-white/10 pr-0 md:pr-10">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <Flame className="w-5 h-5 text-orange-400" /> Details
                                    </h3>
                                    <div className="space-y-4 text-white/70">
                                        <div className="flex items-center gap-3">
                                            <ChefHat className="w-5 h-5 text-white/40" />
                                            <span>{selectedRecipe.chef}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-white/40" />
                                            <span>{selectedRecipe.time}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Star className="w-5 h-5 text-orange-400 fill-orange-400" />
                                            <span>{selectedRecipe.rating} / 5.0</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-1 rounded-md bg-white/10 text-xs font-bold uppercase tracking-wider text-white">
                                                {selectedRecipe.difficulty}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mt-10 mb-6 flex items-center gap-2">
                                        Ingredients
                                    </h3>
                                    <ul className="space-y-3">
                                        {(selectedRecipe.ingredients || []).map((ing: string, i: number) => (
                                            <li key={i} className="flex gap-3 text-white/80">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0"></span>
                                                <span className="flex-1">{ing}</span>
                                            </li>
                                        ))}
                                        {(!selectedRecipe.ingredients || selectedRecipe.ingredients.length === 0) && (
                                            <li className="text-white/40 text-sm italic">Ingredients not available.</li>
                                        )}
                                    </ul>
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
                                        <ChefHat className="w-6 h-6 text-orange-400" /> Directions
                                    </h3>
                                    <div className="space-y-8">
                                        {(selectedRecipe.steps || []).map((step: string, i: number) => (
                                            <div key={i} className="flex gap-5">
                                                <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm">
                                                    {i + 1}
                                                </div>
                                                <p className="text-white/80 leading-relaxed pt-1">
                                                    {step}
                                                </p>
                                            </div>
                                        ))}
                                        {(!selectedRecipe.steps || selectedRecipe.steps.length === 0) && (
                                            <p className="text-white/40 italic">Directions not available.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
