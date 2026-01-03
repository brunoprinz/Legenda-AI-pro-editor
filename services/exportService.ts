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
  if (pixels <= 426 * 240) return 400_000; // Otimizado para 240p
  if (pixels <= 854 * 480) return 1_000_000; // Otimizado para 480p
  if (pixels <= 1280 * 720) return 2_500_000;
  return 5_000_000;
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  subtitles: Subtitle[],
  timestamp: number,
  style: SubtitleStyle,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number // Adicionado para ajustar tamanho da fonte
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
    
    // Ajusta o tamanho da fonte e borda proporcionalmente à resolução de saída
    const adjustedFontSize = style.fontSize * scaleFactor;
    const adjustedOutline = (style.outlineWidth || 0) * scaleFactor;

    ctx.font = `bold ${adjustedFontSize}px ${style.fontFamily || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const x = canvasWidth / 2;
    const y = canvasHeight * 0.9; // 10% de margem inferior fixa na exportação
    
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

    const lineHeight = adjustedFontSize * 1.2;
    const startY = y - ((lines.length - 1) * lineHeight);

    lines.forEach((l, i) => {
      const lineY = startY + (i * lineHeight);
      
      // Desenha o fundo da legenda se houver
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        const metrics = ctx.measureText(l);
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(x - metrics.width/2 - 5, lineY - adjustedFontSize, metrics.width + 10, adjustedFontSize + 5);
      }

      // Stroke/Borda
      if (adjustedOutline > 0) {
        ctx.strokeStyle = style.outlineColor || '#000000';
        ctx.lineWidth = adjustedOutline;
        ctx.strokeText(l, x, lineY);
      }
      
      // Texto
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
  
  // Fator de escala: se o vídeo original é 1080p e exportamos 240p, as fontes precisam diminuir
  const scaleFactor = height / video.videoHeight;
  
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

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i / fps;
    video.currentTime = timestamp;
    await new Promise(r => { video.onseeked = r; });
    
    // Passamos o scaleFactor para o drawFrame
    drawFrame(ctx, video, subtitles, timestamp, style, zoom, width, height, scaleFactor);
    
    const frame = new VideoFrame(canvas, { timestamp: timestamp * 1e6 });
    videoEncoder.encode(frame);
    frame.close();

    if (i % 10 === 0) {
      onProgress('Renderizando...', (i / totalFrames) * 95);
    }
  }

  onProgress('Finalizando...', 98);
  await videoEncoder.flush();

  const result = muxer.finalize();
  const blob = new Blob([result], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `video-legendado-${resolution}.mp4`;
  a.click();
  
  onProgress('Concluído!', 100);
};