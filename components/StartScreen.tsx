
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, CameraIcon, XIcon, ChevronLeftIcon, ImageIcon, CheckCircleIcon, ChevronRightIcon, DownloadIcon, SparklesIcon } from './icons';
import { generateModelImage, generateVirtualTryOnImage, generateStyleAdvice } from '../services/geminiService';
import Spinner from './Spinner';
import ProcessingLoader from './ProcessingLoader';
import { getFriendlyErrorMessage } from '../lib/utils';
import { Compare } from './ui/compare';
import type { StyleAdvice } from '../types';

interface StartScreenProps {
  onModelFinalized: (modelUrl: string) => void;
  initialImage?: string | null;
  onReset?: () => void;
}

type AppMode = 'selection' | 'try-on' | 'compare' | 'style-advisor';
type CompareStep = 'upload-base' | 'upload-garments' | 'generating' | 'choose-view' | 'result';

// Helper to convert File to Base64 for API calls
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const StartScreen: React.FC<StartScreenProps> = ({ onModelFinalized, initialImage, onReset }) => {
  const [mode, setMode] = useState<AppMode>('selection');
  
  // Try-On State
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(initialImage || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Compare State
  const [compareStep, setCompareStep] = useState<CompareStep>('upload-base');
  const [compareViewMode, setCompareViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [compareBaseFile, setCompareBaseFile] = useState<File | null>(null);
  const [compareBasePreview, setCompareBasePreview] = useState<string | null>(null);
  const [compareGarment1File, setCompareGarment1File] = useState<File | null>(null);
  const [compareGarment1Preview, setCompareGarment1Preview] = useState<string | null>(null);
  const [compareGarment2File, setCompareGarment2File] = useState<File | null>(null);
  const [compareGarment2Preview, setCompareGarment2Preview] = useState<string | null>(null);
  const [compareResult1, setCompareResult1] = useState<string | null>(null);
  const [compareResult2, setCompareResult2] = useState<string | null>(null);
  const [compareLoadingMsg, setCompareLoadingMsg] = useState("");

  // Style Advisor State
  const [advisorFile, setAdvisorFile] = useState<File | null>(null);
  const [advisorPreview, setAdvisorPreview] = useState<string | null>(null);
  const [advisorResult, setAdvisorResult] = useState<StyleAdvice | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAdvisorCameraOpen, setIsAdvisorCameraOpen] = useState(false);

  useEffect(() => {
    if (initialImage) {
        setGeneratedModelUrl(initialImage);
        setMode('try-on'); // Auto-navigate if there's an image
    }
  }, [initialImage]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        return;
    }

    setIsGenerating(true);
    setGeneratedModelUrl(null);
    setError(null);
    try {
        const result = await generateModelImage(file);
        setGeneratedModelUrl(result);
    } catch (err) {
        setError(getFriendlyErrorMessage(err as any, 'Failed to create model'));
    } finally {
        setIsGenerating(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setGeneratedModelUrl(null);
    setIsGenerating(false);
    setError(null);
    setIsCameraOpen(false);
    if (onReset) onReset();
  };

  const startCamera = async () => {
    try {
        setError(null);
        // Request camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
        });
        setIsCameraOpen(true);
        // Small delay to ensure video element is rendered
        setTimeout(() => {
             if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        }, 100);
    } catch (err) {
        console.error(err);
        setError("Could not access camera. Please check permissions.");
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
            // Flip horizontal if user facing (mirror effect)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
                    stopCamera();
                    handleFileSelect(file);
                }
            }, 'image/jpeg', 0.95);
        }
    }
  };

  // --- Compare Handlers ---
  const handleCompareBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setCompareBaseFile(file);
        setCompareBasePreview(URL.createObjectURL(file));
    }
  };

  const handleCompareGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          if (slot === 1) {
              setCompareGarment1File(file);
              setCompareGarment1Preview(url);
          } else {
              setCompareGarment2File(file);
              setCompareGarment2Preview(url);
          }
      }
  };

  const executeComparison = async () => {
      if (!compareBaseFile || !compareGarment1File || !compareGarment2File) return;
      
      setCompareStep('generating');
      setError(null);

      try {
          // 1. Generate Base Model
          setCompareLoadingMsg("Constructing base model...");
          const baseModelUrl = await generateModelImage(compareBaseFile);
          
          // 2. Generate Look 1
          setCompareLoadingMsg("Generating Look 1...");
          const result1 = await generateVirtualTryOnImage(baseModelUrl, compareGarment1File);
          setCompareResult1(result1);

          // 3. Generate Look 2
          setCompareLoadingMsg("Generating Look 2...");
          const result2 = await generateVirtualTryOnImage(baseModelUrl, compareGarment2File);
          setCompareResult2(result2);

          setCompareStep('choose-view');
      } catch (err) {
          setError(getFriendlyErrorMessage(err as any, "Comparison failed"));
          setCompareStep('upload-garments'); // Go back to allow retry
      } finally {
          setCompareLoadingMsg("");
      }
  };

  const handleViewSelect = (mode: 'slider' | 'side-by-side') => {
      setCompareViewMode(mode);
      setCompareStep('result');
  };

  const handleDownload = (url: string, name: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
  };

  const resetCompare = () => {
      setCompareStep('upload-base');
      setCompareViewMode('slider');
      setCompareBaseFile(null);
      setCompareBasePreview(null);
      setCompareGarment1File(null);
      setCompareGarment1Preview(null);
      setCompareGarment2File(null);
      setCompareGarment2Preview(null);
      setCompareResult1(null);
      setCompareResult2(null);
      setError(null);
  };

  // --- Style Advisor Handlers ---
  const handleAdvisorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          handleAdvisorFileSelect(file);
      }
  };

  const handleAdvisorFileSelect = (file: File) => {
    setAdvisorFile(file);
    setAdvisorPreview(URL.createObjectURL(file));
  };

  const startAdvisorCamera = async () => {
    try {
        setError(null);
        // Request camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
        });
        setIsAdvisorCameraOpen(true);
        setTimeout(() => {
             if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        }, 100);
    } catch (err) {
        console.error(err);
        setError("Could not access camera. Please check permissions.");
    }
  };

  const stopAdvisorCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
    setIsAdvisorCameraOpen(false);
  };

  const captureAdvisorPhoto = () => {
    if (videoRef.current) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Flip horizontal if user facing (mirror effect)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "advisor-photo.jpg", { type: "image/jpeg" });
                    stopAdvisorCamera();
                    handleAdvisorFileSelect(file);
                }
            }, 'image/jpeg', 0.95);
        }
    }
  };


  const executeStyleAnalysis = async () => {
      if (!advisorFile) return;
      
      setIsAnalyzing(true);
      setError(null);
      try {
          const base64Image = await fileToBase64(advisorFile);
          const advice = await generateStyleAdvice(base64Image);
          setAdvisorResult(advice);
      } catch (err) {
          setError(getFriendlyErrorMessage(err as any, "Style analysis failed"));
      } finally {
          setIsAnalyzing(false);
      }
  };

  const resetAdvisor = () => {
      setAdvisorFile(null);
      setAdvisorPreview(null);
      setAdvisorResult(null);
      setError(null);
      setIsAdvisorCameraOpen(false);
  };


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } }
  };

  // --- Render: Selection Mode ---
  if (mode === 'selection') {
      return (
          <AnimatePresence mode="wait">
              <motion.div
                  key="selection"
                  className="w-full h-full flex flex-col items-center px-6 overflow-y-auto no-scrollbar"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
              >
                  <div className="w-full max-w-6xl flex flex-col items-center gap-6 py-4 my-auto">
                    <motion.div variants={itemVariants} className="text-center flex-shrink-0">
                        <h1 className="text-3xl md:text-6xl font-serif text-gray-900 dark:text-stone-50 mb-2">
                            Welcome to Studio
                        </h1>
                        <p className="text-gray-500 dark:text-stone-400 font-sans text-sm md:text-lg">
                            Choose your experience
                        </p>
                    </motion.div>

                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full px-2 md:px-0 flex-1 min-h-0">
                        {/* Option 1: AI Try On */}
                        <button 
                            onClick={() => setMode('try-on')}
                            className="group relative overflow-hidden bg-white dark:bg-stone-900 rounded-2xl p-5 md:p-8 border-2 border-transparent hover:border-gray-200 dark:hover:border-stone-700 shadow-sm hover:shadow-xl transition-all duration-300 text-left min-w-0 md:col-span-2 lg:col-span-1 h-full"
                        >
                            <div className="absolute -right-4 -bottom-4 md:top-0 md:right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <PlusIcon className="w-24 h-24 md:w-32 md:h-32" />
                            </div>
                            <div className="relative z-10 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 h-full justify-between">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 dark:bg-stone-800 flex items-center justify-center md:mb-6 text-gray-900 dark:text-stone-100 shrink-0">
                                    <CameraIcon className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg md:text-2xl font-serif text-gray-900 dark:text-stone-50 mb-1 md:mb-2">AI Virtual Try-On</h3>
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-stone-400 leading-relaxed">
                                        Create a digital twin and try on unlimited outfits.
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Option 2: Compare */}
                        <button 
                            onClick={() => setMode('compare')}
                            className="group relative overflow-hidden bg-white dark:bg-stone-900 rounded-2xl p-5 md:p-8 border-2 border-transparent hover:border-gray-200 dark:hover:border-stone-700 shadow-sm hover:shadow-xl transition-all duration-300 text-left min-w-0 h-full"
                        >
                            <div className="absolute -right-4 -bottom-4 md:top-0 md:right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ImageIcon className="w-24 h-24 md:w-32 md:h-32" />
                            </div>
                            <div className="relative z-10 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 h-full justify-between">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 dark:bg-stone-800 flex items-center justify-center md:mb-6 text-gray-900 dark:text-stone-100 shrink-0">
                                    <div className="flex -space-x-2">
                                        <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-current opacity-50"></div>
                                        <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-current"></div>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg md:text-2xl font-serif text-gray-900 dark:text-stone-50 mb-1 md:mb-2">Compare Looks</h3>
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-stone-400 leading-relaxed">
                                        Compare two outfits side-by-side.
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Option 3: Style Advisor */}
                        <button 
                            onClick={() => setMode('style-advisor')}
                            className="group relative overflow-hidden bg-white dark:bg-stone-900 rounded-2xl p-5 md:p-8 border-2 border-transparent hover:border-gray-200 dark:hover:border-stone-700 shadow-sm hover:shadow-xl transition-all duration-300 text-left min-w-0 h-full"
                        >
                            <div className="absolute -right-4 -bottom-4 md:top-0 md:right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <SparklesIcon className="w-24 h-24 md:w-32 md:h-32" />
                            </div>
                            <div className="relative z-10 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 h-full justify-between">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 dark:bg-stone-800 flex items-center justify-center md:mb-6 text-gray-900 dark:text-stone-100 shrink-0">
                                    <SparklesIcon className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg md:text-2xl font-serif text-gray-900 dark:text-stone-50 mb-1 md:mb-2">Style Advisor</h3>
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-stone-400 leading-relaxed">
                                        Get instant fit ratings & style tips.
                                    </p>
                                </div>
                            </div>
                        </button>
                    </motion.div>
                  </div>
              </motion.div>
          </AnimatePresence>
      );
  }

  // --- Render: Style Advisor Mode ---
  if (mode === 'style-advisor') {
      const score = advisorResult?.score || 0;
      
      // Calculate color based on score
      const scoreColor = score >= 8 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
      
      // Gauge parameters
      const radius = 80;
      const circumference = 2 * Math.PI * radius;
      const progress = (score / 10) * circumference;

      return (
          <AnimatePresence mode="wait">
            <motion.div
                key="style-advisor"
                className="w-full h-full flex flex-col items-center px-4 md:justify-center relative overflow-y-auto bg-gray-50 dark:bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Back Button */}
                {!isAdvisorCameraOpen && !advisorResult && !isAnalyzing && (
                    <button 
                        onClick={() => {
                            setMode('selection');
                            resetAdvisor();
                        }}
                        className="absolute top-6 left-6 z-40 flex items-center gap-2 text-gray-500 dark:text-stone-400 hover:text-gray-900 dark:hover:text-stone-100 transition-colors bg-white/10 backdrop-blur-md px-4 py-2 rounded-full"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                )}

                {/* State 1: Upload & Analyze */}
                {!advisorResult && !isAnalyzing && !isAdvisorCameraOpen && (
                     <motion.div 
                        key="advisor-upload"
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="w-full h-full max-w-md flex flex-col items-center justify-center gap-6 py-12"
                     >
                         <div className="text-center flex-shrink-0 mt-8">
                             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-4 border border-amber-500/20">
                                <SparklesIcon className="w-3 h-3" />
                                AI Stylist
                             </div>
                             <h2 className="text-5xl md:text-6xl font-serif text-gray-900 dark:text-stone-50 mb-4 tracking-tight">Rate my Fit</h2>
                             <p className="text-sm md:text-base text-gray-500 dark:text-stone-400 max-w-xs mx-auto leading-relaxed">
                                Upload a photo of your outfit. Our AI will analyze the fit, color, and style.
                             </p>
                         </div>
                         
                         <div className="w-full aspect-[3/4] max-h-[45vh] relative group cursor-pointer">
                            <label className="absolute inset-0 w-full h-full rounded-[2.5rem] border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-gray-900 dark:hover:border-white/40 bg-white dark:bg-stone-900/50 flex flex-col items-center justify-center transition-all overflow-hidden shadow-sm hover:shadow-2xl">
                                {advisorPreview ? (
                                    <img src={advisorPreview} alt="Advisor Upload" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center gap-5 p-8 text-center">
                                        <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/10">
                                            <PlusIcon className="w-8 h-8 text-gray-400 dark:text-white/40" />
                                        </div>
                                        <div>
                                            <p className="font-serif text-2xl text-gray-900 dark:text-white">Upload Photo</p>
                                            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Tap to browse gallery</p>
                                        </div>
                                    </div>
                                )}
                                <input type="file" className="hidden" accept="image/*" onChange={handleAdvisorFileChange} />
                                
                                {advisorPreview && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                        <span className="bg-white/20 backdrop-blur-xl px-6 py-2.5 rounded-full text-white font-medium border border-white/30">Change Photo</span>
                                    </div>
                                )}
                            </label>

                             {/* Camera FAB */}
                             {!advisorPreview && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); startAdvisorCamera(); }}
                                    className="absolute bottom-6 right-6 w-14 h-14 bg-gray-900 dark:bg-white text-white dark:text-stone-950 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform z-20 border-4 border-white dark:border-stone-950"
                                >
                                    <CameraIcon className="w-6 h-6" />
                                </button>
                             )}
                         </div>

                         {error && (
                            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900">
                                {error}
                            </motion.div>
                         )}

                         <button 
                            onClick={executeStyleAnalysis}
                            disabled={!advisorFile}
                            className="w-full py-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-stone-950 font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mt-auto mb-6"
                         >
                             <span>Get Analysis</span>
                             <ChevronRightIcon className="w-5 h-5" />
                         </button>
                     </motion.div>
                )}
                
                 {/* State 2: Camera View */}
                {isAdvisorCameraOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full h-full flex flex-col items-center justify-center relative bg-black"
                    >
                        <video 
                            ref={videoRef}
                            autoPlay 
                            playsInline 
                            muted
                            className="w-full h-full object-cover transform -scale-x-100 opacity-80" // Mirror effect
                        />
                         
                        <div className="absolute top-8 left-0 right-0 text-center">
                             <span className="bg-black/50 backdrop-blur px-4 py-1 rounded-full text-white/80 text-xs uppercase tracking-widest font-medium">Position outfit in frame</span>
                        </div>

                        {/* Camera Controls */}
                        <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-12 z-20">
                            <button
                                onClick={stopAdvisorCamera}
                                className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                            
                            <button
                                onClick={captureAdvisorPhoto}
                                className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center"
                            >
                                <div className="w-16 h-16 bg-white rounded-full hover:scale-95 transition-transform duration-100"></div>
                            </button>
                            
                            <div className="w-14"></div> {/* Spacer */}
                        </div>
                    </motion.div>
                )}

                {/* State 3: Analyzing (Scanning Animation) */}
                {isAnalyzing && (
                    <motion.div 
                        key="analyzing"
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex flex-col items-center justify-center h-full w-full relative"
                    >
                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl">
                             <img src={advisorPreview!} alt="Scanning" className="w-full h-full object-cover filter grayscale opacity-50" />
                             <div className="absolute inset-0 bg-green-900/20 mix-blend-overlay" />
                             
                             {/* Scanning Line */}
                             <motion.div 
                                className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] z-10"
                                animate={{ top: ["0%", "100%", "0%"] }}
                                transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                             />
                             
                             <div className="absolute bottom-8 left-0 right-0 text-center">
                                 <motion.div 
                                    className="inline-block bg-black/70 backdrop-blur-md border border-cyan-500/30 text-cyan-400 px-6 py-2 rounded-full font-mono text-xs uppercase tracking-widest"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                 >
                                     Analyzing Texture...
                                 </motion.div>
                             </div>
                        </div>
                    </motion.div>
                )}

                {/* State 4: Editorial Result */}
                {advisorResult && (
                    <motion.div
                        key="advisor-result"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full h-full flex flex-col items-center justify-center p-0 md:p-6"
                    >
                        {/* Main Card */}
                        <div className="w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-stone-900 md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative ring-1 ring-gray-900/5 dark:ring-white/10">
                            
                            {/* Close Button */}
                            <button 
                                onClick={resetAdvisor}
                                className="absolute top-4 right-4 z-50 p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 backdrop-blur-md rounded-full text-gray-900 dark:text-white"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>

                            {/* Left Column: Image & Verdict */}
                            <div className="w-full md:w-[40%] h-[35vh] md:h-full relative bg-gray-100 dark:bg-stone-800">
                                {advisorPreview && (
                                    <img src={advisorPreview} alt="Analyzed Outfit" className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
                                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                                    <div className="inline-block px-3 py-1 mb-3 rounded-full bg-white/20 backdrop-blur border border-white/20 text-xs font-medium uppercase tracking-widest">
                                        Style Report
                                    </div>
                                    <div className="font-serif text-3xl md:text-4xl leading-tight mb-2">
                                        "{advisorResult.verdict}"
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Analysis Grid */}
                            <div className="flex-1 h-full overflow-y-auto bg-gray-50 dark:bg-stone-950 p-6 md:p-10 custom-scrollbar flex flex-col">
                                
                                {/* Header & Score - Redesigned SVG Gauge */}
                                <div className="flex flex-col items-center justify-center mb-8 relative">
                                    <div className="relative w-56 h-56 flex items-center justify-center">
                                        
                                        {/* SVG Gauge */}
                                        <svg width="220" height="220" className="transform -rotate-90">
                                            {/* Background Circle */}
                                            <circle
                                                cx="110"
                                                cy="110"
                                                r={radius}
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                className="text-gray-100 dark:text-stone-800"
                                            />
                                            {/* Progress Circle */}
                                            <motion.circle
                                                cx="110"
                                                cy="110"
                                                r={radius}
                                                fill="transparent"
                                                stroke={scoreColor}
                                                strokeWidth="8"
                                                strokeLinecap="round"
                                                strokeDasharray={circumference}
                                                initial={{ strokeDashoffset: circumference }}
                                                animate={{ strokeDashoffset: circumference - progress }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                            />
                                        </svg>
                                        
                                        {/* Center Text */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <motion.span 
                                                className="text-7xl font-serif text-gray-900 dark:text-stone-100 leading-none relative"
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.5, duration: 0.5 }}
                                            >
                                                {score}
                                                <span className="absolute -top-2 -right-6 text-2xl text-amber-500">
                                                    <SparklesIcon className="w-5 h-5 fill-current" />
                                                </span>
                                            </motion.span>
                                            <span className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mt-2">/ 10 Score</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-stone-400 text-xs uppercase tracking-wider font-semibold">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div> Fit Analysis
                                        </div>
                                        <p className="text-gray-900 dark:text-stone-200 text-sm leading-relaxed">
                                            {advisorResult.fitAnalysis}
                                        </p>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-stone-400 text-xs uppercase tracking-wider font-semibold">
                                            <div className="w-2 h-2 rounded-full bg-purple-500"></div> Color Palette
                                        </div>
                                        <p className="text-gray-900 dark:text-stone-200 text-sm leading-relaxed">
                                            {advisorResult.colorCoordination}
                                        </p>
                                    </div>

                                    <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-stone-400 text-xs uppercase tracking-wider font-semibold">
                                            <div className="w-2 h-2 rounded-full bg-orange-500"></div> Best Occasion
                                        </div>
                                        <p className="text-gray-900 dark:text-stone-200 text-sm leading-relaxed">
                                            {advisorResult.occasion}
                                        </p>
                                    </div>

                                    <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-stone-400 text-xs uppercase tracking-wider font-semibold">
                                            <div className="w-2 h-2 rounded-full bg-pink-500"></div> Key Accessory
                                        </div>
                                        <p className="text-gray-900 dark:text-stone-200 text-sm leading-relaxed">
                                            {advisorResult.accessory}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-auto pt-6 border-t border-gray-200 dark:border-stone-800 flex gap-4">
                                    <button 
                                        onClick={resetAdvisor}
                                        className="flex-1 py-4 rounded-xl bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold hover:shadow-lg transition-all"
                                    >
                                        Analyze New Look
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

            </motion.div>
          </AnimatePresence>
      );
  }

  // --- Render: Compare Mode ---
  if (mode === 'compare') {
      return (
          <AnimatePresence mode="wait">
            <motion.div
                key="compare"
                // No scroll allowed (overflow-hidden) and constrained to full height
                className="w-full h-full flex flex-col items-center px-4 md:pt-0 md:justify-center relative overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Back Button */}
                <button 
                    onClick={() => {
                        setMode('selection');
                        resetCompare();
                    }}
                    className="absolute top-0 left-6 z-40 flex items-center gap-2 text-gray-500 dark:text-stone-400 hover:text-gray-900 dark:hover:text-stone-100 transition-colors py-4"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                    <span>Back to Home</span>
                </button>

                {/* Step 1: Upload Base Model */}
                {compareStep === 'upload-base' && (
                     <motion.div 
                        key="step1"
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="w-full h-full max-w-md flex flex-col items-center justify-between md:justify-center gap-4 py-8 md:py-4 mt-8 md:mt-0"
                     >
                         <div className="text-center flex-shrink-0">
                             <h2 className="text-2xl md:text-3xl font-serif text-gray-900 dark:text-stone-50">First, upload your photo</h2>
                             <p className="text-sm md:text-base text-gray-500 dark:text-stone-400">This will be used to create the model.</p>
                         </div>
                         
                         <label className="w-full flex-1 min-h-0 md:max-h-[60vh] rounded-3xl border-2 border-dashed border-gray-300 dark:border-stone-700 hover:border-gray-900 dark:hover:border-stone-400 bg-gray-50 dark:bg-stone-900 flex flex-col items-center justify-center cursor-pointer transition-colors group relative overflow-hidden my-4">
                             {compareBasePreview ? (
                                 <img src={compareBasePreview} alt="Base" className="w-full h-full object-contain object-center p-2" />
                             ) : (
                                 <>
                                     <div className="p-4 rounded-full bg-white dark:bg-stone-800 shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                         <PlusIcon className="w-6 h-6 text-gray-400 dark:text-stone-500" />
                                     </div>
                                     <span className="text-sm font-medium text-gray-500 dark:text-stone-400">Upload Photo</span>
                                 </>
                             )}
                             <input type="file" className="hidden" accept="image/*" onChange={handleCompareBaseUpload} />
                             {compareBasePreview && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">Change Photo</div>
                             )}
                         </label>

                         <button 
                            onClick={() => setCompareStep('upload-garments')}
                            disabled={!compareBaseFile}
                            className="w-full py-4 flex-shrink-0 rounded-full bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                         >
                             <span>Next Step</span>
                             <ChevronRightIcon className="w-4 h-4" />
                         </button>
                     </motion.div>
                )}

                {/* Step 2: Upload Garments */}
                {compareStep === 'upload-garments' && (
                    <motion.div 
                       key="step2"
                       variants={itemVariants}
                       initial="hidden"
                       animate="visible"
                       exit="hidden"
                       className="w-full h-full max-w-4xl flex flex-col items-center py-4 px-2 md:justify-center md:gap-8 mt-8 md:mt-0"
                    >
                         <div className="text-center flex-shrink-0 mb-2 md:mb-0">
                            <h2 className="text-xl md:text-3xl font-serif text-gray-900 dark:text-stone-50">Select outfits</h2>
                            <p className="text-xs md:text-base text-gray-500 dark:text-stone-400">Upload two different garments.</p>
                         </div>
                         
                         {/* Input Container - Side by side on mobile too to save vertical space */}
                         <div className="flex flex-row gap-2 md:gap-6 w-full flex-1 min-h-0 justify-center items-stretch mb-2">
                             {/* Garment 1 */}
                             <div className="flex flex-col gap-1 items-center flex-1 min-h-0">
                                 <span className="font-serif text-base md:text-lg text-gray-800 dark:text-stone-200 flex-shrink-0">Outfit A</span>
                                 <label className="w-full flex-1 min-h-0 rounded-3xl border-2 border-dashed border-gray-300 dark:border-stone-700 hover:border-gray-900 dark:hover:border-stone-400 bg-gray-50 dark:bg-stone-900 flex flex-col items-center justify-center cursor-pointer transition-colors group relative overflow-hidden">
                                     {compareGarment1Preview ? (
                                         <img src={compareGarment1Preview} alt="Garment 1" className="w-full h-full object-contain p-2" />
                                     ) : (
                                         <div className="flex flex-col items-center p-2">
                                             <PlusIcon className="w-6 h-6 md:w-8 md:h-8 text-gray-400 dark:text-stone-500 mb-1" />
                                             <span className="text-[10px] md:text-xs text-gray-500 text-center">Tap to upload</span>
                                         </div>
                                     )}
                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompareGarmentUpload(e, 1)} />
                                 </label>
                             </div>

                             <div className="hidden md:flex items-center text-gray-300 dark:text-stone-700 font-serif italic text-2xl px-2">VS</div>

                             {/* Garment 2 */}
                             <div className="flex flex-col gap-1 items-center flex-1 min-h-0">
                                 <span className="font-serif text-base md:text-lg text-gray-800 dark:text-stone-200 flex-shrink-0">Outfit B</span>
                                 <label className="w-full flex-1 min-h-0 rounded-3xl border-2 border-dashed border-gray-300 dark:border-stone-700 hover:border-gray-900 dark:hover:border-stone-400 bg-gray-50 dark:bg-stone-900 flex flex-col items-center justify-center cursor-pointer transition-colors group relative overflow-hidden">
                                     {compareGarment2Preview ? (
                                         <img src={compareGarment2Preview} alt="Garment 2" className="w-full h-full object-contain p-2" />
                                     ) : (
                                         <div className="flex flex-col items-center p-2">
                                             <PlusIcon className="w-6 h-6 md:w-8 md:h-8 text-gray-400 dark:text-stone-500 mb-1" />
                                             <span className="text-[10px] md:text-xs text-gray-500 text-center">Tap to upload</span>
                                         </div>
                                     )}
                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompareGarmentUpload(e, 2)} />
                                 </label>
                             </div>
                         </div>

                         {error && (
                            <p className="text-red-500 text-xs md:text-sm bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-900 flex-shrink-0">{error}</p>
                         )}

                         <div className="flex gap-3 md:gap-4 w-full max-w-md flex-shrink-0 pt-2 pb-safe">
                             <button 
                                onClick={() => setCompareStep('upload-base')}
                                className="flex-1 py-3 md:py-4 rounded-full bg-gray-100 dark:bg-stone-800 text-gray-600 dark:text-stone-300 font-medium hover:bg-gray-200 dark:hover:bg-stone-700 transition-colors text-sm md:text-base"
                             >
                                Back
                             </button>
                             <button 
                                onClick={executeComparison}
                                disabled={!compareGarment1File || !compareGarment2File}
                                className="flex-[2] py-3 md:py-4 rounded-full bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-all shadow-lg text-sm md:text-base"
                             >
                                Generate & Compare
                             </button>
                         </div>
                    </motion.div>
                )}

                {/* Step 3: Generating */}
                {compareStep === 'generating' && (
                    <motion.div 
                        key="generating"
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex flex-col items-center justify-center h-full w-full"
                    >
                        <ProcessingLoader message={compareLoadingMsg || "Processing..."} subMessage="Analyzing garments and poses..." />
                    </motion.div>
                )}

                {/* Step 3.5: Choose View */}
                {compareStep === 'choose-view' && (
                    <motion.div
                        key="choose-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center w-full h-full gap-8 max-w-4xl"
                    >
                        <div className="text-center">
                            <h2 className="text-3xl font-serif text-gray-900 dark:text-stone-50 mb-2">How would you like to compare?</h2>
                            <p className="text-gray-500 dark:text-stone-400">Choose the viewing mode that works best for you.</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl px-4">
                             <button
                                onClick={() => handleViewSelect('side-by-side')}
                                className="flex-1 p-6 rounded-3xl bg-white dark:bg-stone-900 border-2 border-transparent hover:border-gray-200 dark:hover:border-stone-700 shadow-lg hover:shadow-xl transition-all group text-left"
                             >
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-stone-800 flex items-center justify-center mb-4 text-gray-900 dark:text-stone-100 group-hover:scale-110 transition-transform">
                                    <div className="flex gap-1">
                                        <div className="w-3 h-4 border border-current rounded-sm"></div>
                                        <div className="w-3 h-4 border border-current rounded-sm"></div>
                                    </div>
                                </div>
                                <h3 className="text-xl font-serif text-gray-900 dark:text-stone-50 mb-1">Side by Side</h3>
                                <p className="text-sm text-gray-500 dark:text-stone-400">View both outfits next to each other.</p>
                             </button>

                             <button
                                onClick={() => handleViewSelect('slider')}
                                className="flex-1 p-6 rounded-3xl bg-white dark:bg-stone-900 border-2 border-transparent hover:border-gray-200 dark:hover:border-stone-700 shadow-lg hover:shadow-xl transition-all group text-left"
                             >
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-stone-800 flex items-center justify-center mb-4 text-gray-900 dark:text-stone-100 group-hover:scale-110 transition-transform">
                                     {/* Simple slider icon representation */}
                                     <div className="w-6 h-4 border border-current rounded-sm relative overflow-hidden">
                                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-current"></div>
                                     </div>
                                </div>
                                <h3 className="text-xl font-serif text-gray-900 dark:text-stone-50 mb-1">Compare Slider</h3>
                                <p className="text-sm text-gray-500 dark:text-stone-400">Interactive slider to sweep between looks.</p>
                             </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 4: Result */}
                {compareStep === 'result' && compareResult1 && compareResult2 && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center w-full h-full pt-14 pb-6 overflow-hidden" 
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 w-full max-w-4xl flex items-center justify-between px-6 mb-2 z-10">
                             <h2 className="text-xl md:text-2xl font-serif text-gray-900 dark:text-stone-50">Compare Results</h2>
                             <button
                                onClick={() => setCompareStep('choose-view')}
                                className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-stone-400 dark:hover:text-stone-100 underline decoration-gray-300 underline-offset-4"
                             >
                                Change View
                             </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 w-full min-h-0 px-4 flex items-center justify-center">

                            {compareViewMode === 'slider' ? (
                                // Slider View
                                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                                     <div className="relative w-full max-w-xl h-full max-h-[60vh] md:max-h-[65vh] aspect-[3/4] bg-white dark:bg-stone-900 rounded-2xl shadow-xl overflow-hidden ring-1 ring-gray-900/5 dark:ring-white/10">
                                        <Compare
                                            firstImage={compareResult1}
                                            secondImage={compareResult2}
                                            className="w-full h-full"
                                            slideMode="drag" 
                                        />
                                    </div>
                                    {/* Download Buttons for Slider */}
                                    <div className="flex gap-3 w-full max-w-md justify-center flex-shrink-0">
                                        <button
                                            onClick={() => handleDownload(compareResult1, 'outfit-a.png')}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-stone-800 rounded-full shadow-sm text-sm font-medium hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors border border-gray-200 dark:border-stone-700"
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                            <span>Outfit A</span>
                                        </button>
                                        <button
                                            onClick={() => handleDownload(compareResult2, 'outfit-b.png')}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-stone-800 rounded-full shadow-sm text-sm font-medium hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors border border-gray-200 dark:border-stone-700"
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                            <span>Outfit B</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Twin View (Side by Side in one frame)
                                <div className="relative w-full max-w-5xl h-full max-h-[60vh] md:max-h-[70vh] flex shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-stone-900 ring-1 ring-gray-900/5 dark:ring-white/10">
                                     
                                     {/* Left Half */}
                                     <div className="flex-1 h-full relative group border-r border-white/10 bg-black/5 dark:bg-black/20">
                                          <img 
                                            src={compareResult1} 
                                            alt="Outfit A" 
                                            className="w-full h-full object-contain object-center" 
                                          />
                                          {/* Overlay Gradient */}
                                          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                          
                                          {/* Controls */}
                                          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
                                              <span className="text-white font-serif text-lg tracking-wide drop-shadow-md">Outfit A</span>
                                              <button
                                                onClick={() => handleDownload(compareResult1, 'outfit-a.png')}
                                                className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-all hover:scale-105 active:scale-95"
                                                title="Download Outfit A"
                                              >
                                                 <DownloadIcon className="w-5 h-5" />
                                              </button>
                                          </div>
                                     </div>

                                     {/* Right Half */}
                                     <div className="flex-1 h-full relative group bg-black/5 dark:bg-black/20">
                                          <img 
                                            src={compareResult2} 
                                            alt="Outfit B" 
                                            className="w-full h-full object-contain object-center" 
                                          />
                                           {/* Overlay Gradient */}
                                          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                                          {/* Controls */}
                                          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
                                              <span className="text-white font-serif text-lg tracking-wide drop-shadow-md">Outfit B</span>
                                              <button
                                                onClick={() => handleDownload(compareResult2, 'outfit-b.png')}
                                                className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-all hover:scale-105 active:scale-95"
                                                title="Download Outfit B"
                                              >
                                                 <DownloadIcon className="w-5 h-5" />
                                              </button>
                                          </div>
                                     </div>
                                </div>
                            )}

                        </div>

                        {/* Footer Button */}
                        <div className="flex-shrink-0 w-full px-6 pt-4 pb-safe">
                            <button
                                onClick={resetCompare}
                                className="w-full max-w-md mx-auto block py-4 rounded-full bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-black dark:hover:bg-white transition-all shadow-lg font-semibold text-base"
                            >
                                Start New Comparison
                            </button>
                        </div>
                    </motion.div>
                )}

            </motion.div>
          </AnimatePresence>
      );
  }

  // --- Render: Try-On Mode (Existing) ---
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="try-on"
        className="w-full h-full max-w-4xl mx-auto flex flex-col items-center justify-center px-6 overflow-hidden relative"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Back Button for Try-On Mode */}
         {!generatedModelUrl && !isGenerating && !isCameraOpen && (
             <button 
                onClick={() => setMode('selection')}
                className="absolute top-0 left-6 z-40 flex items-center gap-2 text-gray-500 dark:text-stone-400 hover:text-gray-900 dark:hover:text-stone-100 transition-colors py-4"
            >
                <ChevronLeftIcon className="w-5 h-5" />
                <span>Back</span>
            </button>
         )}

        {/* Header Text - Flexible height, shrinks if needed */}
        {!generatedModelUrl && !isGenerating && !isCameraOpen && (
          <motion.div variants={itemVariants} className="text-center mb-6 md:mb-12 flex-shrink-0 z-10 pt-8">
            <h1 className="text-4xl md:text-7xl font-serif text-gray-900 dark:text-stone-50 mb-4 leading-tight">
              Virtual <br className="hidden md:block" />
              <span className="italic text-gray-600 dark:text-stone-400">Fitting Room</span>
            </h1>
            <p className="text-gray-500 dark:text-stone-400 font-sans text-base md:text-lg max-w-md mx-auto hidden sm:block">
              Upload a photo to create your digital twin and start styling instantly.
            </p>
          </motion.div>
        )}

        {/* State 1: Upload (Initial) */}
        {!isGenerating && !generatedModelUrl && !isCameraOpen && (
          <motion.div variants={itemVariants} className="w-full max-w-md flex-shrink-1 min-h-0 flex flex-col items-center justify-center">
             <div 
                className={`relative w-full aspect-[4/5] md:aspect-square max-h-[50vh] bg-white dark:bg-stone-900 rounded-3xl border-2 transition-all duration-300 ease-out flex flex-col items-center justify-center gap-6 group overflow-hidden shadow-sm hover:shadow-xl ${isHovering ? 'border-gray-900 dark:border-stone-500 scale-[1.02]' : 'border-dashed border-gray-300 dark:border-stone-700'}`}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
             >
                <input 
                  id="image-upload-start" 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleFileChange} 
                />
                
                <div className={`p-6 rounded-full bg-gray-50 dark:bg-stone-800 transition-transform duration-500 ${isHovering ? 'scale-110 bg-gray-100 dark:bg-stone-700' : ''}`}>
                    <PlusIcon className="w-8 h-8 text-gray-400 dark:text-stone-500" />
                </div>
                <div className="text-center px-6 pointer-events-none">
                    <span className="block font-serif text-2xl text-gray-900 dark:text-stone-100 mb-2">Upload your photo</span>
                    <span className="text-sm text-gray-500 dark:text-stone-500 font-medium">Drag & drop or click to browse</span>
                </div>
                
                {/* Camera Button placed inside but with higher z-index to be clickable */}
                <div className="absolute bottom-6 z-30 pointer-events-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); startCamera(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-stone-800 hover:bg-gray-200 dark:hover:bg-stone-700 rounded-full text-sm font-medium text-gray-700 dark:text-stone-300 transition-colors"
                    >
                        <CameraIcon className="w-4 h-4" />
                        <span>Use Camera</span>
                    </button>
                </div>
             </div>
             {error && (
                <motion.p 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="text-red-500 text-sm mt-4 text-center bg-red-50 dark:bg-red-900/20 py-2 px-4 rounded-full border border-red-100 dark:border-red-900 flex-shrink-0"
                >
                  {error}
                </motion.p>
             )}
          </motion.div>
        )}

        {/* State 1b: Camera View */}
        {isCameraOpen && (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md aspect-[4/5] md:aspect-square max-h-[50vh] relative bg-black rounded-3xl overflow-hidden shadow-2xl"
            >
                <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover transform -scale-x-100" // Mirror effect
                />
                
                <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-3xl z-10"></div>
                
                {/* Camera Controls */}
                <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-8 z-20">
                     <button
                        onClick={stopCamera}
                        className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-colors"
                        aria-label="Close Camera"
                     >
                         <XIcon className="w-6 h-6" />
                     </button>
                     
                     <button
                        onClick={capturePhoto}
                        className="p-1 rounded-full border-4 border-white/80 hover:scale-105 transition-transform"
                        aria-label="Capture Photo"
                     >
                        <div className="w-14 h-14 bg-white rounded-full"></div>
                     </button>
                     
                     <div className="w-12"></div> {/* Spacer to center the capture button */}
                </div>
            </motion.div>
        )}

        {/* State 2: Generating */}
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col items-center justify-center h-full w-full"
          >
            <ProcessingLoader message="Constructing Model" subMessage="Stitching your digital twin..." />
          </motion.div>
        )}

        {/* State 3: Result Display */}
        {generatedModelUrl && !isGenerating && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center gap-6 w-full max-w-2xl h-full py-4"
          >
             <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-stone-900 p-2 border border-white dark:border-stone-800 flex-shrink-1 min-h-0">
               <img 
                 src={generatedModelUrl} 
                 alt="Generated Model" 
                 className="w-auto h-auto max-h-[55vh] object-contain rounded-2xl"
               />
             </div>
             
             <div className="flex items-center gap-4 flex-shrink-0">
                <button 
                  onClick={handleReset}
                  className="px-8 py-4 text-sm font-semibold text-gray-600 dark:text-stone-400 hover:text-gray-900 dark:hover:text-stone-100 transition-colors"
                >
                  Retake
                </button>
                <button 
                  onClick={() => onModelFinalized(generatedModelUrl!)}
                  className="px-10 py-4 text-sm font-semibold text-white bg-gray-900 dark:bg-stone-100 dark:text-stone-950 rounded-full hover:bg-black dark:hover:bg-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Enter Studio
                </button>
             </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default StartScreen;
