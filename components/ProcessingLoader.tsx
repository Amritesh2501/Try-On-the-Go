
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProcessingLoaderProps {
  message?: string;
  subMessage?: string;
}

const ProcessingLoader: React.FC<ProcessingLoaderProps> = ({ message = "Processing", subMessage }) => {
  const [progress, setProgress] = useState(0);
  const [showShirt, setShowShirt] = useState(true);

  useEffect(() => {
    // Simulate progress
    const duration = 4000;
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
        currentStep++;
        // Logarithmic-ish progress to 99%, then wait
        const nextProgress = Math.min(99, 100 * (1 - Math.exp(-4 * currentStep / steps)));
        setProgress(nextProgress);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  // Cycle between Shirt and Pants every 2 seconds
  useEffect(() => {
      const iconTimer = setInterval(() => {
          setShowShirt(prev => !prev);
      }, 2000);
      return () => clearInterval(iconTimer);
  }, []);

  const iconVariants = {
      initial: { opacity: 0, scale: 0.8 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.1 }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[250px] p-6">
      {/* Scanner Container */}
      <div className="relative w-24 h-32 mb-8">
        {/* Frame */}
        <div className="absolute inset-0 border-[1.5px] border-gray-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm flex items-center justify-center">
            
            {/* Alternating Cloth Icons */}
            <AnimatePresence mode="wait">
                {showShirt ? (
                    <motion.svg
                        key="shirt"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-gray-400 dark:text-stone-500"
                        variants={iconVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.5 }}
                    >
                         <path d="M20.38 3.46 16 2a4 4 0 0 0-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                    </motion.svg>
                ) : (
                    <motion.svg
                        key="pants"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-gray-400 dark:text-stone-500"
                        variants={iconVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.5 }}
                    >
                        <path d="M6 13 L6 21 L10 21 L10 16 L14 16 L14 21 L18 21 L18 13" />
                        <path d="M6 13 L18 13" strokeOpacity="0.5" />
                    </motion.svg>
                )}
            </AnimatePresence>
            
            {/* Scanning Line */}
            <motion.div 
                className="absolute left-0 right-0 h-[2px] bg-gray-900 dark:bg-stone-100 shadow-[0_0_12px_rgba(0,0,0,0.3)] dark:shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10"
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
            />
            
            {/* Digital Gradient Flow */}
            <motion.div 
                className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/5 to-transparent dark:via-white/5 pointer-events-none"
                animate={{ translateY: ['-100%', '100%'] }}
                transition={{ duration: 2.5, ease: "linear", repeat: Infinity }}
            />
        </div>

        {/* Viewfinder Corner Accents */}
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-gray-900 dark:border-stone-100 rounded-tl-sm" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-gray-900 dark:border-stone-100 rounded-tr-sm" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-gray-900 dark:border-stone-100 rounded-bl-sm" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-gray-900 dark:border-stone-100 rounded-br-sm" />
      </div>

      {/* Typography */}
      <div className="flex flex-col items-center gap-2 z-10 text-center">
        <h3 className="text-xl font-serif tracking-wide text-gray-900 dark:text-stone-100">
            {message}
        </h3>
        
        <div className="flex items-center gap-3 text-[10px] md:text-xs font-mono text-gray-400 dark:text-stone-500 uppercase tracking-widest">
            {subMessage && <span>{subMessage}</span>}
            <span className="w-px h-3 bg-gray-300 dark:bg-stone-700 mx-1"></span>
            <span className="tabular-nums text-gray-900 dark:text-stone-100">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
};

export default ProcessingLoader;
