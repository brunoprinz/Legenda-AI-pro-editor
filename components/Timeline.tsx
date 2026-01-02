import React from 'react';
import { Subtitle } from '../types';
import { Trash2, Plus } from 'lucide-react';

interface TimelineProps {
  subtitles: Subtitle[];
  currentTime: number;
  onUpdate: (subs: Subtitle[]) => void;
  onSeek: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ subtitles, currentTime, onUpdate, onSeek }) => {
  
  const handleChange = (id: string, field: keyof Subtitle, value: any) => {
    const updated = subtitles.map(s => {
      if (s.id === id) return { ...s, [field]: value };
      return s;
    });
    // Sort by start time if time changed
    if (field === 'startTime') {
      updated.sort((a, b) => a.startTime - b.startTime);
    }
    onUpdate(updated);
  };

  const handleDelete = (id: string) => {
    onUpdate(subtitles.filter(s => s.id !== id));
  };

  const handleAdd = () => {
    const newSub: Subtitle = {
      id: Date.now().toString(),
      startTime: currentTime,
      endTime: currentTime + 2,
      text: "Nova legenda"
    };
    const updated = [...subtitles, newSub].sort((a, b) => a.startTime - b.startTime);
    onUpdate(updated);
  };

  // Convert seconds to mm:ss.ms
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const m = parseInt(parts[0]);
    const s = parseFloat(parts[1]);
    return (m * 60) + s;
  };

  // Auto scroll to active
  const activeRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentTime]); // Might be too chatty, maybe filter by active index change

  return (
    <div className="flex flex-col h-full bg-brand-800 border-t border-brand-700">
      <div className="p-2 bg-brand-900 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-400">Linha do Tempo</h3>
        <button onClick={handleAdd} className="flex items-center gap-1 text-xs bg-brand-500 hover:bg-red-600 px-3 py-1 rounded text-white transition">
          <Plus size={14} /> Adicionar
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {subtitles.length === 0 && (
          <div className="text-center text-gray-500 py-10 text-sm">
            Nenhuma legenda. Adicione manualmente ou use a IA.
          </div>
        )}
        
        {subtitles.map((sub) => {
          const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
          return (
            <div 
              key={sub.id} 
              ref={isActive ? activeRef : null}
              className={`flex gap-2 items-start p-3 rounded border ${isActive ? 'bg-brand-700 border-brand-500 ring-1 ring-brand-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'} transition-all`}
            >
              <div className="flex flex-col gap-1 w-24 flex-shrink-0">
                <input 
                  type="text" 
                  className="bg-gray-900 text-xs p-1 rounded border border-gray-700 text-center font-mono"
                  value={formatTime(sub.startTime)}
                  onChange={(e) => handleChange(sub.id, 'startTime', parseTime(e.target.value))}
                  onBlur={() => { /* validation logic could go here */}}
                />
                <input 
                  type="text" 
                  className="bg-gray-900 text-xs p-1 rounded border border-gray-700 text-center font-mono"
                  value={formatTime(sub.endTime)}
                  onChange={(e) => handleChange(sub.id, 'endTime', parseTime(e.target.value))}
                />
              </div>
              
              <textarea 
                className="flex-1 bg-transparent resize-none outline-none text-sm p-1 leading-tight h-full min-h-[3rem]"
                value={sub.text}
                onChange={(e) => handleChange(sub.id, 'text', e.target.value)}
                onClick={() => onSeek(sub.startTime)}
              />
              
              <button 
                onClick={() => handleDelete(sub.id)}
                className="text-gray-500 hover:text-red-400 p-1"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
