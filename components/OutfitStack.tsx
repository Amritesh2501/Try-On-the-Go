
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { OutfitLayer } from '../types';
import { Trash2Icon, RotateCcwIcon, RotateCwIcon } from './icons';

interface OutfitStackProps {
  outfitHistory: OutfitLayer[];
  onRemoveLayer: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const OutfitStack: React.FC<OutfitStackProps> = ({ outfitHistory, onRemoveLayer, onUndo, onRedo, canUndo, canRedo }) => {
  const getLayerThumbnail = (layer: OutfitLayer) => {
    // If it's a multi-garment layer, we handle it in the render loop to show multiple
    if (layer.garment) {
      return layer.garment.url;
    }
    // For base layer (where garment is null), return the first available pose image (the model's body)
    const images = Object.values(layer.poseImages);
    return images.length > 0 ? images[0] : '';
  };

  const isMultiGarment = (layer: OutfitLayer) => {
      return layer.garments && layer.garments.length > 1;
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-stone-800 pb-4">
        <div className="flex items-center gap-3">
             <h2 className="text-2xl font-serif text-gray-900 dark:text-stone-100">Current Look</h2>
             <span className="text-xs font-medium text-gray-400 dark:text-stone-500 bg-gray-100 dark:bg-stone-800 px-2 py-1 rounded-full">{outfitHistory.length} Layers</span>
        </div>
        
        <div className="flex items-center gap-1">
            <button 
                onClick={onUndo} 
                disabled={!canUndo}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-stone-800 text-gray-500 dark:text-stone-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Undo"
            >
                <RotateCcwIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={onRedo} 
                disabled={!canRedo}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-stone-800 text-gray-500 dark:text-stone-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Redo"
            >
                <RotateCwIcon className="w-5 h-5" />
            </button>
        </div>
      </div>
      
      <div className="space-y-3">
        {outfitHistory.map((layer, index) => {
          const isMulti = isMultiGarment(layer);
          const thumbnail = getLayerThumbnail(layer);
          
          return (
            <div
              key={layer.garment?.id || `base-${index}`}
              className="group flex items-center justify-between bg-white dark:bg-stone-900 p-3 rounded-xl border border-gray-100 dark:border-stone-800 shadow-sm transition-all hover:shadow-md hover:border-gray-200 dark:hover:border-stone-700"
            >
              <div className="flex items-center overflow-hidden w-full">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-[10px] font-bold text-gray-500 dark:text-stone-400 bg-gray-100 dark:bg-stone-800 rounded-full font-mono">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  
                  <div className="w-10 h-10 rounded-lg overflow-hidden mr-3 flex-shrink-0 bg-gray-50 dark:bg-stone-800 border border-gray-100 dark:border-stone-700 relative">
                      {isMulti && layer.garments ? (
                          <div className="grid grid-cols-2 h-full w-full">
                              {layer.garments.slice(0, 4).map((g, i) => (
                                  <img key={i} src={g.url} className="w-full h-full object-cover" alt="" />
                              ))}
                          </div>
                      ) : thumbnail && (
                          <img 
                            src={thumbnail} 
                            alt={layer.garment?.name || 'Base Model'} 
                            className="w-full h-full object-cover" 
                          />
                      )}
                  </div>

                  <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-900 dark:text-stone-100 truncate" title={layer.garment?.name || 'Base Model'}>
                        {isMulti ? `${layer.garments!.length} Item Outfit` : (layer.garment ? layer.garment.name : 'Base Model')}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-stone-500 uppercase tracking-wide truncate">
                          {isMulti ? layer.garments!.map(g => g.name).join(', ') : (layer.garment ? 'Garment' : 'Body')}
                      </span>
                  </div>
              </div>
              
              {/* Allow removal of any layer except the first (base) one */}
              {index > 0 && (
                 <button
                  onClick={() => onRemoveLayer(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 dark:text-stone-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg ml-2"
                  aria-label={`Remove ${layer.garment?.name}`}
                >
                  <Trash2Icon className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OutfitStack;
