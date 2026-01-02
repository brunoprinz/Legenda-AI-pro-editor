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

// Calculate target dimensions ensuring even numbers (good for encoders)
const getTargetDimensions = (originalWidth: number, originalHeight: number, resolution: ExportResolution) => {
  if (resolution === 'original') {
    // Ensure even dimensions even for original to avoid encoding issues
    return { 
      width: originalWidth % 2 === 0 ? originalWidth : originalWidth - 1, 
      height: originalHeight % 2 === 0 ? originalHeight : originalHeight - 1 
    };
  }
  
  const targetH = parseInt(resolution.replace('p', ''));
  // Maintain aspect ratio
  const ratio = originalWidth / originalHeight;
  const targetW = Math.round(targetH * ratio);
  
  return {
    width: targetW % 2 === 0 ? targetW : targetW + 1,
    height: targetH % 2 === 0 ? targetH : targetH + 1
  };
};

// Estimate bitrate based on pixel count
const getBitrate = (width: number, height: number) => {
  const pixels = width * height;
  if (pixels <= 426 * 240) return 500_000; // 240p ~0.5 Mbps
  if (pixels <= 854 * 480) return 1_500_000; // 480p ~1.5 Mbps
  if (pixels <= 1280 * 720) return 3_000_000; // 720p ~3 Mbps
  if (pixels <= 1920 * 1080) return 6_000_000; // 1080p ~6 Mbps
  return 10_000_000; // 4K or higher
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  subtitles: Subtitle[],
  timestamp: number, // seconds
  style: SubtitleStyle,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  // Clear
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw Background (Black)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Apply Zoom
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(zoom, zoom);
  ctx.translate(-centerX, -centerY);
  
  // Draw Video Frame - Scaled to canvas size
  ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
  
  ctx.restore();

  // Find active subtitle
  const activeSub = subtitles.find(s => timestamp >= s.startTime && timestamp <= s.endTime);

  if (activeSub) {
    ctx.save();
    
    // Font setup
    ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const x = canvasWidth / 2;
    const y = canvasHeight - (canvasHeight * (style.bottomOffset / 100));

    // Split text into lines if too wide
    const maxWidth = canvasWidth * 0.9;
    const words = activeSub.text.split(' ');
    let line = '';
    const lines = [];
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Draw lines
    const lineHeight = style.fontSize * 1.2;
    // Adjust starting Y so the block grows upwards
    const startY = y - ((lines.length - 1) * lineHeight);

    lines.forEach((l, i) => {
      const lineY = startY + (i * lineHeight);
      
      // Stroke
      if (style.borderWidth > 0) {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = style.borderWidth;
        ctx.strokeText(l, x, lineY);
      }

      // Fill
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
  // 1. Setup Video Element for decoding
  const video = document.createElement('video');
  video.muted = true;
  video.src = URL.createObjectURL(file);
  await new Promise((resolve) => { video.onloadedmetadata = resolve; });

  const originalWidth = video.videoWidth;
  const originalHeight = video.videoHeight;
  const duration = video.duration;

  // Calculate target dimensions based on resolution selection
  const { width, height } = getTargetDimensions(originalWidth, originalHeight, resolution);
  
  // Calculate scaling factor for styles (font size, borders)
  // We assume the style defined in UI corresponds to the "look" at the original resolution (or relative to video frame)
  // Since our drawFrame uses pixels, we must scale the font size if the canvas is smaller.
  const scaleFactor = height / originalHeight;
  
  const scaledStyle: SubtitleStyle = {
    ...style,
    fontSize: Math.max(10, style.fontSize * scaleFactor), // Ensure min readable size
    borderWidth: Math.max(0, style.borderWidth * scaleFactor)
  };

  // Standard FPS
  const fps = 30; 
  const totalFrames = Math.floor(duration * fps);
  
  // 2. Setup Muxer
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height
    },
    audio: {
      codec: 'aac',
      numberOfChannels: 1,
      sampleRate: 44100
    },
    fastStart: 'in-memory',
  });

  // 3. Setup VideoEncoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("VideoEncoder error", e)
  });
  
  videoEncoder.configure({
    codec: 'avc1.42001f', // H.264 Baseline
    width,
    height,
    bitrate: getBitrate(width, height), // Dynamic bitrate optimization
    framerate: fps
  });

  // 4. Setup AudioEncoder
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const fileBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(fileBuffer);

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => console.error("AudioEncoder error", e)
  });

  audioEncoder.configure({
    codec: 'mp4a.40.2',
    numberOfChannels: 1,
    sampleRate: 44100,
    bitrate: 128000
  });

  // 5. Render Loop
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); // optimize for frequent updates
  
  if (!ctx) throw new Error("Canvas context failed");

  // A. Process Video
  const frameDuration = 1 / fps;
  
  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i * frameDuration;
    
    // Update progress less frequently to save UI render cycles if needed, but 30fps is fine
    if (i % 15 === 0) {
        onProgress("Renderizando vídeo...", Math.round((i / totalFrames) * 70));
    }

    // Seek video
    video.currentTime = timestamp;
    await new Promise(r => { video.onseeked = r; });
    
    // Draw with scaled style
    drawFrame(ctx, video, subtitles, timestamp, scaledStyle, zoom, width, height);

    const bitmap = await createImageBitmap(canvas);
    
    const frame = new VideoFrame(bitmap, {
      timestamp: i * 1000000 / fps, // microseconds
      duration: 1000000 / fps 
    });

    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
  }
  
  await videoEncoder.flush();

  // B. Process Audio
  onProgress("Processando áudio...", 80);

  const channelData = audioBuffer.getChannelData(0); // Mono
  const totalSamples = channelData.length;
  const bufferSize = 44100; // 1 second chunks

  for (let i = 0; i < totalSamples; i += bufferSize) {
    const end = Math.min(i + bufferSize, totalSamples);
    const chunkData = channelData.slice(i, end);
    
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 44100,
      numberOfFrames: chunkData.length,
      numberOfChannels: 1,
      timestamp: (i / 44100) * 1000000,
      data: chunkData
    });
    
    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();

  // 6. Finalize
  onProgress("Finalizando...", 99);
  muxer.finalize();
  
  const buffer = muxer.target.buffer;
  
  // Cleanup
  URL.revokeObjectURL(video.src);
  video.remove();
  canvas.remove();

  return new Blob([buffer], { type: 'video/mp4' });
};
