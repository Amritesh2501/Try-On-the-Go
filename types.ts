
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // Primary garment (kept for backward compatibility)
  garments?: WardrobeItem[]; // For multi-garment layers
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}

export interface StyleAdvice {
  score: number;
  verdict: string;
  fitAnalysis: string;
  colorCoordination: string;
  occasion: string;
  accessory: string;
}
