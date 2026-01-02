import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subtitle } from "../types";

// Função para converter o áudio do vídeo num formato que o Gemini aceita (Base64)
const processAudioForGemini = async (videoFile: File): Promise<string> => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await videoFile.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  // Criamos um WAV simples (mono, 16khz) para ser leve
  const wavBuffer = encodeWAV(audioBuffer);
  return bufferToBase64(wavBuffer);
};

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const encodeWAV = (audioBuffer: AudioBuffer): ArrayBuffer => {
  const numChannels = 1;
  const sampleRate = 16000;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const buffer = new ArrayBuffer(44 + audioBuffer.length * bytesPerSample);
  const view = new DataView(buffer);
  
  // Cabeçalho WAV
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioBuffer.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, audioBuffer.length * bytesPerSample, true);
  
  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return buffer;
};

export const generateSubtitles = async (videoFile: File): Promise<Subtitle[]> => {
  // Tenta ler do Netlify (VITE_) ou usa a string direta se você preferir colar
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
  
  if (!apiKey) {
    throw new Error("Chave de API não configurada. Verifique as Environment Variables no Netlify.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const base64Audio = await processAudioForGemini(videoFile);

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Transcreva este áudio para legendas em Português do Brasil. 
  Retorne APENAS um array JSON no formato: [{"startTime": 0.5, "endTime": 2.0, "text": "Exemplo"}].
  Não use blocos de código Markdown, apenas o texto JSON puro.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "audio/wav",
        data: base64Audio
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();
  
  try {
    return JSON.parse(text.replace(/```json|```/g, ""));
  } catch (e) {
    console.error("Erro ao processar JSON da IA:", text);
    throw new Error("A IA não retornou um formato de legenda válido.");
  }
};
