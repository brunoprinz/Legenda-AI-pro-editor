import { Subtitle, SubtitleStyle, ExportResolution } from "../types";
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

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

  // Lógica de dimensões pares (Vital para não dar erro de 9 bytes)
  const originalW = video.videoWidth;
  const originalH = video.videoHeight;
  let targetH = originalH;
  if (resolution === '480p' && originalH > 480) targetH = 480;
  if (resolution === '240p' && originalH > 240) targetH = 240;
  const scaleRatio = targetH / originalH;
  const targetW = Math.round(originalW * scaleRatio) - (Math.round(originalW * scaleRatio) % 2);
  const finalH = targetH - (targetH % 2);

  const fps = 30;
  const duration = video.duration;
  const totalFrames = Math.floor(duration * fps);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: targetW, height: finalH },
    fastStart: 'in-memory'
  });

  // @ts-ignore
  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error("Encoder Error:", e)
  });

  videoEncoder.configure({
    codec: 'avc1.42E01E', // Codec leve do seu outro editor
    width: targetW,
    height: finalH,
    bitrate: 1_000_000,
    framerate: fps
  });

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i / fps;
    video.currentTime = timestamp;
    await new Promise(r => video.onseeked = r);
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, targetW, finalH);
    ctx.drawImage(video, 0, 0, targetW, finalH);

    const activeSub = subtitles.find(s => timestamp >= s.startTime && timestamp <= s.endTime);
    if (activeSub) {
      const fontSize = style.fontSize * scaleRatio;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillStyle = style.color;
      ctx.shadowColor = "black";
      ctx.shadowBlur = 5;
      ctx.fillText(activeSub.text, targetW / 2, finalH * 0.9);
      ctx.shadowBlur = 0;
    }

    // @ts-ignore
    const frame = new VideoFrame(canvas, { timestamp: Math.round(timestamp * 1e6) });
    videoEncoder.encode(frame);
    frame.close();

    if (i % 10 === 0) onProgress('Renderizando...', (i / totalFrames) * 90);
  }

  onProgress('Finalizando...', 95);
  await videoEncoder.flush();
  videoEncoder.close();

  const result = muxer.finalize();
  if (result.byteLength < 100) throw new Error("Erro: Ficheiro vazio");

  const blob = new Blob([result], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `video-legendado.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  onProgress('Concluído!', 100);
};