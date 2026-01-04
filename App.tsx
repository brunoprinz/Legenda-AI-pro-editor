import React, { useState, useRef } from 'react';
import { Subtitle, SubtitleStyle } from './types';
import { exportVideo } from './services/exportService';
import Timeline from './components/Timeline';
import { Upload, Download, ClipboardPaste, Wand2, Play, Pause, Loader2, X } from 'lucide-react';

// --- COMPONENTE INTERNO: VideoPlayer ---
const VideoPlayer = React.forwardRef<HTMLVideoElement, {
  file: File;
  subtitles: Subtitle[];
  currentTime: number;
  style: SubtitleStyle;
  onTimeUpdate: (time: number) => void;
}>(({ file, subtitles, currentTime, style, onTimeUpdate }, ref) => {
  const videoUrl = React.useMemo(() => URL.createObjectURL(file), [file]);
  const activeSubtitle = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden group">
      <video
        ref={ref}
        src={videoUrl}
        className="max-w-full max-h-full"
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      />
      {activeSubtitle && (
        <div 
          className="absolute left-0 right-0 px-4 text-center pointer-events-none"
          style={{
            bottom: '10%',
            color: style.color,
            fontSize: `${style.fontSize}px`,
            fontFamily: style.fontFamily,
            textShadow: `0 0 ${style.outlineWidth}px ${style.outlineColor}`
          }}
        >
          <span style={{ backgroundColor: style.backgroundColor, padding: '2px 8px', borderRadius: '4px' }}>
            {activeSubtitle.text}
          </span>
        </div>
      )}
    </div>
  );
});

// --- COMPONENTE INTERNO: StyleControls ---
const StyleControls = ({ style, onUpdate }: { style: SubtitleStyle, onUpdate: (s: SubtitleStyle) => void }) => {
  const inputClass = "w-full bg-black border border-gray-600 rounded p-1 text-sm text-white focus:border-brand-500 outline-none";
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-brand-900/50 p-4 rounded-xl border border-brand-800">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Tamanho Fonte</label>
        <input type="number" value={style.fontSize} onChange={e => onUpdate({...style, fontSize: Number(e.target.value)})} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Cor Texto</label>
        <input type="color" value={style.color} onChange={e => onUpdate({...style, color: e.target.value})} className="w-full h-8 bg-black border border-gray-600 rounded cursor-pointer" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Fundo (rgba)</label>
        <input type="text" value={style.backgroundColor} onChange={e => onUpdate({...style, backgroundColor: e.target.value})} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Borda (px)</label>
        <input type="number" value={style.outlineWidth} onChange={e => onUpdate({...style, outlineWidth: Number(e.target.value)})} className={inputClass} />
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportStatus, setExportStatus] = useState<{msg: string, progress: number} | null>(null);
  const [res, setRes] = useState<'240p' | '480p' | 'original'>('480p');
  const [showImportArea, setShowImportArea] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [style, setStyle] = useState<SubtitleStyle>({
    fontSize: 24, color: '#ffffff', backgroundColor: 'rgba(0, 0, 0, 0.5)',
    fontFamily: 'Inter', position: 'bottom', outlineColor: '#000000', outlineWidth: 2
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleExport = async () => {
    if (!videoFile || exportStatus) return;
    setExportStatus({ msg: 'Iniciando...', progress: 0 });
    try {
      await exportVideo(videoFile, subtitles, style, 1, res, (msg, progress) => {
        setExportStatus({ msg, progress });
      });
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e) {
      console.error(e);
      alert("Erro na exportação.");
      setExportStatus(null);
    }
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setSubtitles(parsed);
      setShowImportArea(false);
      setRawJson('');
    } catch (e) {
      alert("JSON inválido.");
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-white flex flex-col">
      <header className="h-16 border-b border-brand-800 flex items-center justify-between px-6 bg-brand-900/80 backdrop-blur-md sticky top-0 z-[100]">
        <div className="flex items-center gap-2">
          <Wand2 className="text-brand-500" />
          <h1 className="font-bold tracking-tighter text-xl">SUBTITLE<span className="text-brand-500">AI</span></h1>
        </div>
        
        <div className="flex items-center gap-4 relative z-[110]">
          <select 
            value={res} 
            onChange={(e) => setRes(e.target.value as any)}
            className="bg-brand-800 border border-brand-700 text-xs p-2 rounded outline-none cursor-pointer"
          >
            <option value="240p">240p (Rápido)</option>
            <option value="480p">480p (Padrão)</option>
            <option value="original">Original</option>
          </select>

          <button 
            onClick={() => setShowImportArea(!showImportArea)} 
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-600 rounded-lg text-sm transition cursor-pointer"
          >
            <ClipboardPaste size={18} /> Importar IA
          </button>
          
          <button 
            onClick={handleExport}
            disabled={!!exportStatus || !videoFile}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition text-sm cursor-pointer ${exportStatus ? 'bg-brand-800 text-gray-500' : 'bg-brand-500 hover:bg-brand-400 text-white'}`}
          >
            {exportStatus ? (
              <><Loader2 className="animate-spin" size={18} /> {Math.round(exportStatus.progress)}%</>
            ) : (
              <><Download size={18} /> Exportar</>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {showImportArea && (
            <div className="mb-6 p-4 bg-brand-900 border border-brand-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold">Colar JSON da Legenda</h3>
                <button onClick={() => setShowImportArea(false)}><X size={18}/></button>
              </div>
              <textarea 
                className="w-full h-32 bg-black border border-brand-700 rounded p-2 text-xs font-mono"
                placeholder='[{"text": "Exemplo", "startTime": 0, "endTime": 2}]'
                value={rawJson}
                onChange={e => setRawJson(e.target.value)}
              />
              <button onClick={handleImportJson} className="w-full py-2 bg-brand-500 rounded font-bold text-sm">Aplicar Legendas</button>
            </div>
          )}

          {!videoFile ? (
            <div className="flex-1 border-2 border-dashed border-brand-700 rounded-2xl flex flex-col items-center justify-center bg-brand-900/20 text-gray-400">
               <input type="file" className="hidden" id="v" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
               <label htmlFor="v" className="cursor-pointer flex flex-col items-center">
                 <Upload size={48} className="mb-4" />
                 <p>Subir vídeo</p>
               </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative">
                <VideoPlayer ref={videoRef} file={videoFile} subtitles={subtitles} currentTime={currentTime} style={style} onTimeUpdate={setCurrentTime} />
                <button 
                  onClick={togglePlay}
                  className="absolute bottom-4 left-4 p-3 bg-brand-500 rounded-full hover:scale-110 transition shadow-lg"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
              </div>
              <StyleControls style={style} onUpdate={setStyle} />
            </div>
          )}
        </div>

        <div className="w-[400px] border-l border-brand-800 bg-brand-900/30">
          <Timeline 
            subtitles={subtitles} 
            currentTime={currentTime} 
            onUpdate={setSubtitles} 
            onSeek={t => videoRef.current && (videoRef.current.currentTime = t)} 
          />
        </div>
      </main>
    </div>
  );
};

export default App;
