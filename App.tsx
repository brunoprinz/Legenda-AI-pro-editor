import React, { useState, useRef } from 'react';
import { Upload, Wand2, Type, Copy, ExternalLink, Download, Settings } from 'lucide-react';
import Timeline from './components/Timeline';
import SubtitleEditor from './components/SubtitleEditor';
import ExportSettings from './components/ExportSettings'; // Reativando o exportador
import { Subtitle } from './types';

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [step, setStep] = useState<'upload' | 'generate' | 'edit'>('upload');
  const [jsonInput, setJsonInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStep('generate');
    }
  };

  const copiarPromptParaIA = () => {
    const prompt = `AJA COMO UM TRANSCRITOR DE VÍDEO PROFISSIONAL. 
Assista ao vídeo/áudio anexo e extraia as legendas com tempo de início e fim.
Retorne APENAS o JSON puro, sem textos extras ou markdown, seguindo este formato:
[
  {"startTime": 0.5, "endTime": 3.0, "text": "Frase 1"},
  {"startTime": 3.2, "endTime": 5.0, "text": "Frase 2"}
]`;
    const textArea = document.createElement("textarea");
    textArea.value = prompt;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert("Prompt copiado! Agora anexe o vídeo no Gemini e cole o comando.");
  };

  const processarLegendasManuais = () => {
    try {
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setSubtitles(parsed);
      setStep('edit');
    } catch (error) {
      alert("Erro no JSON. Verifique se copiou o código completo.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg"><Type size={20} /></div>
            <h1 className="text-xl font-bold italic uppercase tracking-tighter">LegendaAI <span className="text-red-500 underline">PRO</span></h1>
          </div>
          {videoFile && <span className="text-xs text-slate-500 font-mono hidden md:block">Arquivo: {videoFile.name}</span>}
        </header>

        {step === 'upload' && (
          <div className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl p-10 md:p-20 text-center shadow-2xl">
            <input type="file" accept="video/*" onChange={handleFileUpload} id="video-upload" className="hidden" />
            <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
              <div className="bg-blue-600/10 p-6 rounded-full mb-4 text-blue-400"><Upload size={40} /></div>
              <h2 className="text-2xl font-bold mb-2">Fazer Upload do Vídeo</h2>
              <p className="text-slate-400 mb-8 max-w-sm">Selecione o arquivo do seu computador para começar a edição</p>
              <span className="bg-blue-600 hover:bg-blue-500 px-10 py-4 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg">
                Selecionar Arquivo
              </span>
            </label>
          </div>
        )}

        {step === 'generate' && (
          <div className="max-w-2xl mx-auto bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Wand2 /> Passo 2: Gerar Legendas</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={copiarPromptParaIA} className="bg-slate-700 hover:bg-slate-600 p-4 rounded-xl flex flex-col items-center gap-2 transition border border-slate-600 group">
                  <Copy size={24} className="group-hover:text-blue-400" />
                  <span className="text-sm font-bold">1. Copiar Prompt</span>
                </button>
                <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="bg-blue-600/20 hover:bg-blue-600/30 p-4 rounded-xl flex flex-col items-center gap-2 transition border border-blue-600/50 group">
                  <ExternalLink size={24} className="group-hover:text-blue-400" />
                  <span className="text-sm font-bold">2. Abrir Gemini</span>
                </a>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Cole o código da IA abaixo:</label>
                <textarea 
                  className="w-full h-48 bg-slate-950 border border-slate-700 rounded-xl p-4 font-mono text-sm text-green-400 focus:border-blue-500 outline-none transition-all"
                  placeholder='[{"startTime": 0.0, "endTime": 2.0, "text": "Exemplo..."}]'
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
              </div>
              <button 
                onClick={processarLegendasManuais} 
                disabled={!jsonInput}
                className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-bold text-lg transition-all shadow-lg disabled:opacity-30"
              >
                Prosseguir para o Editor
              </button>
            </div>
          </div>
        )}

        {step === 'edit' && videoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 group">
                <video 
                  ref={videoRef}
                  src={videoUrl} 
                  className="w-full max-h-[500px] mx-auto" 
                  controls
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                />
                <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none px-6">
                  <span className="inline-block bg-black/80 text-white text-xl md:text-2xl px-4 py-1 rounded-md shadow-2xl border border-white/10 font-medium">
                    {subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.text || ""}
                  </span>
                </div>
              </div>
              
              <Timeline 
                subtitles={subtitles}
                currentTime={currentTime}
                duration={videoRef.current?.duration || 0}
                onSubtitleChange={setSubtitles}
              />
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Settings size={20} className="text-blue-400"/> Exportação</h3>
                <ExportSettings 
                  videoFile={videoFile!}
                  subtitles={subtitles}
                />
              </div>
              
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg overflow-y-auto max-h-[400px]">
                 <SubtitleEditor 
                    subtitles={subtitles}
                    currentTime={currentTime}
                    onSubtitleChange={setSubtitles}
                 />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponente simples de editor para não falhar caso o arquivo falte
const SubtitleEditor = ({subtitles, currentTime, onSubtitleChange}: any) => {
    return (
        <div>
            <h4 className="font-bold text-sm text-slate-400 mb-4 uppercase tracking-widest">Legendas Atuais</h4>
            <div className="space-y-2">
                {subtitles.map((s: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg text-sm ${currentTime >= s.startTime && currentTime <= s.endTime ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-slate-900 border border-slate-800'}`}>
                        <input 
                            value={s.text} 
                            onChange={(e) => {
                                const newSubs = [...subtitles];
                                newSubs[i].text = e.target.value;
                                onSubtitleChange(newSubs);
                            }}
                            className="bg-transparent w-full outline-none"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;
