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
  const [resSelection, setResSelection] = useState<ExportResolution>('480p');

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => {
        setVideoState({ file, url, duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      };
    }
  };

  const copiarPromptParaIA = () => {
    const prompt = `AJA COMO UM TRANSCRITOR DE VÍDEO PROFISSIONAL. Transcreva o áudio e retorne APENAS o JSON puro no formato: [{"startTime": 0.5, "endTime": 3.0, "text": "Frase"}]. Respeite os tempos de fala.`;
    navigator.clipboard.writeText(prompt);
    alert("Prompt copiado!");
  };

  const handleImportJson = () => {
    try {
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const formatted = parsed.map((s: any, i: number) => ({
        ...s,
        id: s.id || Date.now().toString() + i,
        startTime: s.startTime ?? s.start ?? 0,
        endTime: s.endTime ?? s.end ?? 2
      }));
      setSubtitles(formatted);
      setIsModalOpen(false);
      setJsonInput('');
    } catch (e) { alert("Erro no JSON. Verifique o formato."); }
  };

  const handleExport = async () => {
    if (!videoState.file) return;
    setExportProgress({ status: 'exporting', progress: 0, message: 'Iniciando...' });
    try {
      // Forçamos a conversão para string para matar o erro d.replace
      const finalRes = String(resSelection) as ExportResolution;
      await exportVideo(videoState.file, subtitles, style, finalRes, (p) => setExportProgress(p));
    } catch (error: any) {
      setExportProgress({ status: 'error', progress: 0, message: `Erro: ${error.message}` });
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-gray-100 p-4 md:p-8 font-sans overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-brand-900/50 p-4 rounded-2xl border border-brand-800">
          <div className="flex items-center gap-2">
            <div className="bg-brand-500 p-2 rounded-lg"><Type size={20} /></div>
            <h1 className="text-xl font-bold italic uppercase text-white">LegendaAI <span className="text-brand-500">PRO</span></h1>
          </div>
        </header>

        {!videoState.url ? (
          <div className="h-[60vh] flex items-center justify-center border-2 border-dashed border-brand-800 rounded-3xl bg-brand-900/20">
            <label className="flex flex-col items-center gap-4 cursor-pointer p-10">
              <Upload size={48} className="text-brand-400" />
              <p className="font-bold text-white">Carregar vídeo</p>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-brand-800 shadow-2xl">
                <video ref={videoRef} src={videoState.url} className="w-full h-full" onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} controls />
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
                <button onClick={() => setIsModalOpen(true)} className="w-full py-4 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg">
                  <Wand2 size={18} /> Gerar Legendas (IA)
                </button>
                
                <div className="space-y-3">
                  <label className="text-xs font-bold text-brand-400 uppercase flex items-center gap-2"><Zap size={14}/> Resolução</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['original', '720p', '480p', '240p'].map((res) => (
                      <button key={res} onClick={() => setResSelection(res as ExportResolution)}
                        className={`py-2 px-2 rounded-lg text-[10px] font-bold border ${resSelection === res ? 'bg-brand-500 border-brand-400 text-white' : 'bg-brand-950 border-brand-800 text-gray-400'}`}>
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleExport} disabled={exportProgress.status === 'exporting'} className="w-full py-4 bg-white text-brand-950 hover:bg-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                  {exportProgress.status === 'exporting' ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                  Exportar MP4
                </button>

                <div className="space-y-4 pt-4 border-t border-brand-800">
                  <h3 className="font-bold flex items-center gap-2 text-xs uppercase text-brand-400"><Palette size={14}/> Estilo</h3>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Tamanho da Letra: {style.fontSize}px
                      <input type="range" min="12" max="100" value={style.fontSize} onChange={(e) => setStyle({...style, fontSize: parseInt(e.target.value)})} className="w-full mt-1 accent-brand-500" />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Cor Texto
                        <input type="color" value={style.color} onChange={(e) => setStyle({...style, color: e.target.value})} className="w-full h-8 mt-1 block bg-transparent cursor-pointer border-none" />
                      </label>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Cor Borda
                        <input type="color" value={style.borderColor} onChange={(e) => setStyle({...style, borderColor: e.target.value})} className="w-full h-8 mt-1 block bg-transparent cursor-pointer border-none" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-sm">
            <div className="bg-brand-900 border border-brand-700 p-8 rounded-3xl w-full max-w-2xl space-y-6 shadow-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
              <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Wand2 className="text-brand-500"/> Gerar com Gemini</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={copiarPromptParaIA} className="bg-brand-800 p-4 rounded-xl flex items-center justify-center gap-2 font-bold border border-brand-700 hover:bg-brand-700 transition-all text-sm">
                  <Copy size={18}/> 1. Copiar Prompt
                </button>
                <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="bg-blue-600/20 p-4 rounded-xl flex items-center justify-center gap-2 border border-blue-600/50 font-bold hover:bg-blue-600/30 transition-all text-blue-400 text-sm">
                  <ExternalLink size={18}/> 2. Abrir Gemini
                </a>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">3. Cole o JSON gerado abaixo:</label>
                <textarea className="w-full h-48 bg-brand-950 border border-brand-800 rounded-2xl p-4 font-mono text-green-400 text-sm outline-none focus:border-brand-500" placeholder='[{"startTime": 0, "endTime": 2, "text": "Exemplo"}]' value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} />
              </div>

              <button onClick={handleImportJson} className="w-full py-4 bg-brand-500 hover:bg-brand-400 rounded-2xl font-bold shadow-lg shadow-brand-500/20 transition-all uppercase tracking-widest text-white">4. Aplicar Legendas</button>
            </div>
          </div>
        )}
        
        {exportProgress.status !== 'idle' && (
           <div className="fixed bottom-8 right-8 bg-brand-900 p-6 rounded-2xl border border-brand-700 shadow-2xl w-80 z-[110]">
              <p className="text-sm font-bold mb-3">{exportProgress.message} ({Math.round(exportProgress.progress)}%)</p>
              <div className="w-full bg-brand-950 h-3 rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300 shadow-[0_0_10px_#e94560]" style={{width: `${exportProgress.progress}%`}} />
              </div>
              {(exportProgress.status === 'done' || exportProgress.status === 'error') && (
                <button onClick={() => setExportProgress({status: 'idle', progress: 0})} className="mt-4 w-full py-2 bg-brand-800 rounded-lg text-xs font-bold">Fechar</button>
              )}
           </div>
        )}
      </div>
    </div>
  );
}
