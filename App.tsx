import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Download, Wand2, Type, ZoomIn, Settings, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import Timeline from './components/Timeline';
import { Subtitle, SubtitleStyle, VideoState, ExportProgress, ExportResolution } from './types';
import { exportVideo } from './services/exportService';

const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 24,
  fontFamily: 'Arial',
  color: '#FFFFFF',
  backgroundColor: 'rgba(0,0,0,0)',
  borderWidth: 2,
  borderColor: '#000000',
  bottomOffset: 10,
  opacity: 1
};

export default function App() {
  const [videoState, setVideoState] = useState<VideoState>({
    file: null, url: null, duration: 0, width: 0, height: 0
  });
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [zoom, setZoom] = useState(1);
  const [resolution, setResolution] = useState<ExportResolution>('original');
  const [isLoading, setIsLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({ status: 'idle', progress: 0 });
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => {
        setVideoState({
          file,
          url,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      };
    }
  };

  const copiarPromptParaIA = () => {
    const prompt = `AJA COMO UM TRANSCRITOR DE VÍDEO PROFISSIONAL. 
Assista ao vídeo/áudio anexo e extraia as legendas com tempo de início e fim.
Retorne APENAS o JSON puro, sem markdown, seguindo este formato:
[
  {"startTime": 0.5, "endTime": 3.0, "text": "Sua primeira frase"},
  {"startTime": 3.2, "endTime": 5.0, "text": "Sua segunda frase"}
]`;
    const textArea = document.createElement("textarea");
    textArea.value = prompt;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert("Prompt copiado! Agora anexe o vídeo no Gemini e use o comando.");
  };

  const handleImportJson = () => {
    try {
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setSubtitles(parsed);
      setShowJsonInput(false);
    } catch (e) {
      alert("Erro no formato do JSON. Verifique se copiou o código completo.");
    }
  };

  const handleExport = async () => {
    if (!videoState.file) return;
    setExportProgress({ status: 'exporting', progress: 0, message: 'Iniciando exportação...' });
    try {
      await exportVideo(videoState.file, subtitles, style, resolution, (progress) => {
        setExportProgress(progress);
      });
    } catch (error) {
      setExportProgress({ status: 'error', progress: 0, message: 'Falha na exportação' });
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-brand-900/50 p-6 rounded-2xl border border-brand-800 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 p-2.5 rounded-xl shadow-lg shadow-brand-500/20">
              <Type className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white italic uppercase">LegendaAI <span className="text-brand-500">PRO</span></h1>
          </div>
        </header>

        {!videoState.url ? (
          <div className="h-[60vh] flex items-center justify-center border-2 border-dashed border-brand-800 rounded-3xl bg-brand-900/20 hover:bg-brand-900/40 transition-all group">
            <label className="flex flex-col items-center gap-4 cursor-pointer p-20 w-full">
              <div className="bg-brand-800 p-6 rounded-2xl group-hover:scale-110 transition-transform shadow-xl">
                <Upload size={48} className="text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white mb-2">Selecione seu vídeo</p>
                <p className="text-brand-400">MP4, WebM ou MOV suportados</p>
              </div>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-brand-800 group">
                <video
                  ref={videoRef}
                  src={videoState.url}
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                />
                <div 
                  className="absolute left-0 right-0 text-center pointer-events-none transition-all duration-200"
                  style={{ bottom: `${style.bottomOffset}%`, opacity: style.opacity }}
                >
                  <span style={{
                    fontSize: `${style.fontSize}px`,
                    fontFamily: style.fontFamily,
                    color: style.color,
                    backgroundColor: style.backgroundColor,
                    WebkitTextStroke: `${style.borderWidth}px ${style.borderColor}`,
                    padding: '4px 12px',
                    borderRadius: '4px'
                  }}>
                    {subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.text}
                  </span>
                </div>
              </div>

              <div className="bg-brand-900/50 p-6 rounded-3xl border border-brand-800">
                <Timeline
                  subtitles={subtitles}
                  currentTime={currentTime}
                  duration={videoState.duration}
                  onSubtitleChange={setSubtitles}
                  zoom={zoom}
                />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-brand-900/50 p-6 rounded-3xl border border-brand-800 space-y-6 backdrop-blur-sm">
                <div className="flex flex-col gap-3">
                   {!showJsonInput ? (
                    <button 
                      onClick={() => setShowJsonInput(true)}
                      className="w-full py-4 bg-brand-500 hover:bg-brand-400 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-500/20"
                    >
                      <Wand2 size={20} /> Gerar com Gemini
                    </button>
                   ) : (
                    <div className="space-y-4 p-4 bg-brand-950 rounded-2xl border border-brand-700">
                      <div className="flex gap-2">
                        <button onClick={copiarPromptParaIA} className="flex-1 text-xs bg-brand-800 p-2 rounded-lg flex items-center justify-center gap-1 hover:bg-brand-700"><Copy size={14}/> Prompt</button>
                        <a href="https://gemini.google.com/app" target="_blank" className="flex-1 text-xs bg-brand-800 p-2 rounded-lg flex items-center justify-center gap-1 hover:bg-brand-700"><ExternalLink size={14}/> Gemini</a>
                      </div>
                      <textarea 
                        className="w-full h-32 bg-brand-900 border border-brand-700 rounded-xl p-3 text-xs text-green-400 font-mono"
                        placeholder="Cole o JSON aqui..."
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                      />
                      <button onClick={handleImportJson} className="w-full py-2 bg-green-600 rounded-xl text-sm font-bold">Importar</button>
                    </div>
                   )}

                  <button 
                    onClick={handleExport}
                    disabled={exportProgress.status === 'exporting'}
                    className="w-full py-4 bg-white hover:bg-gray-100 text-brand-950 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Download size={20} /> Exportar MP4
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {exportProgress.status !== 'idle' && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
            <div className="bg-brand-900 border border-brand-700 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-6 text-white">Processando Vídeo</h3>
              <div className="space-y-4">
                <div className="h-3 w-full bg-brand-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-500 transition-all duration-300" 
                    style={{ width: `${exportProgress.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm font-mono text-brand-400">
                  <span>{exportProgress.message}</span>
                  <span>{Math.round(exportProgress.progress)}%</span>
                </div>
                {exportProgress.status === 'done' && (
                  <button onClick={() => setExportProgress({status: 'idle', progress: 0})} className="w-full py-3 bg-green-600 rounded-xl font-bold mt-4">Fechar</button>
                )}
                {exportProgress.status === 'error' && (
                  <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm">
                    {exportProgress.message}
                    <button onClick={() => setExportProgress({status: 'idle', progress: 0})} className="block mt-2 font-bold underline">Tentar novamente</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
