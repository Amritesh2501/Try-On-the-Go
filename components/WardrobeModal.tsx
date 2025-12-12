
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import type { WardrobeItem } from '../types';
import { CheckCircleIcon, PlusIcon, ShirtIcon, Trash2Icon, CameraIcon, LinkIcon, XIcon, UploadCloudIcon, SparklesIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import { generateGarmentFromText } from '../services/geminiService';

interface WardrobePanelProps {
  onGarmentSelect: (garmentFile: File, garmentInfo: WardrobeItem) => void;
  onMultiGarmentSelect?: (items: { file: File, info: WardrobeItem }[]) => void;
  activeGarmentIds: string[];
  isLoading: boolean;
  wardrobe: WardrobeItem[];
  onRemoveGarment?: (id: string) => void;
}

const urlToFile = async (url: string, filename: string): Promise<File> => {
    // Helper to fetch with specific options
    const fetchBlob = async (urlToFetch: string): Promise<Blob> => {
        const response = await fetch(urlToFetch, { 
            mode: 'cors', 
            credentials: 'omit' // Important for public resources to avoid strict CORS checks
        });
        if (!response.ok) {
            throw new Error(`HTTP Status: ${response.status}`);
        }
        return await response.blob();
    };

    try {
        let blob: Blob;
        try {
            // Attempt 1: Try fetching the clean URL directly
            blob = await fetchBlob(url);
        } catch (firstError) {
            try {
                // Attempt 2: Try with cache busting to bypass browser cache
                console.warn("Direct fetch failed, retrying with cache buster...", firstError);
                const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
                blob = await fetchBlob(cacheBustedUrl);
            } catch (secondError) {
                 // Attempt 3: Try via CORS proxy
                 console.warn("Cache buster failed, retrying with CORS proxy...", secondError);
                 const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                 blob = await fetchBlob(proxyUrl);
            }
        }
        
        return new File([blob], filename, { type: blob.type || 'image/png' });
    } catch (error) {
        console.error("Image loading error:", error);
        throw new Error('Could not load image. It may have CORS restrictions or the URL is inaccessible.');
    }
};

const WardrobePanel: React.FC<WardrobePanelProps> = ({ onGarmentSelect, onMultiGarmentSelect, activeGarmentIds, isLoading, wardrobe, onRemoveGarment }) => {
    const [error, setError] = useState<string | null>(null);
    const [preparingItemId, setPreparingItemId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<WardrobeItem | null>(null);

    // Multi-Select State
    const [isMultiMode, setIsMultiMode] = useState(false);
    const [multiSelection, setMultiSelection] = useState<WardrobeItem[]>([]);
    const [isProcessingMulti, setIsProcessingMulti] = useState(false);

    // Modal States
    const [addMode, setAddMode] = useState<'select' | 'camera' | 'link' | 'design'>('select');
    const [linkUrl, setLinkUrl] = useState('');
    const [designPrompt, setDesignPrompt] = useState('');
    const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleItemClick = (item: WardrobeItem) => {
        if (isLoading) return; 

        if (isMultiMode) {
            // Toggle selection in multi mode
            setMultiSelection(prev => {
                const exists = prev.find(i => i.id === item.id);
                if (exists) return prev.filter(i => i.id !== item.id);
                return [...prev, item];
            });
            // Clear single selection stuff just in case
            setSelectedItem(null);
        } else {
            // Standard single selection
            setSelectedItem(item);
            setSelectedFile(null); // Clear custom file if switching to preset
            setError(null);
        }
    };

    const handleAddNewClick = () => {
        setIsAddModalOpen(true);
        setAddMode('select');
        setError(null);
    };

    const handleCloseModal = () => {
        setIsAddModalOpen(false);
        stopCamera();
        setLinkUrl('');
        setDesignPrompt('');
    };

    const toggleMultiMode = () => {
        setIsMultiMode(!isMultiMode);
        setMultiSelection([]);
        setSelectedItem(null);
    };

    // --- File Handling ---
    const processFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.');
            return;
        }
        const customGarmentInfo: WardrobeItem = {
            id: `custom-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
            url: URL.createObjectURL(file),
        };
        // Auto-select the new item based on mode
        if (isMultiMode) {
            setMultiSelection(prev => [...prev, customGarmentInfo]);
        } else {
            setSelectedItem(customGarmentInfo);
            setSelectedFile(file);
        }
        handleCloseModal();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    // --- Camera Logic ---
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            setIsCameraOpen(true);
            setAddMode('camera');
            setTimeout(() => {
                 if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error(err);
            setError("Could not access camera.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "camera-garment.jpg", { type: "image/jpeg" });
                        stopCamera();
                        processFile(file);
                    }
                }, 'image/jpeg', 0.95);
            }
        }
    };

    // --- Link Logic ---
    const handleLinkSubmit = async () => {
        if (!linkUrl) return;
        try {
            // Verify if it's an image or just try to load it
            const file = await urlToFile(linkUrl, 'linked-image.jpg');
            processFile(file);
        } catch (err) {
            setError('Could not load image from URL. It may be blocked by CORS.');
        }
    };

    // --- AI Design Logic ---
    const handleDesignSubmit = async () => {
        if (!designPrompt.trim()) return;
        setIsGeneratingDesign(true);
        setError(null);
        try {
            const base64Url = await generateGarmentFromText(designPrompt);
            // Convert base64 data URL to file
            const res = await fetch(base64Url);
            const blob = await res.blob();
            const file = new File([blob], "ai-designed-garment.png", { type: "image/png" });
            processFile(file);
        } catch (err) {
            console.error(err);
            setError("Failed to generate design. Please try a different prompt.");
        } finally {
            setIsGeneratingDesign(false);
        }
    };


    const handleTryOn = async () => {
        if (isMultiMode) {
            if (multiSelection.length === 0 || !onMultiGarmentSelect) return;
            setIsProcessingMulti(true);
            try {
                const items = await Promise.all(multiSelection.map(async (item) => {
                    const file = await urlToFile(item.url, item.name);
                    return { file, info: item };
                }));
                onMultiGarmentSelect(items);
                setMultiSelection([]);
                setIsMultiMode(false);
            } catch (err) {
                setError("Failed to process selected items.");
            } finally {
                setIsProcessingMulti(false);
            }
            return;
        }

        if (!selectedItem || isLoading) return;
        
        setPreparingItemId(selectedItem.id);
        setError(null);

        try {
            let file = selectedFile;
            if (!file) {
                file = await urlToFile(selectedItem.url, selectedItem.name);
            }
            onGarmentSelect(file, selectedItem);
            setSelectedItem(null);
            setSelectedFile(null);
        } catch (err) {
            setError(`Failed to load item. ${(err as Error).message}`);
        } finally {
            setPreparingItemId(null);
        }
    };

  return (
    <div className="pt-2 pb-24 md:pb-6 relative min-h-[300px]">
        <h2 className="text-2xl font-serif text-gray-900 dark:text-stone-100 mb-4 flex items-center justify-between">
            <span>Wardrobe</span>
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleMultiMode}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${isMultiMode ? 'bg-gray-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md' : 'bg-gray-200 text-gray-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-gray-300 dark:hover:bg-stone-700'}`}
                >
                    {isMultiMode ? 'Builder Mode On' : 'Builder Mode'}
                </button>
            </div>
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
            {/* Add New Button */}
             <button 
                onClick={handleAddNewClick}
                disabled={isLoading}
                className={`aspect-[4/5] relative border border-dashed rounded-2xl flex flex-col items-center justify-center text-gray-400 dark:text-stone-500 transition-all duration-200 group ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-900 dark:hover:border-stone-400 hover:text-gray-900 dark:hover:text-stone-200 cursor-pointer bg-gray-50 dark:bg-stone-900 hover:bg-white dark:hover:bg-stone-800 border-gray-300 dark:border-stone-700'}`}
             >
                <div className="bg-white dark:bg-stone-800 p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                    <PlusIcon className="w-5 h-5"/>
                </div>
                <span className="text-xs font-semibold mt-3">Add New</span>
            </button>

            {wardrobe.map((item) => {
            const isActive = activeGarmentIds.includes(item.id);
            const isSelected = selectedItem?.id === item.id;
            const isMultiSelected = multiSelection.some(i => i.id === item.id);
            const isPreparing = preparingItemId === item.id;
            
            return (
                <div 
                    key={item.id} 
                    className="relative group"
                    onMouseEnter={() => !isLoading && setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                >
                    <button
                        onClick={() => handleItemClick(item)}
                        disabled={isLoading}
                        className={`w-full aspect-[4/5] rounded-2xl overflow-hidden transition-all duration-300 focus:outline-none disabled:opacity-70 disabled:grayscale relative 
                            ${isSelected ? 'ring-2 ring-gray-900 dark:ring-stone-100 ring-offset-2 dark:ring-offset-stone-900' : ''}
                            ${isMultiSelected ? 'ring-4 ring-amber-500 ring-offset-1 dark:ring-offset-stone-900' : ''}
                            ${isPreparing ? 'ring-2 ring-cyan-500 ring-offset-2' : ''}
                        `}
                    >
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    
                    {/* Preparing Shimmer Overlay */}
                    {isPreparing && (
                        <div className="absolute inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-sm z-30 flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite] -skew-x-12" />
                            <Spinner className="w-6 h-6 text-gray-900 dark:text-white relative z-10" />
                        </div>
                    )}

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                        <p className="text-white text-sm font-medium text-left">{item.name}</p>
                    </div>

                    {/* Active (Worn) State Indicator */}
                    {isActive && !isMultiSelected && !isPreparing && (
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center z-20 group-hover:bg-gray-900/40 transition-colors">
                            <CheckCircleIcon className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    )}

                    {/* Multi-Select Badge */}
                    {isMultiSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md z-20">
                            {multiSelection.findIndex(i => i.id === item.id) + 1}
                        </div>
                    )}
                    </button>

                    {/* Delete Button */}
                    {onRemoveGarment && !isMultiMode && !isPreparing && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveGarment(item.id);
                                if (selectedItem?.id === item.id) setSelectedItem(null);
                            }}
                            className="absolute top-2 right-2 p-2 bg-white/90 dark:bg-stone-800/90 text-gray-500 dark:text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-30"
                            title="Remove from wardrobe"
                        >
                            <Trash2Icon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            );
            })}
        </div>
        
        {/* Floating Try-On / Build Button */}
        {(selectedItem || (isMultiMode && multiSelection.length > 0)) && (
             <div className="fixed md:absolute bottom-6 md:bottom-0 left-0 right-0 p-4 md:p-0 z-50 animate-fade-in-up">
                <div className="max-w-md mx-auto md:max-w-none">
                    <button
                        onClick={handleTryOn}
                        disabled={isLoading || preparingItemId !== null || isProcessingMulti}
                        className={`w-full font-serif text-lg py-4 rounded-full shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${isMultiMode ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-black dark:hover:bg-white'}`}
                    >
                        {(preparingItemId || isProcessingMulti) ? (
                            <>
                                <Spinner className="animate-spin h-5 w-5 text-current" />
                                <span className="ml-2">Processing...</span>
                            </>
                        ) : isMultiMode ? (
                            <>
                                <div className="flex -space-x-2">
                                    <div className="w-4 h-4 rounded-full bg-white/30 border border-white"></div>
                                    <div className="w-4 h-4 rounded-full bg-white/50 border border-white"></div>
                                </div>
                                <span>Mix & Match ({multiSelection.length})</span>
                            </>
                        ) : (
                            <>
                                <ShirtIcon className="w-5 h-5" />
                                <span>
                                    {activeGarmentIds.includes(selectedItem!.id) ? 'Try Again' : `Try On ${selectedItem!.name}`}
                                </span>
                            </>
                        )}
                    </button>
                </div>
             </div>
        )}

        {/* Hover Preview - Large floating preview card */}
        <AnimatePresence>
            {hoveredItem && !preparingItemId && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="fixed right-[420px] top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden md:block"
                >
                    <div className="bg-white dark:bg-stone-900 p-2 rounded-2xl shadow-2xl border border-gray-100 dark:border-stone-800 w-72 aspect-[3/4]">
                        <img 
                            src={hoveredItem.url} 
                            alt={hoveredItem.name} 
                            className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-stone-800/95 backdrop-blur-md p-3 rounded-lg border border-gray-200 dark:border-stone-700 shadow-sm">
                             <p className="font-serif text-gray-900 dark:text-stone-100 text-lg truncate">{hoveredItem.name}</p>
                             <p className="text-xs text-gray-500 dark:text-stone-400 uppercase tracking-widest mt-0.5">Preview</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Add Item Modal Overlay */}
        <AnimatePresence>
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                     <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseModal}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                     />
                     <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative bg-white dark:bg-stone-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                     >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-stone-800 flex items-center justify-between">
                            <h3 className="text-lg font-serif font-semibold text-gray-900 dark:text-stone-100">Add to Wardrobe</h3>
                            <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 dark:hover:bg-stone-800 rounded-full text-gray-500 dark:text-stone-400">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col items-center overflow-y-auto">
                            {addMode === 'select' && (
                                <div className="grid grid-cols-2 gap-4 w-full">
                                    <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-stone-700 hover:border-gray-900 dark:hover:border-stone-400 cursor-pointer bg-gray-50 dark:bg-stone-800 transition-colors h-32">
                                        <UploadCloudIcon className="w-6 h-6 text-gray-400 dark:text-stone-500" />
                                        <span className="text-xs font-medium text-gray-700 dark:text-stone-300">Upload Photo</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </label>
                                    
                                    <button 
                                        onClick={startCamera}
                                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-stone-700 hover:border-gray-900 dark:hover:border-stone-400 bg-gray-50 dark:bg-stone-800 transition-colors h-32"
                                    >
                                        <CameraIcon className="w-6 h-6 text-gray-400 dark:text-stone-500" />
                                        <span className="text-xs font-medium text-gray-700 dark:text-stone-300">Camera</span>
                                    </button>

                                    {/* AI Design Button */}
                                    <button 
                                        onClick={() => setAddMode('design')}
                                        className="col-span-2 flex flex-row items-center justify-center gap-3 p-4 rounded-2xl border-2 border-transparent hover:border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 transition-all"
                                    >
                                        <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full text-amber-600 dark:text-amber-400">
                                            <SparklesIcon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <span className="block text-sm font-bold text-gray-900 dark:text-stone-100">AI Fashion Designer</span>
                                            <span className="block text-xs text-gray-500 dark:text-stone-400">Create garments from text</span>
                                        </div>
                                    </button>
                                </div>
                            )}

                             {addMode === 'select' && (
                                <div className="w-full mt-4">
                                     <button 
                                        onClick={() => setAddMode('link')}
                                        className="w-full py-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-stone-500 dark:hover:text-stone-300"
                                     >
                                         <LinkIcon className="w-4 h-4" />
                                         <span>Or paste an image URL</span>
                                     </button>
                                </div>
                             )}

                            {addMode === 'camera' && (
                                <div className="w-full flex flex-col items-center gap-4">
                                     <div className="w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden relative">
                                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                     </div>
                                     <div className="flex gap-4">
                                        <button onClick={stopCamera} className="px-6 py-2 rounded-full text-gray-600 dark:text-stone-400 font-medium">Cancel</button>
                                        <button onClick={capturePhoto} className="px-8 py-2 rounded-full bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium shadow-lg hover:scale-105 transition-transform">Capture</button>
                                     </div>
                                </div>
                            )}

                            {addMode === 'link' && (
                                <div className="w-full flex flex-col gap-4">
                                    <input 
                                        type="url" 
                                        placeholder="Paste image URL here..." 
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        className="w-full p-4 rounded-xl border border-gray-200 dark:border-stone-700 bg-gray-50 dark:bg-stone-800 text-gray-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-stone-100"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setAddMode('select')} className="px-4 py-2 text-gray-500">Back</button>
                                        <button 
                                            onClick={handleLinkSubmit}
                                            disabled={!linkUrl}
                                            className="px-6 py-2 rounded-full bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium disabled:opacity-50"
                                        >
                                            Add Item
                                        </button>
                                    </div>
                                </div>
                            )}

                             {addMode === 'design' && (
                                <div className="w-full flex flex-col gap-4">
                                    <div className="text-center mb-2">
                                        <h4 className="font-serif text-xl text-gray-900 dark:text-stone-100">Design Studio</h4>
                                        <p className="text-sm text-gray-500 dark:text-stone-400">Describe the garment you want to create.</p>
                                    </div>
                                    <textarea 
                                        placeholder="e.g. A vintage floral summer dress with puffy sleeves and a sweetheart neckline..." 
                                        value={designPrompt}
                                        onChange={(e) => setDesignPrompt(e.target.value)}
                                        className="w-full p-4 h-32 rounded-xl border border-gray-200 dark:border-stone-700 bg-gray-50 dark:bg-stone-800 text-gray-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                    />
                                    <div className="flex gap-2 justify-end items-center">
                                        <button onClick={() => setAddMode('select')} className="px-4 py-2 text-gray-500">Back</button>
                                        <button 
                                            onClick={handleDesignSubmit}
                                            disabled={!designPrompt || isGeneratingDesign}
                                            className="px-6 py-2 rounded-full bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isGeneratingDesign ? (
                                                <>
                                                    <Spinner className="w-4 h-4" />
                                                    <span>Designing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <SparklesIcon className="w-4 h-4" />
                                                    <span>Generate & Add</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {isGeneratingDesign && (
                                        <p className="text-xs text-center text-amber-600 dark:text-amber-400 animate-pulse mt-2">
                                            AI is sketching your design. This may take a few seconds...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                     </motion.div>
                </div>
            )}
        </AnimatePresence>
        
        {error && <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">{error}</div>}
    </div>
  );
};

export default WardrobePanel;
