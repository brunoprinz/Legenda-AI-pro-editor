import { GoogleGenAI } from "@google/genai";
import { Subtitle } from "../types";

// Helper para converter o áudio
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Otimiza o áudio para a IA (16kHz mono)
async function processAudioForGemini(audioFile: File): Promise<string> {
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);
  
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  
  const renderedBuffer = await offlineCtx.startRendering();
  return encodeWAV(renderedBuffer);
}

function encodeWAV(samples: AudioBuffer): string {
  const buffer = samples.getChannelData(0);
  const length = buffer.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 16000 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return bufferToBase64(arrayBuffer);
}

export const generateSubtitles = async (videoFile: File): Promise<Subtitle[]> => {
  // Lendo do ambiente Vite do Replit
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("API Key não encontrada no Secrets do Replit.");
  }

  const genAI = new GoogleGenAI(apiKey);
  const base64Audio = await processAudioForGemini(videoFile);
  
  // Lista de modelos para tentar (Plano de segurança)
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash-exp'];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      console.log(`Tentando IA com: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent({
        contents: [{
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
            { text: "Transcreva o áudio para legendas em Português. Retorne APENAS um JSON array com objetos contendo 'start' (number em segundos), 'end' (number) e 'text' (string)." }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const response = await result.response;
      const text = response.text();
      const rawData = JSON.parse(text);
      
      return rawData.map((item: any, index: number) => ({
        id: `auto-${index}-${Date.now()}`,
        startTime: item.start,
        endTime: item.end,
        text: item.text
      }));

    } catch (e: any) {
      lastError = e;
      console.warn(`Falha no modelo ${modelName}:`, e.message);
      // Se for erro de cota, tenta o próximo
      if (e.message?.includes('429') || e.message?.toLowerCase().includes('quota')) continue;
      break; 
    }
  }

  throw new Error(`Erro ao gerar legendas: ${lastError?.message || "Cota excedida"}`);
};
