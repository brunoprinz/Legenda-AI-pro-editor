import { GoogleGenAI, Type } from "@google/genai";
import { Subtitle } from "../types";

// Helper to convert audio buffer to base64 suitable for Gemini
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Downsample audio to reduce bandwidth/processing (16kHz mono)
async function processAudioForGemini(audioFile: File): Promise<string> {
  const audioContext = new OfflineAudioContext(1, 44100, 44100); // Temporary context
  
  // Read file
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer); // Use native decoder

  // Calculate new length for 16kHz
  const targetSampleRate = 16000;
  const duration = audioBuffer.duration;
  const offlineCtx = new OfflineAudioContext(1, duration * targetSampleRate, targetSampleRate);
  
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  
  const renderedBuffer = await offlineCtx.startRendering();
  
  // Convert float32 pcm to int16 for efficient transfer or just use raw data logic
  // For Gemini, we can send standard audio formats. Since we decoded to raw, 
  // let's wrap it in a simple WAV container to ensure the model understands the format/rate.
  return encodeWAV(renderedBuffer);
}

function encodeWAV(samples: AudioBuffer): string {
  const buffer = samples.getChannelData(0);
  const sampleRate = samples.sampleRate;
  const numChannels = 1;
  const length = buffer.length * 2; // 16-bit
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, length, true);

  // write the PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return bufferToBase64(arrayBuffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Helper to ensure timestamp is a number
const parseTimestamp = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Try parsing "MM:SS.mmm"
    if (val.includes(':')) {
      const parts = val.split(':');
      if (parts.length === 2) {
        return (parseInt(parts[0]) * 60) + parseFloat(parts[1]);
      }
      if (parts.length === 3) {
        return (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseFloat(parts[2]);
      }
    }
    return parseFloat(val);
  }
  return 0;
};

export const generateSubtitles = async (videoFile: File): Promise<Subtitle[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 1. Prepare Audio (Client-side optimization)
  const base64Audio = await processAudioForGemini(videoFile);
  
  // 2. Call Gemini
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        },
        {
          text: `Transcreva o áudio fornecido para legendas em Português.
          Retorne APENAS um JSON array válido.
          Certifique-se de cobrir todo o conteúdo do áudio.
          
          Cada objeto deve ter:
          - "start": tempo em SEGUNDOS (number) ex: 12.5
          - "end": tempo em SEGUNDOS (number) ex: 14.2
          - "text": o texto falado.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.NUMBER, description: "Start time in seconds" },
            end: { type: Type.NUMBER, description: "End time in seconds" },
            text: { type: Type.STRING, description: "Subtitle text" }
          },
          required: ["start", "end", "text"]
        }
      }
    }
  });

  let rawData: any[] = [];
  const responseText = response.text || "[]";

  try {
    rawData = JSON.parse(responseText);
  } catch (e) {
    console.warn("JSON parse failed, attempting regex extraction to recover partial data", e);
    // Fallback: Extract valid JSON objects even if the array isn't closed properly
    // This handles cases where output tokens are truncated
    const regex = /\{\s*"start"\s*:\s*[\d\.]+\s*,\s*"end"\s*:\s*[\d\.]+\s*,\s*"text"\s*:\s*"[^"]*"\s*\}/g;
    // Note: The regex above is simple and might miss objects with extra spaces or escaped quotes differently.
    // A more lenient approach is usually trying to match balanced braces, but for this specific schema, simple is often enough.
    // Let's try a slightly more robust regex for the specific schema keys
    const relaxedRegex = /\{[^}]*"start"[^}]*"end"[^}]*"text"[^}]*\}/g;
    
    const matches = responseText.match(relaxedRegex);
    if (matches) {
      rawData = matches.map(m => {
        try { return JSON.parse(m); } catch { return null; }
      }).filter(x => x);
    }
  }
  
  return rawData.map((item: any, index: number) => ({
    id: `auto-${index}-${Date.now()}`,
    startTime: parseTimestamp(item.start),
    endTime: parseTimestamp(item.end),
    text: item.text
  }));
};