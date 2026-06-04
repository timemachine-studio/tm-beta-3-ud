import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Package, Tag, Search, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const glassCard = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
} as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  badge?: string;
}

const PRODUCTS: Product[] = [
  {
    id: 'tm-tee-black',
    name: 'TimeMachine Tee — Black',
    description: 'Premium cotton tee with embroidered TimeMachine logo. Minimal, clean, and built to last.',
    price: 35,
    image: '',
    category: 'Apparel',
    badge: 'New',
  },
  {
    id: 'tm-tee-white',
    name: 'TimeMachine Tee — White',
    description: 'Soft-washed cotton with a subtle tonal print. The everyday essential.',
    price: 35,
    image: '',
    category: 'Apparel',
  },
  {
    id: 'tm-hoodie',
    name: 'TimeMachine Hoodie',
    description: 'Heavyweight fleece hoodie with embroidered branding. Relaxed fit, premium feel.',
    price: 75,
    image: '',
    category: 'Apparel',
    badge: 'Popular',
  },
  {
    id: 'tm-cap',
    name: 'TimeMachine Cap',
    description: 'Structured 6-panel cap with embroidered logo. Adjustable strap.',
    price: 28,
    image: '',
    category: 'Accessories',
  },
  {
    id: 'tm-sticker-pack',
    name: 'Sticker Pack',
    description: 'Set of 6 vinyl die-cut stickers. Weather-resistant, laptop-ready.',
    price: 8,
    image: '',
    category: 'Accessories',
  },
  {
    id: 'tm-mug',
    name: 'TimeMachine Mug',
    description: 'Ceramic mug with a matte finish and minimal logo. 12oz capacity.',
    price: 18,
    image: '',
    category: 'Accessories',
  },
];

const CATEGORIES = ['All', 'Apparel', 'Accessories'];

export function ShopPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = PRODUCTS.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-x-hidden`}>
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/6 blur-3xl" />
        <div className="absolute bottom-[10%] right-[-15%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-3xl" />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-fuchsia-500/4 blur-3xl" />
      </div>

      <div className="relative z-10 w-full min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="px-6 sm:px-10 pt-8 pb-0">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm">Home</span>
          </motion.button>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center justify-center px-4 pt-12 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center mb-6"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
              TimeMachine Shop
            </h1>
            <p className="text-white/40 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
              Physical goods from the TimeMachine universe. Wear it, use it, own it.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            {...fadeUp(0.1)}
            className="w-full max-w-md relative"
          >
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={glassCard}
            >
              <Search className="w-4 h-4 text-white/30 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Category filters */}
        <motion.div
          {...fadeUp(0.15)}
          className="flex items-center justify-center gap-2 px-6 pb-8"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                selectedCategory === cat
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-white/40 hover:text-white/70 border border-white/8 hover:border-white/15'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Product grid */}
        <div className="flex-1 px-6 sm:px-10 lg:px-16 pb-16 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((product, i) => (
              <motion.button
                key={product.id}
                {...fadeUp(0.2 + i * 0.06)}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedProduct(product)}
                className="rounded-3xl overflow-hidden text-left relative group"
                style={glassCard}
              >
                {/* Product image placeholder */}
                <div className="aspect-square w-full bg-white/[0.03] flex items-center justify-center relative overflow-hidden">
                  <Package className="w-12 h-12 text-white/[0.06]" />
                  {product.badge && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                      <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">{product.badge}</span>
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-white text-sm font-semibold leading-snug">{product.name}</h3>
                    <span className="text-white/60 text-sm font-bold shrink-0">${product.price}</span>
                  </div>
                  <p className="text-white/30 text-xs leading-relaxed line-clamp-2">{product.description}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-white/20" />
                    <span className="text-white/20 text-[10px] font-medium uppercase tracking-wider">{product.category}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {filtered.length === 0 && (
            <motion.div
              {...fadeUp(0.2)}
              className="rounded-2xl flex flex-col items-center justify-center py-20"
              style={glassCard}
            >
              <ShoppingBag className="w-10 h-10 text-white/10 mb-4" />
              <p className="text-white/30 text-sm font-medium mb-1">No products found</p>
              <p className="text-white/20 text-xs">Try a different search or category.</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Product detail modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            onClick={() => setSelectedProduct(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden"
              style={{
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image area */}
              <div className="aspect-[4/3] w-full bg-white/[0.03] flex items-center justify-center relative">
                <Package className="w-16 h-16 text-white/[0.06]" />
                {selectedProduct.badge && (
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">{selectedProduct.badge}</span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-1.5 mb-3">
                  <Tag className="w-3 h-3 text-white/20" />
                  <span className="text-white/20 text-[10px] font-semibold uppercase tracking-wider">{selectedProduct.category}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{selectedProduct.name}</h2>
                <p className="text-white/40 text-sm leading-relaxed mb-6">{selectedProduct.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-white">${selectedProduct.price}</span>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(139, 92, 246, 0.3))',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      boxShadow: '0 0 20px rgba(168, 85, 247, 0.15)',
                    }}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Coming Soon
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
