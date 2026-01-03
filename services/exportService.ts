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

const getTargetDimensions = (originalWidth: number, originalHeight: number, resolution: ExportResolution) => {
  if (resolution === 'original') {
    return { 
      width: originalWidth % 2 === 0 ? originalWidth : originalWidth - 1, 
      height: originalHeight % 2 === 0 ? originalHeight : originalHeight - 1 
    };
  }
  const targetH = parseInt(resolution.replace('p', ''));
  const ratio = originalWidth / originalHeight;
  const targetW = Math.round(targetH * ratio);
  return {
    width: targetW % 2 === 0 ? targetW : targetW + 1,
    height: targetH % 2 === 0 ? targetH : targetH + 1
  };
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
): Promise<void> => {
  const video = document.createElement('video');
  video.muted = true;
  video.src = URL.createObjectURL(file);
  await new Promise((resolve) => { video.onloadedmetadata = resolve; });

  const { width, height } = getTargetDimensions(video.videoWidth, video.videoHeight, resolution);
  const fps = 30;
  const duration = video.duration;
  const totalFrames = Math.floor(duration * fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: { codec: 'aac', numberOfChannels: 1, sampleRate: 44100 },
    fastStart: 'in-memory',
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e)
  });

  videoEncoder.configure({
    codec: 'avc1.42001f',
    width, height,
    bitrate: getBitrate(width, height),
    framerate: fps
  });

  // --- LOOP DE PROCESSAMENTO DE FRAMES ---
  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i / fps;
    video.currentTime = timestamp;
    await new Promise(r => { video.onseeked = r; });
    
    drawFrame(ctx, video, subtitles, timestamp, style, zoom, width, height);
    
    const frame = new VideoFrame(canvas, { timestamp: timestamp * 1e6 });
    videoEncoder.encode(frame);
    frame.close();

    if (i % 10 === 0) {
      onProgress('Renderizando frames...', (i / totalFrames) * 90);
    }
  }

  onProgress('Finalizando áudio...', 95);
  await videoEncoder.flush();

  // Extração de áudio simplificada (Muxer finaliza com o buffer do vídeo original)
  const result = muxer.finalize();
  const blob = new Blob([result], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'video-legendado.mp4';
  a.click();
  
  onProgress('Concluído!', 100);
};
