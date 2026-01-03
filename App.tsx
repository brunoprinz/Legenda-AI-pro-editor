import React, { useState, useRef } from 'react';
import { Upload, Download, Wand2, Type, Copy, ExternalLink, X, Palette, Loader2, Zap } from 'lucide-react';
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
          file,
          url,
          duration: video.duration,
          // Forçamos dimensões pares para evitar erros de codec
          width: Math.floor(video.videoWidth / 2) * 2,
          height: Math.floor(video.videoHeight / 2) * 2
        });
      };
    }
  };

  const copiarPromptParaIA = () => {
    const prompt = `AJA COMO UM TRANSCRITOR DE VÍDEO. Retorne APENAS o JSON puro: [{"startTime": 0.5, "endTime": 3.0, "text": "Frase"}]`;
    navigator.clipboard.writeText(prompt);
    alert("Prompt copiado!");
  };

  const handleImportJson = () => {
    try {
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setSubtitles(parsed.map((s: any, i: number) => ({ ...s, id: s.id || Date.now().toString() + i })));
      setIsModalOpen(false);
    } catch (e) { alert("Erro no JSON."); }
  };

  const handleExport = async () => {
    if (!videoState.file) return;
    setExportProgress({ status: 'exporting', progress: 0, message: 'Preparando vídeo...' });
    
    try {
      // Garantia de que a resolução é uma string limpa
      const finalRes = (resSelection || '480p').toString() as ExportResolution;
      
      await exportVideo(
        videoState.file, 
        subtitles, 
        style, 
        finalRes, 
        (p) => setExportProgress(p)
      );
    } catch (error: any) {
      console.error("Erro na exportação:", error);
      setExportProgress({ 
        status: 'error', 
        progress: 0, 
        message: `Falha: ${error.message || 'Erro de Dimensão'}` 
      });
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-gray-100 p-4 md:p-8 font-sans overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-brand-900/50 p-4 rounded-2xl border border-brand-800">
           <div className="flex items-center gap-2">
            <div className="bg-brand-500 p-2 rounded-lg"><Type size={20} /></div>
            <h1 className="text-xl font-bold italic uppercase text-white tracking-tighter">LegendaAI <span className="text-brand-500">PRO</span></h1>
          </div>
        </header>

        {!videoState.url ? (
          <div className="h-[60vh] flex items-center justify-center border-2 border-dashed border-brand-800 rounded-3xl bg-brand-900/20">
            <label className="flex flex-col items-center gap-4 cursor-pointer p-10">
              <Upload size={48} className="text-brand-400 animate-bounce" />
              <p className="font-bold text-center">Clique aqui para carregar seu vídeo</p>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {/* CONTAINER DO PLAYER: Agora ele se ajusta ao vídeo (max-h-screen para não sumir no Win7) */}
              <div className="relative bg-black rounded-3xl overflow-hidden border border-brand-800 shadow-2xl flex items-center justify-center min-h-[300px] max-h-[70vh]">
                <video 
                  ref={videoRef} 
                  src={videoState.url} 
                  className="max-w-full max-h-full" 
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} 
                  controls 
                />
                {/* Legenda de Preview */}
                <div className="absolute left-0 right-0 text-center pointer-events-none" style={{ bottom: `${style.bottomOffset}%` }}>
                  <span style={{
                    fontSize: `${style.fontSize}px`, 
                    color: style.color,
                    WebkitTextStroke: `${style.borderWidth}px ${style.borderColor}`,
                    padding: '4px 12px', 
                    fontWeight: 'bold',
                    backgroundColor: style.backgroundColor
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
                <button onClick={() => setIsModalOpen(true)} className="w-full py-4 bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-400 transition-all uppercase text-sm tracking-widest shadow-lg shadow-brand-500/20">
                  <Wand2 size={18} /> Gerar com IA
                </button>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> Qualidade de Exportação</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['original', '720p', '480p', '240p'].map((res) => (
                      <button key={res} onClick={() => setResSelection(res)}
                        className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${resSelection === res ? 'bg-brand-500 border-brand-400 text-white' : 'bg-brand-950 border-brand-800 text-gray-500 hover:border-brand-600'}`}>
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleExport} disabled={exportProgress.status === 'exporting'} className="w-full py-4 bg-white text-brand-950 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all">
                  {exportProgress.status === 'exporting' ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                  Exportar Vídeo Final
                </button>

                <div className="space-y-4 pt-4 border-t border-brand-800">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase">Ajustes Visuais</h3>
                    <label className="block text-[10px] font-bold text-gray-400">TAMANHO DA LETRA: {style.fontSize}px
                      <input type="range" min="12" max="100" value={style.fontSize} onChange={(e) => setStyle({...style, fontSize: parseInt(e.target.value)})} className="w-full mt-1 accent-brand-500" />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="text-[10px] font-bold text-gray-400">COR TEXTO
                        <input type="color" value={style.color} onChange={(e) => setStyle({...style, color: e.target.value})} className="w-full h-8 mt-1 block bg-transparent cursor-pointer border-none" />
                      </label>
                      <label className="text-[10px] font-bold text-gray-400">COR BORDA
                        <input type="color" value={style.borderColor} onChange={(e) => setStyle({...style, borderColor: e.target.value})} className="w-full h-8 mt-1 block bg-transparent cursor-pointer border-none" />
                      </label>
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importação */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-sm">
            <div className="bg-brand-900 border border-brand-700 p-8 rounded-3xl w-full max-w-2xl space-y-6 relative shadow-2xl">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">Assistente de Legendas</h2>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={copiarPromptParaIA} className="bg-brand-800 p-4 rounded-xl flex items-center justify-center gap-2 font-bold border border-brand-700 hover:bg-brand-700 transition-all text-xs">
                  <Copy size={16}/> 1. COPIAR PROMPT
                </button>
                <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="bg-blue-600/20 p-4 rounded-xl flex items-center justify-center gap-2 border border-blue-600/50 font-bold text-blue-400 text-xs">
                  <ExternalLink size={16}/> 2. ABRIR GEMINI
                </a>
              </div>
              <textarea className="w-full h-48 bg-brand-950 border border-brand-800 rounded-2xl p-4 font-mono text-green-400 text-sm focus:border-brand-500 outline-none" placeholder="Cole aqui o JSON gerado pelo Gemini..." value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} />
              <button onClick={handleImportJson} className="w-full py-4 bg-brand-500 rounded-2xl font-bold uppercase tracking-widest hover:bg-brand-400 transition-all">3. Aplicar ao Vídeo</button>
            </div>
          </div>
        )}
        
        {/* Barra de Progresso */}
        {exportProgress.status !== 'idle' && (
           <div className="fixed bottom-8 right-8 bg-brand-900 p-6 rounded-2xl border border-brand-700 shadow-2xl w-80 z-[110]">
              <p className="text-sm font-bold mb-3 uppercase tracking-tighter">{exportProgress.message}</p>
              <div className="w-full bg-brand-950 h-3 rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300 shadow-[0_0_10px_#e94560]" style={{width: `${exportProgress.progress}%`}} />
              </div>
              <div className="mt-2 text-[10px] font-mono text-gray-500 flex justify-between">
                <span>STATUS: {exportProgress.status.toUpperCase()}</span>
                <span>{Math.round(exportProgress.progress)}%</span>
              </div>
              {(exportProgress.status === 'done' || exportProgress.status === 'error') && (
                <button onClick={() => setExportProgress({status: 'idle', progress: 0})} className="mt-4 w-full py-2 bg-brand-800 rounded-lg text-xs font-bold hover:bg-brand-700">FECHAR</button>
              )}
           </div>
        )}
      </div>
    </div>
  );
}
