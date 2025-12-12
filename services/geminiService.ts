
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { StyleAdvice } from "../types";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            // Validate data length to prevent empty images
            if (!data || data.length === 0) {
                continue;
            }
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash-image';

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const systemInstruction = "You are an expert fashion photographer AI. Your goal is to transform regular photos into professional e-commerce model shots.";
    const prompt = "Transform the person in this image into a full-body fashion model photo suitable for a high-end e-commerce website. The background must be a clean, matte, neutral-toned high-fashion studio backdrop (soft beige or cool grey) with professional soft-box lighting. Ensure the background is solid and distraction-free to make the subject pop. The person should have a neutral, professional model expression. Preserve the person's identity, unique features, and body type, but place them in a standard, relaxed standing model pose. The final image must be photorealistic. Return ONLY the final image.";
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    
    const systemInstruction = "You are a specialized virtual try-on assistant. Your sole job is to photorealistically modify the clothing of a person in an image.";
    
    const prompt = `Perform a virtual try-on task.
    
    Input Image 1: The 'Model'.
    Input Image 2: The 'Garment' to be worn.
    
    Instructions:
    1. Identify the garment shown in Input Image 2.
    2. Replace the top/clothing worn by the Model in Input Image 1 with the Garment from Input Image 2.
    3. Ensure the Garment fits the Model's body shape and pose naturally. Apply realistic lighting, shadows, and fabric folds.
    4. CRITICAL: Preserve the Model's face, hair, skin tone, hands, and the original background EXACTLY as they are. Do not change the person's identity.
    5. Return ONLY the final, edited image.`;

    const response = await ai.models.generateContent({
        model,
        // The order of parts implies the inputs referenced in the prompt
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction
        },
    });
    return handleApiResponse(response);
};

export const generateMultiGarmentTryOn = async (modelImageUrl: string, garmentFiles: File[]): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    // Convert all garment files to parts in parallel
    const garmentParts = await Promise.all(garmentFiles.map(f => fileToPart(f)));
    
    const systemInstruction = "You are an expert virtual stylist and visual editor. You specialize in dressing models in complete outfits composed of multiple distinct items.";

    let prompt = `Compose a complete outfit on the model.

    Input Image 1: The Base Model.
    `;
    
    // Add references for the prompt
    garmentParts.forEach((_, index) => {
        prompt += `Input Image ${index + 2}: Garment Item ${index + 1}.\n`;
    });

    prompt += `
    Instructions:
    1. Dress the Base Model (Image 1) in ALL the provided Garment Items (Images 2-${garmentParts.length + 1}) simultaneously.
    2. Intelligence: Determine logically where each item goes (e.g., shoes on feet, pants on legs, shirt on torso, hat on head).
    3. Layering: Ensure items are layered correctly (e.g., shirts tucked into pants if appropriate, jackets over shirts).
    4. Realism: Apply realistic fabric physics, shadows, and lighting to match the model's environment. The items must look like they are worn, not just pasted.
    5. CRITICAL: Preserve the Model's face, identity, skin tone, and the original background.
    6. Return ONLY the final generated image.
    `;

    // Construct the parts array: Model first, then all garments, then the prompt
    const parts = [modelImagePart, ...garmentParts, { text: prompt }];

    const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    
    const systemInstruction = "You are an expert fashion photographer AI. You specialize in generating different angles and poses for fashion models.";

    const prompt = `Regenerate this image from a different perspective.
    
    Target Pose: "${poseInstruction}".
    
    Instructions:
    1. Keep the person, their clothing, and the background style EXACTLY as they appear in the original image.
    2. Change ONLY the pose and camera angle to match the Target Pose.
    3. Ensure photorealistic quality.
    4. Return ONLY the final image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction
        },
    });
    return handleApiResponse(response);
};

export const generateSceneVariation = async (currentImageUrl: string, sceneDescription: string): Promise<string> => {
    const imagePart = dataUrlToPart(currentImageUrl);
    
    const systemInstruction = "You are an expert digital artist. Your goal is to change the background of an image while preserving the foreground subject exactly.";

    const prompt = `Change the background of this image.
    
    Target Scene: "${sceneDescription}".
    
    Instructions:
    1. Keep the person (model) and their clothing EXACTLY as they appear in the original image. Do not change their pose, lighting on the body, or facial features.
    2. Replace the current background with a high-quality, photorealistic representation of the Target Scene.
    3. Ensure the lighting of the background matches the lighting of the subject realistically.
    4. Return ONLY the final image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction
        },
    });
    return handleApiResponse(response);
};

export const generateGarmentFromText = async (description: string): Promise<string> => {
    const systemInstruction = "You are a high-end fashion designer. Your goal is to create product-style images of clothing garments based on text descriptions.";
    
    const prompt = `Create a photorealistic fashion product image of: "${description}".
    
    Instructions:
    1. Generate a "flat lay" or "ghost mannequin" style image of the garment.
    2. The background must be pure white or very soft light gray (studio setting).
    3. Show the entire garment clearly.
    4. High detail on fabric texture and cut.
    5. Return ONLY the image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            systemInstruction
        },
    });
    return handleApiResponse(response);
};

export const generateStyleAdvice = async (imageUrl: string): Promise<StyleAdvice> => {
    const imagePart = dataUrlToPart(imageUrl);
    const prompt = "Analyze this outfit and return structured advice.";

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER, description: "Rating from 1-10" },
                    verdict: { type: Type.STRING, description: "A chic, 1-sentence summary of the look." },
                    fitAnalysis: { type: Type.STRING, description: "Concise analysis of the fit." },
                    colorCoordination: { type: Type.STRING, description: "Comments on the color palette." },
                    occasion: { type: Type.STRING, description: "Best occasion for this outfit." },
                    accessory: { type: Type.STRING, description: "One specific accessory recommendation." },
                },
                required: ["score", "verdict", "fitAnalysis", "colorCoordination", "occasion", "accessory"]
            }
        },
    });
    
    if (response.text) {
        return JSON.parse(response.text) as StyleAdvice;
    }
    
    throw new Error("Failed to generate advice");
};
