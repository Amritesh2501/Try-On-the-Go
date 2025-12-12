
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, Variants } from 'framer-motion';

const InitialLoader: React.FC = () => {
  // Sequence:
  // 0s - 1.5s: Draw Shirt
  // 1.5s - 2.0s: Fade out Shirt
  // 2.0s - 3.5s: Draw Pants
  
  const shirtVariants: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: [0, 1, 1, 0], // Fade in, stay, fade out
      transition: { 
        pathLength: { duration: 1.5, ease: "easeInOut" },
        opacity: { 
            duration: 2.0, 
            times: [0, 0.1, 0.75, 1], // 0-0.2s fade in, 0.2-1.5s visible, 1.5-2.0s fade out
            ease: "linear"
        }
      }
    }
  };

  const pantsVariants: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        pathLength: { duration: 1.5, ease: "easeInOut", delay: 2.0 },
        opacity: { duration: 0.1, delay: 2.0 }
      }
    }
  };

  const containerVariants: Variants = {
    exit: { 
      opacity: 0,
      scale: 1.05,
      filter: "blur(10px)",
      transition: { duration: 0.8, ease: "easeInOut" }
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-[#FAFAF9] dark:bg-stone-950 z-50 flex flex-col items-center justify-center transition-colors duration-300"
      variants={containerVariants}
      exit="exit"
    >
      <div className="w-64 h-64 relative flex items-center justify-center">
        <svg 
          width="200" 
          height="200" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="0.8" // Elegant line width
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-gray-900 dark:text-stone-100"
        >
          {/* T-Shirt Path */}
          <motion.path
            d="M20.38 3.46 16 2a4 4 0 0 0-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"
            variants={shirtVariants}
            initial="hidden"
            animate="visible"
          />
          
          {/* Pants Path */}
          <motion.path
            d="M6 13 L6 21 L10 21 L10 16 L14 16 L14 21 L18 21 L18 13" 
            variants={pantsVariants}
            initial="hidden"
            animate="visible"
          />
        </svg>
      </div>
      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <h1 className="text-3xl font-serif tracking-widest text-gray-900 dark:text-stone-100">
            Try on the Go
        </h1>
        <p className="text-xs text-gray-400 dark:text-stone-500 font-sans mt-2 tracking-widest uppercase">Digital Atelier</p>
      </motion.div>
    </motion.div>
  );
};

export default InitialLoader;
