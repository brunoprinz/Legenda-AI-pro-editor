import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Download, Wand2, Type, ZoomIn, Settings, AlertCircle, Monitor } from 'lucide-react';
import Timeline from './components/Timeline';
import { Subtitle, SubtitleStyle, VideoState, ExportProgress, ExportResolution } from './types';
import { generateSubtitles } from './services/geminiService';
import { exportVideo } from './services/exportService';

// Default Styles
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
  // State
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
  const [sidebarTab, setSidebarTab] = useState<'style' | 'ai'>('style');
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Video Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoState({
      file, url, duration: 0, width: 0, height: 0
    });
    setSubtitles([]);
    setExportProgress({ status: 'idle', progress: 0 });
    // Reset video ref time
    if(videoRef.current) {
        videoRef.current.currentTime = 0;
    }
  };

  const handleMetadataLoaded = () => {
    if (videoRef.current) {
      setVideoState(prev => ({
        ...prev,
        duration: videoRef.current!.duration,
        width: videoRef.current!.videoWidth,
        height: videoRef.current!.videoHeight
      }));
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // AI Generation
  const handleGenerateSubtitles = async () => {
    if (!videoState.file) return;
    
    setIsLoading(true);
    try {
      const subs = await generateSubtitles(videoState.file);
      setSubtitles(subs);
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar legendas. Verifique o console para mais detalhes.");
    } finally {
      setIsLoading(false);
    }
  };

  // Export
  const handleExport = async () => {
    if (!videoState.file) return;
    
    setExportProgress({ status: 'extracting_audio', progress: 0 });
    
    try {
      const blob = await exportVideo(
        videoState.file,
        subtitles,
        style,
        zoom,
        resolution,
        (msg, prog) => setExportProgress({ status: 'rendering', message: msg, progress: prog })
      );

      setExportProgress({ status: 'done', progress: 100, message: "Download pronto!" });
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${resolution}_${videoState.file.name.replace(/\.[^/.]+$/, "")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => setExportProgress({ status: 'idle', progress: 0 }), 3000);

    } catch (e: any) {
      console.error("Export failed", e);
      setExportProgress({ status: 'error', progress: 0, message: "Erro: " + e.message });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
      {/* Header */}
      <header className="h-14 bg-brand-900 border-b border-brand-800 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center font-bold text-white">L</div>
            <h1 className="font-bold text-lg tracking-tight">LegendaAI <span className="text-brand-500 text-xs uppercase">Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-sm flex items-center gap-2 transition border border-gray-700">
            <Upload size={16} />
            <span className="hidden sm:inline">Carregar Vídeo</span>
            <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
          </label>
          
          <div className="flex items-center gap-2 bg-gray-800 p-1 rounded border border-gray-700">
             <Monitor size={14} className="text-gray-400 ml-1" />
             <select 
               value={resolution}
               onChange={(e) => setResolution(e.target.value as ExportResolution)}
               className="bg-transparent text-sm border-none outline-none text-gray-200 cursor-pointer"
               disabled={!videoState.file}
             >
               <option value="original">Original</option>
               <option value="720p">720p (HD)</option>
               <option value="480p">480p (SD)</option>
               <option value="240p">240p (Low)</option>
             </select>
          </div>

          <button 
            disabled={!videoState.file || exportProgress.status !== 'idle'}
            onClick={handleExport}
            className={`px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition ${
              !videoState.file ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 
              'bg-brand-500 hover:bg-red-600 text-white shadow-lg shadow-brand-500/20'
            }`}
          >
            <Download size={16} />
            <span className="hidden sm:inline">Exportar MP4</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Video Preview */}
        <div className="flex-1 flex flex-col bg-black relative">
          
          {/* Viewport */}
          <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden relative p-4">
             {!videoState.url ? (
               <div className="text-center text-gray-600">
                 <Upload className="mx-auto mb-2 opacity-50" size={48} />
                 <p>Carregue um vídeo para começar</p>
                 <p className="text-xs mt-2 max-w-xs mx-auto text-gray-700">
                    Otimizado para exportação precisa sem perda de sincronia.
                    Compatível com vídeos longos.
                 </p>
               </div>
             ) : (
               <div className="relative overflow-hidden shadow-2xl border border-gray-800 max-h-full max-w-full aspect-video bg-gray-900">
                  {/* The Video Element */}
                  <video
                    ref={videoRef}
                    src={videoState.url}
                    className="w-full h-full object-contain"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleMetadataLoaded}
                    onEnded={() => setIsPlaying(false)}
                  />

                  {/* Subtitle Overlay (DOM based for preview) */}
                  {subtitles.map(sub => {
                    if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
                      return (
                         <div 
                           key={sub.id}
                           className="absolute left-0 right-0 text-center pointer-events-none w-full"
                           style={{ 
                             bottom: `${style.bottomOffset}%`,
                             padding: '0 20px' 
                           }}
                         >
                            <span 
                              style={{
                                display: 'inline-block',
                                fontSize: `${style.fontSize}px`,
                                fontFamily: style.fontFamily,
                                color: style.color,
                                backgroundColor: style.backgroundColor,
                                WebkitTextStroke: style.borderWidth > 0 ? `${style.borderWidth}px ${style.borderColor}` : 'none',
                                textShadow: style.borderWidth > 0 
                                  ? `2px 2px 0 ${style.borderColor}, -1px -1px 0 ${style.borderColor}, 1px -1px 0 ${style.borderColor}, -1px 1px 0 ${style.borderColor}, 1px 1px 0 ${style.borderColor}`
                                  : '2px 2px 4px rgba(0,0,0,0.5)', // fallback shadow if no border
                                lineHeight: 1.2,
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {sub.text}
                            </span>
                         </div>
                      );
                    }
                    return null;
                  })}
               </div>
             )}
          </div>

          {/* Controls Bar */}
          <div className="h-16 bg-brand-900 border-t border-brand-800 flex items-center px-4 gap-4 shrink-0">
             <button onClick={togglePlay} className="p-3 bg-white text-brand-900 rounded-full hover:bg-gray-200 transition">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
             </button>
             
             <div className="flex-1 flex flex-col justify-center gap-1">
                <input 
                  type="range" 
                  min={0} 
                  max={videoState.duration || 100} 
                  value={currentTime} 
                  step={0.1}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
                <div className="flex justify-between text-xs text-gray-500 font-mono">
                  <span>{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                  <span>{new Date((videoState.duration || 0) * 1000).toISOString().substr(14, 5)}</span>
                </div>
             </div>

             {/* Zoom Control */}
             <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                <ZoomIn size={16} className="text-gray-400" />
                <input 
                  type="range" 
                  min={1} 
                  max={3} 
                  step={0.1} 
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
             </div>
          </div>
        </div>

        {/* Right: Sidebar + Timeline */}
        <div className="w-80 flex flex-col bg-brand-900 border-l border-brand-800 shrink-0 z-20 shadow-xl">
           
           {/* Tab Nav */}
           <div className="flex border-b border-brand-800">
             <button 
               onClick={() => setSidebarTab('style')}
               className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${sidebarTab === 'style' ? 'text-brand-500 border-b-2 border-brand-500 bg-brand-800' : 'text-gray-400 hover:bg-brand-800'}`}
             >
               <Type size={16} /> Estilo
             </button>
             <button 
               onClick={() => setSidebarTab('ai')}
               className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${sidebarTab === 'ai' ? 'text-brand-500 border-b-2 border-brand-500 bg-brand-800' : 'text-gray-400 hover:bg-brand-800'}`}
             >
               <Wand2 size={16} /> IA
             </button>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-y-auto">
             {sidebarTab === 'style' ? (
               <div className="p-4 space-y-4">
                 <div className="space-y-2">
                   <label className="text-xs uppercase text-gray-500 font-semibold">Tamanho da Fonte</label>
                   <input type="range" min="12" max="72" value={style.fontSize} onChange={e => setStyle({...style, fontSize: Number(e.target.value)})} className="w-full accent-brand-500" />
                   <div className="text-right text-xs text-gray-400">{style.fontSize}px</div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs uppercase text-gray-500 font-semibold">Fonte</label>
                   <select 
                     value={style.fontFamily} 
                     onChange={e => setStyle({...style, fontFamily: e.target.value})}
                     className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm"
                   >
                     <option value="Arial">Arial</option>
                     <option value="Verdana">Verdana</option>
                     <option value="Times New Roman">Times New Roman</option>
                     <option value="Courier New">Courier New</option>
                     <option value="Impact">Impact</option>
                     <option value="Comic Sans MS">Comic Sans</option>
                   </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs uppercase text-gray-500 font-semibold">Cor Texto</label>
                       <div className="flex items-center gap-2 bg-gray-800 p-1 rounded border border-gray-700">
                         <input type="color" value={style.color} onChange={e => setStyle({...style, color: e.target.value})} className="bg-transparent border-none w-6 h-6 p-0 cursor-pointer" />
                         <span className="text-xs font-mono">{style.color}</span>
                       </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs uppercase text-gray-500 font-semibold">Cor Borda</label>
                       <div className="flex items-center gap-2 bg-gray-800 p-1 rounded border border-gray-700">
                         <input type="color" value={style.borderColor} onChange={e => setStyle({...style, borderColor: e.target.value})} className="bg-transparent border-none w-6 h-6 p-0 cursor-pointer" />
                         <span className="text-xs font-mono">{style.borderColor}</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs uppercase text-gray-500 font-semibold">Espessura Borda</label>
                   <input type="range" min="0" max="10" step="0.5" value={style.borderWidth} onChange={e => setStyle({...style, borderWidth: Number(e.target.value)})} className="w-full accent-brand-500" />
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs uppercase text-gray-500 font-semibold">Posição Vertical</label>
                   <input type="range" min="0" max="90" value={style.bottomOffset} onChange={e => setStyle({...style, bottomOffset: Number(e.target.value)})} className="w-full accent-brand-500" />
                 </div>
               </div>
             ) : (
               <div className="p-4 space-y-4">
                 <div className="bg-brand-800 p-4 rounded-lg border border-brand-700">
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                       <Wand2 size={16} className="text-brand-500"/> Legendas Automáticas
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                       Utiliza o modelo Gemini 2.5 Flash para transcrever áudio com alta precisão e velocidade.
                    </p>

                    <button 
                       onClick={handleGenerateSubtitles}
                       disabled={isLoading || !videoState.file}
                       className="w-full py-2 bg-brand-500 hover:bg-red-600 text-white rounded text-sm font-medium transition disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                       {isLoading ? (
                         <>
                           <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                           Processando...
                         </>
                       ) : 'Gerar Legendas'}
                    </button>
                 </div>
                 
                 <div className="bg-gray-800 p-3 rounded text-xs text-gray-400 border border-gray-700">
                   <AlertCircle size={14} className="inline mr-1 mb-0.5" />
                   Dica: O processamento de áudio é feito localmente para economizar banda antes de enviar para a IA.
                 </div>
               </div>
             )}
             
             {/* Timeline Component takes the rest of vertical space */}
             <div className="h-[400px]">
                <Timeline 
                  subtitles={subtitles} 
                  currentTime={currentTime} 
                  onUpdate={setSubtitles} 
                  onSeek={handleSeek}
                />
             </div>
           </div>
        </div>
      </div>

      {/* Export Overlay */}
      {exportProgress.status !== 'idle' && (
         <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-brand-900 border border-brand-700 p-6 rounded-xl w-96 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Exportando Vídeo</h3>
              
              {exportProgress.status === 'error' ? (
                 <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900">
                    {exportProgress.message}
                    <button onClick={() => setExportProgress({status: 'idle', progress: 0})} className="block mt-2 text-white bg-red-600 px-3 py-1 rounded">Fechar</button>
                 </div>
              ) : (
                <>
                  <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2 overflow-hidden">
                    <div className="bg-brand-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${exportProgress.progress}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 font-mono">
                     <span>{exportProgress.message || 'Processando...'}</span>
                     <span>{Math.round(exportProgress.progress)}%</span>
                  </div>
                  {exportProgress.status === 'done' && (
                     <p className="text-green-400 text-sm mt-4 text-center">Arquivo gerado com sucesso!</p>
                  )}
                </>
              )}
            </div>
         </div>
      )}
    </div>
  );
}