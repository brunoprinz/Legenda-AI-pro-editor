import { Subtitle, SubtitleStyle, ExportResolution } from "../types";
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// Tipagens simplificadas para estabilidade
declare const VideoEncoder: any;
declare const VideoFrame: any;

const getTargetDimensions = (originalWidth: number, originalHeight: number, resolution: ExportResolution) => {
  if (resolution === 'original') return { width: originalWidth - (originalWidth % 2), height: originalHeight - (originalHeight % 2) };
  const targetH = parseInt(resolution.replace('p', ''));
  const ratio = originalWidth / originalHeight;
  let targetW = Math.round(targetH * ratio);
  return { width: targetW - (targetW % 2), height: targetH - (targetH % 2) };
};

const drawFrame = (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, subtitles: Subtitle[], timestamp: number, style: SubtitleStyle, canvasWidth: number, canvasHeight: number, scaleFactor: number) => {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

  const activeSub = subtitles.find(s => timestamp >= s.startTime && timestamp <= s.endTime);
  if (activeSub) {
    const adjustedFontSize = style.fontSize * scaleFactor;
    ctx.font = `bold ${adjustedFontSize}px ${style.fontFamily || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = style.color;
    
    // Desenha com sombra para garantir leitura (estilo robusto)
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.lineWidth = (style.outlineWidth || 2) * scaleFactor;
    ctx.strokeStyle = style.outlineColor || "black";
    ctx.strokeText(activeSub.text, canvasWidth / 2, canvasHeight * 0.9);
    ctx.fillText(activeSub.text, canvasWidth / 2, canvasHeight * 0.9);
    ctx.shadowBlur = 0;
  }
};

export const exportVideo = async (
  file: File,
  subtitles: Subtitle[],
  style: SubtitleStyle,
  zoom: number,
  resolution: ExportResolution,
  onProgress: (msg: string, progress: number) => void
): Promise<void> => {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  await new Promise((r) => video.onloadedmetadata = r);

  const { width, height } = getTargetDimensions(video.videoWidth, video.videoHeight, resolution);
  const scaleFactor = height / video.videoHeight;
  const fps = 30;
  const duration = video.duration;
  const totalFrames = Math.floor(duration * fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;

  // Muxer configurado igual ao seu editor que funciona
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory'
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error("Encoder Error:", e)
  });

  videoEncoder.configure({
    codec: 'avc1.42E01E', // Codec mais compatível (Baseline profile)
    width, height,
    bitrate: 1_000_000,
    framerate: fps
  });

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i / fps;
    video.currentTime = timestamp;
    await new Promise(r => video.onseeked = r);
    
    drawFrame(ctx, video, subtitles, timestamp, style, width, height, scaleFactor);
    
    const frame = new VideoFrame(canvas, { timestamp: Math.round(timestamp * 1e6) });
    videoEncoder.encode(frame);
    frame.close();

    if (i % 10 === 0) onProgress('Processando frames...', (i / totalFrames) * 90);
  }

  onProgress('Finalizando arquivo...', 95);
  
  await videoEncoder.flush();
  videoEncoder.close();
  
  // Aqui está o segredo: Finalização direta sem travar o buffer
  const result = muxer.finalize();
  const blob = new Blob([result], { type: 'video/mp4' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `video-legendado.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  onProgress('Concluído!', 100);
};
