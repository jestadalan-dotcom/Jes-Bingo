import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateThemedItems = async (theme: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a list of 60 unique, short, punchy, and fun terms or phrases related to the Bingo theme: "${theme}". 
      Keep each item under 5 words. Make them distinct enough to be fun for a game.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    
    const items = JSON.parse(jsonStr) as string[];
    // Ensure we have enough items, duplicate if necessary (fallback logic) although model usually respects count
    if (items.length < 24) {
      // Emergency fallback if model fails to generate enough
      return [...items, ...items, ...items].slice(0, 60).map((i, idx) => `${i} ${idx}`);
    }
    return items;
  } catch (error) {
    console.error("Failed to generate themed items:", error);
    throw new Error("Failed to generate Bingo theme. Please try again or use Standard mode.");
  }
};