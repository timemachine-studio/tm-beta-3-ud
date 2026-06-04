import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChefHat, Clock, Flame, ArrowLeft, Plus, X, Search, Utensils } from 'lucide-react';
import { generateAIResponse } from '../../services/ai/aiProxyService';

interface ChefAIKitchenProps {
    onClose: () => void;
}

const steps = [
    "Analyzing flavor profile...",
    "Consulting culinary archives...",
    "Balancing ingredients...",
    "Connecting to kitchen orchestrator...",
    "Plating the digital dish..."
];

const CRAVINGS = ['Healthy', 'Comfort Food', 'Spicy', 'Sweet', 'High Protein', 'Vegan', 'Quick Bite'];

export function ChefAIKitchen({ onClose }: ChefAIKitchenProps) {
    const [ingredients, setIngredients] = useState<string[]>([]);
    const [ingredientInput, setIngredientInput] = useState('');
    const [activeCraving, setActiveCraving] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [loadingStep, setLoadingStep] = useState(0);

    const handleAddIngredient = () => {
        if (ingredientInput.trim() && !ingredients.includes(ingredientInput.trim())) {
            setIngredients([...ingredients, ingredientInput.trim()]);
            setIngredientInput('');
        }
    };

    const removeIngredient = (ing: string) => {
        setIngredients(ingredients.filter(i => i !== ing));
    };

    const handleCook = async () => {
        setIsGenerating(true);
        setResult(null);
        setLoadingStep(0);

        // Simulate multi-step AI generation visually
        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                setLoadingStep(currentStep);
            }
        }, 2000);

        try {
            const systemContent = `You are the TimeMachine Culinary Engine. Create a highly creative, delicious recipe.
Ingredients available: ${ingredients.length > 0 ? ingredients.join(', ') : 'None, suggest a random dish'}
Cravings/Vibe: ${activeCraving || 'Surprise me'}
Additional Instructions: ${prompt || 'None'}

CRITICAL: You MUST return ONLY a valid JSON object. Do not include markdown code blocks, backticks, or any other text.
The JSON must perfectly match this structure:
{
  "title": "Creative Recipe Name (e.g., Quantum Truffle Pasta)",
  "description": "A punchy, delicious Chef's Note describing the dish.",
  "time": "Total time (e.g., 30 min)",
  "difficulty": "Easy, Medium, or Hard",
  "calories": "Estimated calories (e.g., 450 kcal)",
  "ingredients": [
    { "name": "Ingredient Name", "amount": "Quantity", "checked": false }
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ]
}`;

            // Call AI
            const response = await generateAIResponse([
                { id: 1, content: systemContent, isAI: false, hasAnimated: false }
            ], undefined, '', 'pro');

            // Parse response
            let finalContent = response.content;

            // Strip markdown formatting if AI still includes it
            if (finalContent.includes('\`\`\`json')) {
                finalContent = finalContent.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            } else if (finalContent.includes('\`\`\`')) {
                finalContent = finalContent.replace(/\`\`\`/g, '').trim();
            }

            // Sometimes there's conversational text before/after the JSON
            const jsonStart = finalContent.indexOf('{');
            const jsonEnd = finalContent.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                finalContent = finalContent.substring(jsonStart, jsonEnd + 1);
            }

            const parsedResult = JSON.parse(finalContent);

            // Generate a dynamic image URL using the internal image API (uses zimage model)
            const imagePrompt = `professional food photography of ${parsedResult.title}, appetizing, 4k, cinematic lighting, highly detailed`;
            const imageUrl = `/api/image?prompt=${encodeURIComponent(imagePrompt)}&process=create&persona=pro&orientation=portrait`;

            parsedResult.image = imageUrl;

            clearInterval(interval);
            setLoadingStep(steps.length - 1);

            setTimeout(() => {
                setIsGenerating(false);
                setResult(parsedResult);
            }, 800);

        } catch (error) {
            console.error("AI Generation Error:", error);
            clearInterval(interval);
            setIsGenerating(false);
            alert("The TimeMachine kitchen is currently overloaded. Please try again.");
        }
    };

    // toggleCheckIngredient removed as it is no longer used

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full min-h-[calc(100vh-140px)] bg-black/40 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative z-20 backdrop-blur-3xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-white/5 relative z-30 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                            <h2 className="text-2xl font-black text-white tracking-tight leading-none">TimeMachine Chef</h2>
                        </div>
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">AI Culinary Engine</p>
                    </div>
                </div>

                {result && !isGenerating && (
                    <button
                        onClick={() => setResult(null)}
                        className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors border border-white/10 flex items-center gap-2"
                    >
                        <Utensils className="w-4 h-4" /> Start Over
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                <AnimatePresence mode="wait">

                    {/* Input Phase */}
                    {!isGenerating && !result && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.4 }}
                            className="p-8 md:p-12 lg:p-16 max-w-5xl mx-auto w-full"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                {/* Left Col: Forms */}
                                <div className="space-y-12">

                                    {/* Ingredients Basket */}
                                    <section>
                                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                            Ingredients Basket
                                        </h3>
                                        <p className="text-white/40 text-sm mb-6">What do you have in your fridge right now?</p>

                                        <div className="relative mb-4">
                                            <input
                                                type="text"
                                                value={ingredientInput}
                                                onChange={(e) => setIngredientInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddIngredient();
                                                }}
                                                placeholder="Add an ingredient (e.g., Chicken breast)"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all shadow-inner"
                                            />
                                            <button
                                                onClick={handleAddIngredient}
                                                className="absolute right-2 top-2 bottom-2 aspect-square rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Basket visual */}
                                        <div className="min-h-[100px] p-5 rounded-[24px] bg-black/30 border border-white/5 backdrop-blur-md shadow-inner flex flex-wrap gap-2 items-start content-start">
                                            {ingredients.length === 0 ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-white/20 pt-4">
                                                    <Search className="w-6 h-6 mb-2 opacity-50" />
                                                    <span className="text-xs uppercase font-semibold tracking-wider">Basket is empty</span>
                                                </div>
                                            ) : (
                                                <AnimatePresence>
                                                    {ingredients.map(ing => (
                                                        <motion.div
                                                            key={ing}
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.8 }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-200 text-sm font-medium pr-1.5"
                                                        >
                                                            <span>{ing}</span>
                                                            <button
                                                                onClick={() => removeIngredient(ing)}
                                                                className="w-5 h-5 rounded-full bg-orange-500/20 hover:bg-orange-500/40 flex items-center justify-center transition-colors text-orange-200"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    </section>

                                    {/* Cravings */}
                                    <section>
                                        <h3 className="text-xl font-bold text-white mb-2">Cravings</h3>
                                        <p className="text-white/40 text-sm mb-6">What vibe are you going for?</p>
                                        <div className="flex flex-wrap gap-3">
                                            {CRAVINGS.map(craving => (
                                                <button
                                                    key={craving}
                                                    onClick={() => setActiveCraving(craving === activeCraving ? null : craving)}
                                                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border ${activeCraving === craving
                                                        ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.4)]'
                                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                                        }`}
                                                >
                                                    {craving}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                {/* Right Col: Prompt & Action */}
                                <div className="space-y-12">
                                    <section>
                                        <h3 className="text-xl font-bold text-white mb-2">Additional Instructions</h3>
                                        <p className="text-white/40 text-sm mb-6">Any dietary restrictions or wild concepts?</p>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="E.g., Make it low carb but completely decadent. Needs to look like it came from the year 2077."
                                            className="w-full h-40 bg-white/5 border border-white/10 rounded-3xl py-5 px-6 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all shadow-inner resize-none custom-scrollbar"
                                        />
                                    </section>

                                    <div className="pt-4">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleCook}
                                            className="w-full py-5 rounded-2xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 text-white font-black text-lg uppercase tracking-widest shadow-[0_0_40px_rgba(236,72,153,0.4)] hover:shadow-[0_0_60px_rgba(236,72,153,0.6)] transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                                        >
                                            {/* Shine effect */}
                                            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                                            <ChefHat className="w-6 h-6" /> Begin Cooking
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Generating State */}
                    {isGenerating && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/20 z-40 backdrop-blur-md"
                        >
                            <div className="relative w-40 h-40 mb-12 flex items-center justify-center">
                                {/* Air persona style glowing rings */}
                                <motion.div
                                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-orange-500 opacity-50 blur-[2px]"
                                />
                                <motion.div
                                    animate={{ rotate: -360, scale: [1, 1.2, 1] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-2 rounded-full border-b-2 border-l-2 border-pink-500 opacity-50 blur-[2px]"
                                />
                                <motion.div
                                    animate={{ rotate: 180, scale: [1, 1.15, 1] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-4 rounded-full border-t-2 border-4 border-purple-500 opacity-30 blur-[4px]"
                                />

                                {/* Core orb */}
                                <div className="absolute inset-10 rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-500 blur-[20px] animate-pulse opacity-70" />

                                <ChefHat className="w-12 h-12 text-white relative z-10 animate-bounce" />
                            </div>

                            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">TimeMachine is Cooking</h3>
                            <div className="h-8">
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={loadingStep}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="text-pink-400 font-bold uppercase tracking-widest text-sm"
                                    >
                                        {steps[loadingStep]}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}

                    {/* Result State */}
                    {result && !isGenerating && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6 }}
                            className="w-full max-w-4xl mx-auto bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl my-8 md:my-12"
                        >
                            <div className="relative h-64 sm:h-80 md:h-96 w-full">
                                <img
                                    src={result.image}
                                    alt={result.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-transparent" />

                                <div className="absolute top-6 left-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-xl text-white text-xs font-bold uppercase tracking-widest border border-white/20 flex items-center gap-2 shadow-xl">
                                    <Sparkles className="w-4 h-4 text-pink-400" /> AI Generated
                                </div>

                                <div className="absolute bottom-6 left-6 right-6">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white/90 text-sm font-medium border border-white/10">
                                            {activeCraving || 'Surprise'}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
                                        {result.title}
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
                                            <span>TimeMachine AI</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-white/40" />
                                            <span>{result.time}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Flame className="w-5 h-5 text-orange-400" />
                                            <span>{result.calories}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-1 rounded-md bg-white/10 text-xs font-bold uppercase tracking-wider text-white">
                                                {result.difficulty}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mt-10 mb-6 flex items-center gap-2">
                                        Ingredients
                                    </h3>
                                    <ul className="space-y-3">
                                        {(result.ingredients || []).map((ing: any, i: number) => (
                                            <li key={i} className="flex gap-3 text-white/80">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0"></span>
                                                <span className="flex-1">{ing.amount ? `${ing.amount} ` : ''}{ing.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="md:col-span-2">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 mt-2">
                                        <h4 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-pink-400" /> Chef's Note
                                        </h4>
                                        <p className="text-white/80 leading-relaxed text-[15px]">{result.description}</p>
                                    </div>

                                    <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
                                        <ChefHat className="w-6 h-6 text-orange-400" /> Directions
                                    </h3>
                                    <div className="space-y-8">
                                        {(result.instructions || []).map((step: string, i: number) => (
                                            <div key={i} className="flex gap-5">
                                                <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm">
                                                    {i + 1}
                                                </div>
                                                <p className="text-white/80 leading-relaxed pt-1">
                                                    {step}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
