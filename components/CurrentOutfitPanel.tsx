/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { OutfitLayer } from '../types';
import { Trash2Icon, PlusIcon } from './icons';

interface OutfitStackProps {
  outfitHistory: OutfitLayer[];
  onRemoveLastGarment: () => void;
  onAddGarment: () => void;
}

const OutfitStack: React.FC<OutfitStackProps> = ({ outfitHistory, onRemoveLastGarment, onAddGarment }) => {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 border-b border-gray-400/50 pb-2 mb-3">Outfit Stack</h2>
      <div className="space-y-2 flex-grow">
        {outfitHistory.map((layer, index) => (
          <div
            key={layer.garment?.id || 'base'}
            className="flex items-center justify-between bg-white/50 p-2 rounded-lg animate-fade-in border border-gray-200/80 shadow-sm"
          >
            <div className="flex items-center overflow-hidden">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 bg-gray-200 rounded-full">
                  {index + 1}
                </span>
                {layer.garment && (
                    <img src={layer.garment.url} alt={layer.garment.name} className="flex-shrink-0 w-12 h-12 object-cover rounded-md mr-3" />
                )}
                <span className="font-semibold text-gray-800 truncate" title={layer.garment?.name}>
                  {layer.garment ? layer.garment.name : 'Base Model'}
                </span>
            </div>
            {index > 0 && index === outfitHistory.length - 1 && (
               <button
                onClick={onRemoveLastGarment}
                className="flex-shrink-0 text-gray-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50"
                aria-label={`Remove ${layer.garment?.name}`}
              >
                <Trash2Icon className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {outfitHistory.length === 1 && (
            <p className="text-center text-sm text-gray-500 pt-4">Your stacked items will appear here. Start by adding a garment.</p>
        )}
      </div>
       <button 
          onClick={onAddGarment}
          className="mt-4 w-full flex items-center justify-center text-center bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-700 active:scale-95 text-base"
      >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Garment
      </button>
    </div>
  );
};

export default OutfitStack;