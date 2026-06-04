import React from 'react';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
});

export function FashionPage() {
    return (
        <div className="px-6 sm:px-10 max-w-7xl mx-auto w-full pb-32 min-h-[60vh] flex flex-col items-center justify-center">
            <motion.div {...fadeUp(0.1)} className="text-center mb-12">
                <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-semibold uppercase tracking-widest">
                    <Wand2 className="w-3.5 h-3.5" /> Fashion Workshop
                </div>
                <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight leading-none mb-8 uppercase" style={{ fontFamily: 'Anton, sans-serif, system-ui' }}>
                    Digital<br />Atelier
                </h1>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-12 p-8 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-md inline-block"
                >
                    <p className="text-2xl text-white/80 font-medium tracking-wide">
                        We are cooking something.
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}
