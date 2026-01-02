import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Download, Wand2, Type, ZoomIn, Settings, AlertCircle, Copy, ExternalLink, X } from 'lucide-react';
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
  const [exportProgress, setExportProgress] = useState<ExportProgress>({ status: 'idle', progress: 0 });
  
  // Estados para o novo sistema de importação manual (Estilo MarketPulse)
  const [isModalOpen, setIsModalOpen] = useState(false);
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
          file, url, duration: video.duration,
          width: video.videoWidth, height: video.videoHeight
        });
      };
    }
  };

  const copiarPromptParaIA = () => {
    const prompt = `AJA COMO UM TRANSCRITOR DE VÍDEO PROFISSIONAL. Assista ao vídeo/áudio anexo e extraia as legendas com tempo de início e fim. Retorne APENAS o JSON puro, sem markdown, seguindo este formato: [{"startTime": 0.5, "endTime": 3.0, "text": "Frase 1"}]`;
    const textArea = document.createElement("textarea");
    textArea.value = prompt;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert("Prompt de comando copiado!");
  };

  const handleImportJson = () => {
    try {
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      setSubtitles(JSON.parse(cleanJson));
      setIsModalOpen(false);
      setJsonInput('');
    } catch (e) {
      alert("Erro no JSON. Verifique se copiou o código completo da IA.");
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
        <header className="flex justify-between items-center bg-brand-900/50 p-6 rounded-2xl border border-brand-800">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 p-2.5 rounded-xl"><Type size={24} /></div>
            <h1 className="text-2xl font-black italic uppercase">LegendaAI <span className="text-brand-500">PRO</span></h1>
          </div>
        </header>

        {!videoState.url ? (
          <div className="h-[60vh] flex items-center justify-center border-2 border-dashed border-brand-800 rounded-3xl bg-brand-900/20">
            <label className="flex flex-col items-center gap-4 cursor-pointer p-20 w-full text-center">
              <Upload size={48} className="text-brand-400" />
              <p className="text-xl font-bold text-white">Selecione seu vídeo para começar</p>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-brand-800">
                <video ref={videoRef} src={videoState.url} className="w-full h-full" onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} controls />
                <div className="absolute left-0 right-0 text-center pointer-events-none" style={{ bottom: `${style.bottomOffset}%`, opacity: style.opacity }}>
                  <span style={{
                    fontSize: `${style.fontSize}px`, fontFamily: style.fontFamily, color: style.color,
                    backgroundColor: style.backgroundColor, WebkitTextStroke: `${style.borderWidth}px ${style.borderColor}`,
                    padding: '4px 12px', borderRadius: '4px'
                  }}>
                    {subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.text}
                  </span>
                </div>
              </div>
              <Timeline subtitles={subtitles} currentTime={currentTime} duration={videoState.duration} onSubtitleChange={setSubtitles} zoom={zoom} />
            </div>

            <div className="lg:col-span-4 space-y-4">
              <button onClick={() => setIsModalOpen(true)} className="w-full py-6 bg-brand-500 hover:bg-brand-400 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all">
                <Wand2 size={24} /> Gerar com IA (Gemini)
              </button>
              
              <button onClick={handleExport} disabled={exportProgress.status === 'exporting'} className="w-full py-4 bg-white text-brand-950 rounded-2xl font-bold flex items-center justify-center gap-2">
                <Download size={20} /> Exportar Vídeo MP4
              </button>

              <div className="bg-brand-900/50 p-6 rounded-3xl border border-brand-800 space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Settings size={18}/> Estilo das Legendas</h3>
                {/* Aqui você pode manter todos os controles de estilo do seu arquivo original */}
                <div className="space-y-4 text-sm">
                   <label className="block">Tamanho da Fonte
                     <input type="range" min="12" max="72" value={style.fontSize} onChange={(e) => setStyle({...style, fontSize: parseInt(e.target.value)})} className="w-full mt-2" />
                   </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importação JSON - Estilo MarketPulse */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-6">
            <div className="bg-brand-900 border border-brand-700 p-8 rounded-3xl w-full max-w-2xl space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Importar Legendas da IA</h2>
                <button onClick={() => setIsModalOpen(false)}><X/></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={copiarPromptParaIA} className="bg-brand-800 p-4 rounded-xl flex items-center gap-2 hover:bg-brand-700"><Copy size={18}/> 1. Copiar Prompt</button>
                <a href="https://gemini.google.com/app" target="_blank" className="bg-blue-600/20 p-4 rounded-xl flex items-center gap-2 border border-blue-600/50"><ExternalLink size={18}/> 2. Abrir Gemini</a>
              </div>
              <textarea className="w-full h-48 bg-brand-950 border border-brand-700 rounded-2xl p-4 font-mono text-green-400 text-sm" placeholder="Cole o JSON gerado aqui..." value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} />
              <button onClick={handleImportJson} className="w-full py-4 bg-brand-500 rounded-2xl font-bold">3. Aplicar Legendas ao Vídeo</button>
            </div>
          </div>
        )}
        
        {/* Barra de Progresso de Exportação (Original) */}
        {exportProgress.status !== 'idle' && (
           <div className="fixed bottom-8 right-8 bg-brand-900 p-6 rounded-2xl border border-brand-700 shadow-2xl w-80">
              <p className="text-sm font-bold mb-2">{exportProgress.message}</p>
              <div className="w-full bg-brand-950 h-2 rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full transition-all" style={{width: `${exportProgress.progress}%`}} />
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
