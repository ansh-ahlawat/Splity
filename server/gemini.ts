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
          'x-goog-api-key': apiKey || '',
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export let lastGeminiError: { message: string; timestamp: number } | null = null;

export const GEMINI_LIMIT_NOTE = 'Gemini API limit hit for Today, try later.\n\n';

export function isGeminiLimitHit(): boolean {
  if (!lastGeminiError) return false;
  if (Date.now() - lastGeminiError.timestamp > 60 * 60 * 1000) return false;
  const msg = lastGeminiError.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('exhausted') ||
    msg.includes('credit') ||
    msg.includes('limit')
  );
}

function withTimeout<T>(promise: Promise<T>, ms = 4500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI generation timed out')), ms)),
  ]);
}

export async function generateJSON<T = any>(prompt: string, systemInstruction?: string): Promise<T | null> {
  try {
    const ai = getGeminiClient();
    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'You are an expert financial assistant. Return valid JSON only.',
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const response = await withTimeout(callPromise, 4500);
    const rawText = response.text?.trim();
    if (!rawText) return null;

    // Clean JSON fences if any remain
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleanJson) as T;
  } catch (err: any) {
    lastGeminiError = { message: String(err?.message || err), timestamp: Date.now() };
    console.warn('Gemini API generateJSON fallback note:', err.message || err);
    return null;
  }
}

export async function generateNarrativeText(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const ai = getGeminiClient();
    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'You are an expert financial advisor summarizing monthly user spending concisely and encouragingly.',
        temperature: 0.4,
      },
    });

    const response = await withTimeout(callPromise, 4500);
    return response.text?.trim() || '';
  } catch (err: any) {
    lastGeminiError = { message: String(err?.message || err), timestamp: Date.now() };
    console.warn('Gemini API generateNarrative fallback note:', err.message || err);
    return '';
  }
}

/**
 * Generate high-fidelity speech (TTS) using Gemini 3.8 Flash TTS
 */
export async function generateSpeech(text: string): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const ai = getGeminiClient();
    if (!(ai as any).interactions) return null;

    const interaction = await (ai as any).interactions.create({
      model: 'gemini-3.8-flash-tts',
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text,
          annotations: [{
            type: 'speech_metadata',
            style: 'clear, professional, friendly, and concise financial assistant',
          }],
        }],
      }],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [
          { voice: 'Kore' },
        ],
      },
    });

    const audioData = interaction.output_audio?.data;
    if (audioData) {
      return {
        audioBase64: audioData,
        mimeType: 'audio/wav',
      };
    }
    return null;
  } catch (err: any) {
    console.warn('Gemini generateSpeech notice:', err.message);
    return null;
  }
}
