import { GoogleGenAI } from "@google/genai";
import { StickerStyle, DesignType } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Uses a text model to rewrite the prompt based on user feedback.
 */
export const refinePrompt = async (currentPrompt: string, userInstruction: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Task: Rewrite an image generation prompt based on user feedback.
        
        Original Prompt: "${currentPrompt}"
        User Change Request: "${userInstruction}"
        
        Instructions:
        1. Keep the core subject and style of the Original Prompt unless the user explicitly asks to change it.
        2. Integrate the User Change Request naturally into the description.
        3. Return ONLY the new prompt string. Do not add explanations.
      `,
    });
    
    return response.text?.trim() || currentPrompt;
  } catch (error) {
    console.error("Error refining prompt:", error);
    return currentPrompt + " " + userInstruction; // Fallback
  }
};

/**
 * Generates a realistic mockup of a model wearing the design.
 * Takes the generated design (base64) and uses it as input for image-to-image generation.
 * Can optionally accept a custom model image (base64) to apply the design onto.
 */
export const generateMockup = async (
  designBase64: string, 
  modelDescription: string,
  customModelBase64?: string | null
): Promise<string> => {
  const performGeneration = async (retryCount = 0): Promise<string> => {
      try {
        // Clean base64 strings
        const cleanDesign = designBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        
        const parts: any[] = [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanDesign
            }
          }
        ];

        let promptText = '';

        if (customModelBase64) {
            const cleanCustomModel = customModelBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: cleanCustomModel
                }
            });

            promptText = `
              Task: Realistic Virtual Try-On / Product Compositing.
              
              Input 1: A graphic design/print.
              Input 2: A photo of a person or object (The Target).
              
              Instructions:
              1. Apply Input 1 (the graphic) onto the clothing or main surface of the subject in Input 2.
              2. PRESERVE the content, lighting, pose, and background of Input 2 exactly. Do not change the model or scene.
              3. The graphic must conform to the folds, lighting, and texture of the fabric in Input 2.
              4. Blend it realistically as if it was printed on the material.
              5. Output the final photo.
            `;
        } else {
            promptText = `
              Generate a high-quality, photorealistic fashion photography shot.
              
              Target Scene Description: ${modelDescription}
              
              Instructions:
              1. The "Subject" in the description MUST be wearing/using the product (e.g., t-shirt, hoodie, bag, cap).
              2. The INPUT IMAGE provided serves as a graphic print/decal. Apply this graphic onto the product.
              3. COMPOSITION: Ensure the graphic is clearly visible, centered, and follows the fabric folds/texture realistically.
              4. COLOR: If the description specifies a clothing color (e.g. "black hoodie"), use it. If not, default to white.
              5. LIGHTING: Use professional studio or lifestyle lighting as appropriate for the scene.
              6. Do NOT generate the graphic as a floating sticker; it must be printed ON the material.
            `;
        }

        parts.push({ text: promptText });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image', // Supports image input
          contents: {
            parts: parts
          },
          config: {
            imageConfig: {
              aspectRatio: customModelBase64 ? "1:1" : "3:4", // Maintain aspect for custom, portrait for generated
            }
          },
        });

        if (response.candidates && response.candidates.length > 0) {
          const content = response.candidates[0].content;
          if (content && content.parts) {
              for (const part of content.parts) {
                  if (part.inlineData && part.inlineData.data) {
                      const base64Data = part.inlineData.data;
                      const mimeType = part.inlineData.mimeType || 'image/png';
                      return `data:${mimeType};base64,${base64Data}`;
                  }
              }
          }
        }
        throw new Error("Failed to generate mockup image");
      } catch (error: any) {
         // Retry logic for 429
         const isRateLimit = error.status === 'RESOURCE_EXHAUSTED' || error.code === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('quota'));
         if (isRateLimit && retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
            console.warn(`Mockup rate limit hit. Retrying in ${Math.round(delay)}ms...`);
            await wait(delay);
            return performGeneration(retryCount + 1);
         }
         console.error("Error generating mockup:", error);
         throw error;
      }
  };

  return performGeneration();
};

/**
 * Removes the white background using a flood-fill algorithm.
 */
const removeWhiteBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixelStack: number[] = []; 
  const visited = new Uint8Array(width * height);
  const threshold = 230; 

  const isWhite = (idx: number) => {
    return data[idx] > threshold && data[idx+1] > threshold && data[idx+2] > threshold;
  };

  const getIndex = (x: number, y: number) => (y * width + x) * 4;
  const getVisitedIdx = (x: number, y: number) => y * width + x;

  const push = (x: number, y: number) => {
      pixelStack.push(x);
      pixelStack.push(y);
  };

  // Add boundary pixels
  for (let x = 0; x < width; x++) {
    if (isWhite(getIndex(x, 0))) push(x, 0);
    if (isWhite(getIndex(x, height - 1))) push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    if (isWhite(getIndex(0, y))) push(0, y);
    if (isWhite(getIndex(width - 1, y))) push(width - 1, y);
  }

  while (pixelStack.length > 0) {
    const y = pixelStack.pop()!;
    const x = pixelStack.pop()!;
    
    const vIdx = getVisitedIdx(x, y);
    if (visited[vIdx]) continue;
    visited[vIdx] = 1;

    const idx = getIndex(x, y);
    data[idx + 3] = 0; // Transparent

    if (x + 1 < width && !visited[getVisitedIdx(x + 1, y)] && isWhite(getIndex(x + 1, y))) push(x + 1, y);
    if (x - 1 >= 0 && !visited[getVisitedIdx(x - 1, y)] && isWhite(getIndex(x - 1, y))) push(x - 1, y);
    if (y + 1 < height && !visited[getVisitedIdx(x, y + 1)] && isWhite(getIndex(x, y + 1))) push(x, y + 1);
    if (y - 1 >= 0 && !visited[getVisitedIdx(x, y - 1)] && isWhite(getIndex(x, y - 1))) push(x, y - 1);
  }

  ctx.putImageData(imageData, 0, 0);
};

const processImage = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        removeWhiteBackground(ctx, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Generates designs based on type (Sticker or Fashion Print).
 * Can optionally accept a reference image.
 */
export const generateStickerImages = async (
  prompt: string,
  style: StickerStyle,
  count: number = 1,
  type: DesignType = DesignType.STICKER,
  referenceImageBase64?: string | null
): Promise<string[]> => {
  try {
    let fullPrompt = '';
    const parts: any[] = [];

    // If reference image exists, add it to the request parts
    if (referenceImageBase64) {
        const cleanRef = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        parts.push({
            inlineData: {
                mimeType: 'image/png', // Simple assumption, API handles most common types
                data: cleanRef
            }
        });

        // Add context about the reference image to the prompt
        fullPrompt += `
        REFERENCE IMAGE INSTRUCTIONS:
        - Use the attached image as the PRIMARY VISUAL REFERENCE.
        - Adopt the composition, pose, or subject matter from the reference image, but adapt it to match the requested STYLE [${style}].
        - Do not just copy the image; creatively reimagine it as a ${type === DesignType.STICKER ? 'vector sticker' : 'fashion graphic print'}.
        
        `;
    }

    if (type === DesignType.STICKER) {
      fullPrompt += `
        Generate a single distinct die-cut sticker illustration.
        Subject: ${prompt}
        Style: ${style}
        
        Visual Requirements:
        - A SINGLE isolated sticker element centered on the canvas.
        - Strong, clear white outline (die-cut border) surrounding the subject.
        - Pure white background (flat lighting).
        - Vector-like quality, sharp details.
        - Margin of white space around edges.
      `;
    } else {
      // FASHION PRINT MODE
      fullPrompt += `
        Generate a professional graphic print design suitable for clothing (T-shirts, hoodies, streetwear).
        Subject: ${prompt}
        Fashion Style/Aesthetic: ${style}
        
        Visual Requirements:
        - Create a high-quality, standalone graphic placement print.
        - NO die-cut white borders (unlike stickers). This is for direct-to-garment printing.
        - Composition: Centralized, balanced, and aesthetically pleasing for apparel.
        - Background: Pure white (to be removed later).
        - Style execution: Incorporate modern fashion trends, typography (if applicable to style), and professional illustration techniques suitable for the requested style (e.g., if Streetwear, make it bold and edgy; if Luxury, make it minimal and elegant).
        - Ensure high contrast and vibrant colors or stylized monochrome depending on the style.
      `;
    }

    parts.push({ text: fullPrompt });

    const model = 'gemini-2.5-flash-image';

    const fetchSingleImage = async (retryCount = 0): Promise<string> => {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: parts,
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
            }
          },
        });

        if (response.candidates && response.candidates.length > 0) {
            const content = response.candidates[0].content;
            if (content && content.parts) {
                for (const part of content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const base64Data = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        const rawUrl = `data:${mimeType};base64,${base64Data}`;
                        return await processImage(rawUrl);
                    }
                }
            }
        }
        throw new Error("No image data found");
      } catch (error: any) {
         // Retry logic for 429 Rate Limit
         const isRateLimit = error.status === 'RESOURCE_EXHAUSTED' || error.code === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('quota'));
         
         if (isRateLimit && retryCount < 3) {
             const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
             console.warn(`Rate limit hit. Retrying image generation in ${Math.round(delay)}ms...`);
             await wait(delay);
             return fetchSingleImage(retryCount + 1);
         }
         throw error;
      }
    };

    // Use sequential execution instead of Promise.all to reduce burst load
    const successfulImages: string[] = [];
    for (let i = 0; i < count; i++) {
        try {
            const img = await fetchSingleImage();
            successfulImages.push(img);
        } catch (error) {
            console.error(`Error generating image ${i+1}:`, error);
            // If it's the last attempt and we have no images, throw error
            if (i === count - 1 && successfulImages.length === 0) throw error;
        }
    }
    
    if (successfulImages.length === 0) {
        throw new Error("Failed to generate any images.");
    }
    
    return successfulImages;

  } catch (error) {
    console.error("Error generating designs:", error);
    throw error;
  }
};