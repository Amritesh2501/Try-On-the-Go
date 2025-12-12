
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ShirtIcon } from './icons';
import ThemeToggle from './ThemeToggle';

const Header: React.FC = () => {
  return (
    <header className="w-full py-6 px-6 md:px-12 fixed top-0 left-0 right-0 z-40 bg-transparent pointer-events-none flex items-center justify-between">
      <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-2 rounded-full shadow-sm border border-white/50 dark:border-stone-800">
            <ShirtIcon className="w-5 h-5 text-gray-900 dark:text-stone-100" />
          </div>
          <h1 className="text-xl font-serif tracking-widest text-gray-900 dark:text-stone-100 font-medium bg-white/50 dark:bg-stone-900/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 dark:border-stone-800">
            Try on the Go
          </h1>
      </div>
      
      <div className="pointer-events-auto">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
