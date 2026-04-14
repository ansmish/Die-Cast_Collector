import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CarDetails {
  brand: string;
  modelName: string;
  series?: string;
  year?: string;
  color?: string;
  scale?: string;
}

export async function identifyCarFromImage(base64Image: string): Promise<CarDetails> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: "Analyze this image of a die-cast car or its packaging. Extract the following details: brand (e.g., Hot Wheels, Matchbox), model name, series, release year, color, and scale. Return the data in JSON format.",
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          brand: { type: Type.STRING },
          modelName: { type: Type.STRING },
          series: { type: Type.STRING },
          year: { type: Type.STRING },
          color: { type: Type.STRING },
          scale: { type: Type.STRING },
        },
        required: ["brand", "modelName"],
      },
    },
  });

  return JSON.parse(response.text);
}
