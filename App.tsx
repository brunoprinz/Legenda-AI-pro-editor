import React, { useState, useRef } from 'react';
import { Upload, Download, Wand2, Type, Copy, ExternalLink, X, Palette, Loader2, Zap, AlertTriangle } from 'lucide-react';
import Timeline from './components/Timeline';
import { Subtitle, SubtitleStyle, VideoState, ExportProgress, ExportResolution } from './types';
import { exportVideo } from './services/exportService';

const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 24, fontFamily: 'Arial', color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0)',
  borderWidth: 2, borderColor: '#000000', bottomOffset: 10, opacity: 1
};

export default function App() {
  const [videoState, setVideoState] = useState<VideoState>({ file: null, url: null, duration: 0, width: 0, height: 0 });
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({ status: 'idle', progress: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [resSelection, setResSelection] = useState<string>('480p');

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

  const handleExport = async () => {
    if (!videoState.file) return;
    setExportProgress({ status: 'exporting', progress: 0, message: 'Iniciando Processamento...' });
    
    try {
      // Garantia absoluta de string para o d.replace do service
      const cleanRes = String(resSelection || '480p') as ExportResolution;
      await exportVideo(videoState.file, subtitles, style, cleanRes, (p) => setExportProgress(p));
    } catch (error: any) {
      setExportProgress({ 
        status: 'error', 
        progress: 0, 
        message: `Erro de Codec: Verifique se as dimensões são suportadas.` 
      });
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-brand-900/50 p-4 rounded-2xl border border-brand-800">
          <div className="flex items-center gap-2">
            <div className="bg-brand-500 p-2 rounded-lg"><Type size={20} /></div>
            <h1 className="text-xl font-bold italic uppercase text-white">LegendaAI <span className="text-brand-500">PRO</span></h1>
          </div>
        </header>

        {!videoState.url ? (
          <div className="h-[60vh] flex items-center justify-center border-2 border-dashed border-brand-800 rounded-3xl bg-brand-900/20">
            <label className="flex flex-col items-center gap-4 cursor-pointer p-10 group">
              <Upload size={48} className="text-brand-400 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-center">Clique para importar seu vídeo</p>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {/* PLAYER FLEXÍVEL: Agora ele se adapta ao formato do vídeo automaticamente */}
              <div className="relative bg-black rounded-3xl overflow-hidden border border-brand-800 shadow-2xl flex items-center justify-center min-h-[400px]">
                <video 
                  ref={videoRef} 
                  src={videoState.url} 
                  className="max-w-full max-h-[70vh] object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  controls 
                />

                <div className="absolute left-0 right-0 text-center pointer-events-none" style={{ bottom: `${style.bottomOffset}%` }}>
                  <span style={{
                    fontSize: `${style.fontSize}px`, color: style.color,
                    WebkitTextStroke: `${style.borderWidth}px ${style.borderColor}`,
                    padding: '4px 12px', fontWeight: 'bold'
                  }}>
                    {subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.text}
                  </span>
                </div>
              </div>
              <div className="bg-brand-900/50 p-4 rounded-3xl border border-brand-800">
                <Timeline subtitles={subtitles} currentTime={currentTime} duration={videoState.duration} onUpdate={setSubtitles} onSeek={(t) => {if(videoRef.current) videoRef.current.currentTime = t}} />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="bg-brand-900/50 p-6 rounded-3xl border border-brand-800 space-y-6">
                <button onClick={() => setIsModalOpen(true)} className="w-full py-4 bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-400 transition-all uppercase text-xs">
                  <Wand2 size={18} /> Importar Legendas IA
                </button>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> Resolução (Recomendado: 480p)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['original', '720p', '480p', '240p'].map((res) => (
                      <button key={res} onClick={() => setResSelection(res)}
                        className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${resSelection === res ? 'bg-brand-500 border-brand-400' : 'bg-brand-950 border-brand-800 text-gray-500 hover:border-brand-600'}`}>
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleExport} disabled={exportProgress.status === 'exporting'} className="w-full py-4 bg-white text-brand-950 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all shadow-lg">
                  {exportProgress.status === 'exporting' ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                  Exportar MP4 Final
                </button>

                <div className="space-y-4 pt-4 border-t border-brand-800">
                    <label className="block text-[10px] font-bold text-gray-400">TAMANHO DA FONTE: {style.fontSize}px
                      <input type="range" min="12" max="100" value={style.fontSize} onChange={(e) => setStyle({...style, fontSize: parseInt(e.target.value)})} className="w-full mt-1 accent-brand-500" />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="text-[10px] font-bold text-gray-400">TEXTO <input type="color" value={style.color} onChange={(e) => setStyle({...style, color: e.target.value})} className="w-full h-8 mt-1 block bg-transparent border-none cursor-pointer" /></label>
                      <label className="text-[10px] font-bold text-gray-400">BORDA <input type="color" value={style.borderColor} onChange={(e) => setStyle({...style, borderColor: e.target.value})} className="w-full h-8 mt-1 block bg-transparent border-none cursor-pointer" /></label>
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal permanece igual para manter o fluxo do Gemini */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-sm">
            <div className="bg-brand-900 border border-brand-700 p-8 rounded-3xl w-full max-w-2xl space-y-6 relative shadow-2xl">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">Importar do Gemini</h2>
              <textarea className="w-full h-48 bg-brand-950 border border-brand-800 rounded-2xl p-4 font-mono text-green-400 text-sm focus:border-brand-500 outline-none" placeholder="Cole o JSON aqui..." value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} />
              <button onClick={() => {
                try {
                  const clean = jsonInput.replace(/```json|```/g, "").trim();
                  setSubtitles(JSON.parse(clean).map((s:any, i:number) => ({...s, id: Date.now()+i})));
                  setIsModalOpen(false);
                } catch(e) { alert("Erro no JSON"); }
              }} className="w-full py-4 bg-brand-500 rounded-2xl font-bold uppercase">Aplicar Legendas</button>
            </div>
          </div>
        )}
        
        {exportProgress.status !== 'idle' && (
           <div className="fixed bottom-8 right-8 bg-brand-900 p-6 rounded-2xl border border-brand-700 shadow-2xl w-80 z-[110]">
              <p className="text-sm font-bold mb-3 uppercase tracking-tighter">{exportProgress.message}</p>
              <div className="w-full bg-brand-950 h-3 rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300 shadow-[0_0_10px_#e94560]" style={{width: `${exportProgress.progress}%`}} />
              </div>
              {exportProgress.status === 'error' && (
                <button onClick={() => setExportProgress({status: 'idle', progress: 0})} className="mt-4 w-full py-2 bg-red-600 rounded-lg text-xs font-bold">Tentar Novamente</button>
              )}
           </div>
        )}
      </div>
    </div>
  );
}