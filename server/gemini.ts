import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env and .env.local if present
dotenv.config();
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is missing. Smart Search and Extraction will fallback gracefully.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'missing-key',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export async function generateJSON<T = any>(prompt: string, systemInstruction?: string): Promise<T | null> {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'You are an expert financial assistant. Return valid JSON only.',
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) return null;

    // Clean JSON fences if any remain
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleanJson) as T;
  } catch (err) {
    console.error('Gemini API generateJSON error:', err);
    return null;
  }
}

export async function generateNarrativeText(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'You are an expert financial advisor summarizing monthly user spending concisely and encouragingly.',
        temperature: 0.4,
      },
    });

    return response.text?.trim() || 'No narrative generated.';
  } catch (err) {
    console.error('Gemini API generateNarrative error:', err);
    return 'Detailed narrative currently unavailable. Please review category breakdown above.';
  }
}
