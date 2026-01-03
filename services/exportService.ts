import { Subtitle, SubtitleStyle, ExportResolution } from "../types";
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// WebCodecs Type Declarations
declare class AudioEncoder {
  constructor(init: { output: (chunk: any, meta?: any) => void, error: (e: any) => void });
  configure(config: { codec: string, numberOfChannels: number, sampleRate: number, bitrate?: number }): void;
  encode(data: AudioData): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: string;
}

declare class AudioData {
  constructor(init: {
    format: string,
    sampleRate: number,
    numberOfFrames: number,
    numberOfChannels: number,
    timestamp: number,
    data: BufferSource | Float32Array
  });
  close(): void;
  clone(): AudioData;
  readonly duration: number;
}

// Força dimensões pares e seguras para o Codec

// Copie e cole esta função no lugar da atual no seu exportService.ts
const getTargetDimensions = (originalWidth: number, originalHeight: number, resolution: ExportResolution) => {
  const safeOrigW = originalWidth || 640;
  const safeOrigH = originalHeight || 360;

  let targetH = safeOrigH;

  if (resolution !== 'original') {
    // Extrai o número da resolução (ex: "480p" vira 480)
    const resValue = parseInt(String(resolution).match(/\d+/)?.[0] || "480");
    targetH = resValue;
  }

  const ratio = safeOrigW / safeOrigH;
  const targetW = targetH * ratio;

  // A MÁGICA: Math.floor(n / 2) * 2 garante que o número seja PAR e não estoure o limite
  const finalW = Math.max(2, Math.floor(targetW / 2) * 2);
  const finalH = Math.max(2, Math.floor(targetH / 2) * 2);

  return { width: finalW, height: finalH };
};

const getBitrate = (width: number, height: number) => {
  const pixels = width * height;
  if (pixels <= 426 * 240) return 500_000;
  if (pixels <= 854 * 480) return 1_500_000;
  if (pixels <= 1280 * 720) return 3_000_000;
  if (pixels <= 1920 * 1080) return 6_000_000;
  return 10_000_000;
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  subtitles: Subtitle[],
  timestamp: number,
  style: SubtitleStyle,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(zoom, zoom);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  const activeSub = subtitles.find(s => timestamp >= s.startTime && timestamp <= s.endTime);
  if (activeSub) {
    ctx.save();
    ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const x = canvasWidth / 2;
    const y = canvasHeight - (canvasHeight * (style.bottomOffset / 100));
    const maxWidth = canvasWidth * 0.9;
    const words = activeSub.text.split(' ');
    let line = '';
    const lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    const lineHeight = style.fontSize * 1.2;
    const startY = y - ((lines.length - 1) * lineHeight);
    lines.forEach((l, i) => {
      const lineY = startY + (i * lineHeight);
      if (style.borderWidth > 0) {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = style.borderWidth;
        ctx.strokeText(l, x, lineY);
      }
      ctx.fillStyle = style.color;
      ctx.fillText(l, x, lineY);
    });
    ctx.restore();
  }
};

export const exportVideo = async (
  file: File,
  subtitles: Subtitle[],
  style: SubtitleStyle,
  zoom: number,
  resolution: ExportResolution,
  onProgress: (msg: string, progress: number) => void
): Promise<Blob> => {
  const video = document.createElement('video');
  video.muted = true;
  video.src = URL.createObjectURL(file);
  await new Promise((resolve) => { video.onloadedmetadata = resolve; });

  const originalWidth = video.videoWidth;
  const originalHeight = video.videoHeight;
  const duration = video.duration;
  const { width, height } = getTargetDimensions(originalWidth, originalHeight, resolution);
  const scaleFactor = height / originalHeight;
  const scaledStyle = {
    ...style,
    fontSize: Math.max(10, style.fontSize * scaleFactor),
    borderWidth: Math.max(0, style.borderWidth * scaleFactor)
  };

  const fps = 30; 
  const totalFrames = Math.floor(duration * fps);
  
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: { codec: 'aac', numberOfChannels: 1, sampleRate: 44100 },
    fastStart: 'in-memory',
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("VideoEncoder error", e)
  });
  
  videoEncoder.configure({
    codec: 'avc1.42001f',
    width, height,
    bitrate: getBitrate(width, height),
    framerate: fps
  });

  // O código que estava faltando começa aqui:
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const fileBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(fileBuffer);
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error("Canvas context failed");

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i / fps;
    video.currentTime = timestamp;
    await new Promise(r => video.onseeked = r);
    drawFrame(ctx, video, subtitles, timestamp, scaledStyle, zoom, width, height);
    
    const frame = new VideoFrame(canvas, { timestamp: timestamp * 1e6 });
    videoEncoder.encode(frame);
    frame.close();
    
    onProgress("Exportando vídeo...", Math.round((i / totalFrames) * 100));
  }

  await videoEncoder.flush();
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
};