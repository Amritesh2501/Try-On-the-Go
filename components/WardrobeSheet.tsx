/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { defaultWardrobe } from '../wardrobe';
import type { WardrobeItem } from '../types';
import { UploadCloudIcon, CheckCircleIcon, XIcon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';


interface WardrobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGarmentSelect: (garmentFile: File, garmentInfo: WardrobeItem) => void;
  activeGarmentIds: string[];
  isLoading: boolean;
}

// Helper to convert image URL to a File object
const urlToFile = async (url: string, filename: string): Promise<File> => {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type;
    return new File([blob], filename, { type: mimeType });
};

const WardrobeModal: React.FC<WardrobeModalProps> = ({ isOpen, onClose, onGarmentSelect, activeGarmentIds, isLoading }) => {
    const [error, setError] = useState<string | null>(null);

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading || activeGarmentIds.includes(item.id)) return;
        setError(null);
        try {
            const file = await urlToFile(item.url, `${item.id}.png`);
            onGarmentSelect(file, item);
        } catch (err) {
            setError('Could not load wardrobe item. Please try again.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            const customGarmentInfo: WardrobeItem = {
                id: `custom-${Date.now()}`,
                name: file.name,
                url: URL.createObjectURL(file), // for preview, not used by API
            };
            onGarmentSelect(file, customGarmentInfo);
        }
    };

  return (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
                >
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-2xl font-serif tracking-wider text-gray-800">Add Garment</h2>
                        <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                            <XIcon className="w-6 h-6"/>
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                            {defaultWardrobe.map((item) => {
                            const isActive = activeGarmentIds.includes(item.id);
                            return (
                                <button
                                key={item.id}
                                onClick={() => handleGarmentClick(item)}
                                disabled={isLoading || isActive}
                                className="relative aspect-square border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:opacity-60 disabled:cursor-not-allowed"
                                aria-label={`Select ${item.name}`}
                                >
                                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                                </div>
                                {isActive && (
                                    <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                                        <CheckCircleIcon className="w-8 h-8 text-white" />
                                    </div>
                                )}
                                </button>
                            );
                            })}
                            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                                <UploadCloudIcon className="w-6 h-6 mb-1"/>
                                <span className="text-xs text-center">Upload</span>
                                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
                            </label>
                        </div>
                        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
  );
};

export default WardrobeModal;