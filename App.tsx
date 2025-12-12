/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { generateVirtualTryOnImage, generatePoseVariation, generateSceneVariation, generateMultiGarmentTryOn } from './services/geminiService';
import { OutfitLayer, WardrobeItem } from './types';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import Header from './components/Header';
import { getFriendlyErrorMessage } from './lib/utils';
import InitialLoader from './components/InitialLoader';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Jumping in the air, mid-action shot",
  "Walking towards camera",
  "Leaning against a wall",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', listener);
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query, matches]);

  return matches;
};

// Helper to convert File to Base64 for persistence
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};


const App: React.FC = () => {
  const [showInitialLoader, setShowInitialLoader] = useState(true);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isAppStarted, setIsAppStarted] = useState(false);

  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [currentScene, setCurrentScene] = useState("Studio");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  // Initialize Wardrobe from LocalStorage if available, else default
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(() => {
    try {
        const saved = localStorage.getItem('wardrobe_v1');
        return saved ? JSON.parse(saved) : defaultWardrobe;
    } catch (e) {
        console.warn("Failed to parse wardrobe from local storage, resetting to default.", e);
        return defaultWardrobe;
    }
  });
  
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Persist Wardrobe changes
  useEffect(() => {
    try {
        localStorage.setItem('wardrobe_v1', JSON.stringify(wardrobe));
    } catch (e) {
        console.error("Failed to save wardrobe to local storage (likely quota exceeded).", e);
    }
  }, [wardrobe]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInitialLoader(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeGarmentIds = useMemo(() => {
    const ids = new Set<string>();
    activeOutfitLayers.forEach(layer => {
        if (layer.garments) {
            layer.garments.forEach(g => ids.add(g.id));
        } else if (layer.garment) {
            ids.add(layer.garment.id);
        }
    });
    return Array.from(ids);
  }, [activeOutfitLayers]);
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return generatedModelUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return generatedModelUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, generatedModelUrl]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  // Determine Base Image and Current Garment for Social Share
  const baseImage = useMemo(() => {
      if (outfitHistory.length > 0) {
          // Use the base layer's first pose or the currently generated model url
          const baseLayer = outfitHistory[0];
          return Object.values(baseLayer.poseImages)[0] || generatedModelUrl;
      }
      return generatedModelUrl;
  }, [outfitHistory, generatedModelUrl]);

  const currentGarmentUrl = useMemo(() => {
      if (activeOutfitLayers.length > 0) {
          // Get the garment from the current layer
          return activeOutfitLayers[currentOutfitIndex]?.garment?.url || null;
      }
      return null;
  }, [activeOutfitLayers, currentOutfitIndex]);


  const handleModelFinalized = (url: string) => {
    setGeneratedModelUrl(url);
    setIsAppStarted(true);
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleBackToStart = () => {
    setIsAppStarted(false);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setCurrentScene("Studio");
  };

  const handleFullReset = () => {
    setGeneratedModelUrl(null);
    setIsAppStarted(false);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setWardrobe(defaultWardrobe);
    localStorage.removeItem('wardrobe_v1');
  };

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    const currentImage = displayImageUrl;
    if (!currentImage || typeof currentImage !== 'string' || isLoading) return;

    // Logic to verify duplications or stack navigation is a bit complex with multi-mode, 
    // so we just append a new layer for simplicity if not exact same
    if (isMobile) {
      setIsSheetCollapsed(true);
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${garmentInfo.name}...`);

    try {
      const newImageUrl = await generateVirtualTryOnImage(currentImage, garmentFile);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      // Update Wardrobe Persistence
      const isNewItem = !wardrobe.find(item => item.id === garmentInfo.id);
      if (isNewItem) {
        try {
            const base64Url = await fileToBase64(garmentFile);
            const persistentItem = { ...garmentInfo, url: base64Url };
            setWardrobe(prev => {
                 if (prev.find(i => i.id === persistentItem.id)) return prev;
                 return [...prev, persistentItem];
            });
        } catch (e) {
            console.error("Failed to convert image to base64 for persistence", e);
        }
      }

    } catch (err: any) { // Fix: Type error as any to handle unknown type
      setError(getFriendlyErrorMessage(err, 'Failed to apply garment'));
      if (isMobile) setIsSheetCollapsed(false);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, currentOutfitIndex, isMobile, wardrobe]);

  const handleMultiGarmentSelect = useCallback(async (items: { file: File, info: WardrobeItem }[]) => {
      const currentImage = displayImageUrl;
      if (!currentImage || typeof currentImage !== 'string' || isLoading || items.length === 0) return;

      if (isMobile) setIsSheetCollapsed(true);

      setError(null);
      setIsLoading(true);
      setLoadingMessage(`Mixing ${items.length} items...`);

      try {
          const files = items.map(i => i.file);
          // Use the multi-garment service
          const newImageUrl = await generateMultiGarmentTryOn(currentImage, files);
          const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];

          const newLayer: OutfitLayer = {
              garment: items[0].info, // Fallback primary
              garments: items.map(i => i.info), // All items
              poseImages: { [currentPoseInstruction]: newImageUrl }
          };

          setOutfitHistory(prevHistory => {
              const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
              return [...newHistory, newLayer];
          });
          setCurrentOutfitIndex(prev => prev + 1);

      } catch (err: any) { // Fix: Type error as any to handle unknown type
          setError(getFriendlyErrorMessage(err, 'Failed to apply outfit'));
          if (isMobile) setIsSheetCollapsed(false);
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }

  }, [displayImageUrl, isLoading, currentPoseIndex, currentOutfitIndex, isMobile]);

  const handleUndo = useCallback(() => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prev => prev - 1);
      setCurrentPoseIndex(0);
    }
  }, [currentOutfitIndex]);

  const handleRedo = useCallback(() => {
    if (currentOutfitIndex < outfitHistory.length - 1) {
      setCurrentOutfitIndex(prev => prev + 1);
      setCurrentPoseIndex(0);
    }
  }, [currentOutfitIndex, outfitHistory.length]);

  const handleRemoveWardrobeItem = (itemId: string) => {
    setWardrobe(prev => prev.filter(item => item.id !== itemId));
  };

  const handleRemoveLayer = (index: number) => {
    if (index === 0) {
        setError("Cannot remove the base model. Please start over to change the model.");
        return;
    }
    // Remove from history
    setOutfitHistory(prev => {
        const newHistory = [...prev];
        newHistory.splice(index, 1);
        return newHistory;
    });
    // Adjust current index if the removed item was before or at the current index
    if (currentOutfitIndex >= index) {
        setCurrentOutfitIndex(Math.max(0, currentOutfitIndex - 1));
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = newHistory[currentOutfitIndex];
        updatedLayer.poseImages[poseInstruction] = newImageUrl;
        return newHistory;
      });
    } catch (err: any) { // Fix: Type error as any to handle unknown type
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex]);

  const handleSceneSelect = useCallback(async (scene: string) => {
      // Ensure we have a valid image string to prevent type errors
      const currentImage = displayImageUrl;
      if (isLoading || !currentImage || typeof currentImage !== 'string' || scene === currentScene) return;
      
      const imageToProcess = currentImage as string; // Explicitly capture as string

      setError(null);
      setIsLoading(true);
      setLoadingMessage(`Transporting to ${scene}...`);
      
      try {
          const newImageUrl = await generateSceneVariation(imageToProcess, scene);
          
          setOutfitHistory(prevHistory => {
              const newHistory = [...prevHistory];
              if (currentOutfitIndex >= newHistory.length) return prevHistory;

              const updatedLayer = { ...newHistory[currentOutfitIndex] };
              // Create shallow copy of poseImages
              updatedLayer.poseImages = { ...updatedLayer.poseImages };
              const currentPose = POSE_INSTRUCTIONS[currentPoseIndex];
              updatedLayer.poseImages[currentPose] = newImageUrl;
              newHistory[currentOutfitIndex] = updatedLayer;
              return newHistory;
          });
          setCurrentScene(scene);

      } catch (err: any) {
          setError(getFriendlyErrorMessage(err, 'Failed to change scene'));
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
  }, [displayImageUrl, isLoading, currentScene, currentOutfitIndex, currentPoseIndex]);

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const canUndo = currentOutfitIndex > 0;
  const canRedo = currentOutfitIndex < outfitHistory.length - 1;

  return (
    <div className="font-sans bg-[#FAFAF9] dark:bg-stone-950 w-full h-full text-gray-900 dark:text-stone-50 selection:bg-gray-200 dark:selection:bg-stone-800 transition-colors duration-300 overflow-hidden">
      <AnimatePresence mode="wait">
        {showInitialLoader && (
           <InitialLoader key="loader" />
        )}

        {!showInitialLoader && !isAppStarted && (
          <motion.div
            key="start-screen"
            className="w-full h-full relative flex flex-col overflow-hidden"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Header />
            <main className="flex-grow flex items-center justify-center w-full h-full relative overflow-hidden pt-16 pb-12">
                <StartScreen 
                  onModelFinalized={handleModelFinalized} 
                  initialImage={generatedModelUrl}
                  onReset={handleFullReset}
                />
            </main>
            <Footer />
          </motion.div>
        )}
        
        {!showInitialLoader && isAppStarted && (
          <motion.div
            key="main-app"
            className="relative w-full h-full overflow-hidden bg-[#FAFAF9] dark:bg-stone-950 transition-colors duration-300"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Main Canvas Area - Absolute Full Screen with Visual Centering Compensation */}
            {/* When overlay is open, we promote Main to z-50 to sit above Sidebar (z-40) */}
            <main className={`absolute inset-0 z-0 overflow-hidden w-full h-full md:pr-[400px] transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOverlayOpen ? '!z-50 !pr-0' : ''}`}>
              <Canvas 
                displayImageUrl={displayImageUrl}
                baseImage={baseImage}
                currentGarmentUrl={currentGarmentUrl}
                onBack={handleBackToStart}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                onSelectPose={handlePoseSelect}
                poseInstructions={POSE_INSTRUCTIONS}
                currentPoseIndex={currentPoseIndex}
                availablePoseKeys={availablePoseKeys}
                generatedPoses={outfitHistory[currentOutfitIndex]?.poseImages || {}}
                onSceneSelect={handleSceneSelect}
                currentScene={currentScene}
                onOverlayStateChange={setIsOverlayOpen}
              />
            </main>

            {/* Sidebar / Panel - Floating Overlay */}
            <aside 
              className={`absolute top-0 right-0 h-full z-40 w-full md:w-[400px] bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl md:border-l border-white/20 dark:border-stone-800 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${isSheetCollapsed ? 'translate-y-[calc(100%-4rem)] md:translate-y-0' : 'translate-y-0'} flex flex-col rounded-t-3xl md:rounded-none ring-1 ring-black/5 dark:ring-white/5 md:ring-0`}
            >
                {/* Mobile Handle */}
                <button 
                  onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                  className="md:hidden w-full h-12 flex items-center justify-center flex-shrink-0"
                >
                  <div className="w-12 h-1.5 bg-gray-200 dark:bg-stone-700 rounded-full"></div>
                </button>

                <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm leading-relaxed shadow-sm">
                      <p className="font-bold mb-1">Attention needed</p>
                      <p>{error}</p>
                    </div>
                  )}
                  
                  <OutfitStack 
                    outfitHistory={activeOutfitLayers}
                    onRemoveLayer={handleRemoveLayer}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                  />
                  
                  <WardrobePanel
                    onGarmentSelect={handleGarmentSelect}
                    onMultiGarmentSelect={handleMultiGarmentSelect}
                    activeGarmentIds={activeGarmentIds}
                    isLoading={isLoading}
                    wardrobe={wardrobe}
                    onRemoveGarment={handleRemoveWardrobeItem}
                  />
                </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;