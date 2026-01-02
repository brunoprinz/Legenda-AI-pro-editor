export interface Subtitle {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitleStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string; // rgba
  borderWidth: number;
  borderColor: string;
  bottomOffset: number; // % from bottom
  opacity: number;
}

export interface VideoState {
  file: File | null;
  url: string | null;
  duration: number;
  width: number;
  height: number;
}

export interface ExportProgress {
  status: 'idle' | 'extracting_audio' | 'transcribing' | 'rendering' | 'muxing' | 'done' | 'error';
  progress: number; // 0-100
  message?: string;
}

export type ExportResolution = 'original' | '720p' | '480p' | '240p';
