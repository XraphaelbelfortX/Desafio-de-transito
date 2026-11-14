import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { formatarHora, type Velocidade } from '../../sim/useSimulacao';

const VELOCIDADES: Velocidade[] = [1, 5, 20];

const ATALHOS: { h: number; rotulo: string; titulo: string }[] = [
  { h: 7, rotulo: '7h', titulo: 'Pico da manhã' },
  { h: 12, rotulo: '12h', titulo: 'Meio-dia' },
  { h: 18, rotulo: '18h', titulo: 'Pico da tarde' },
  { h: 23, rotulo: '23h', titulo: 'Noite' },
];

interface Props {
  rodando: boolean;
  onRodando: (v: boolean) => void;
  velocidade: Velocidade;
  onVelocidade: (v: Velocidade) => void;
  hora: number;
  onHora: (h: number) => void;
  onReiniciar: () => void;
}

/** Play, velocidade, relógio e hora do dia. Fica no canto inferior esquerdo do mapa. */
export const ControlesTempo: React.FC<Props> = ({
  rodando,
  onRodando,
  velocidade,
  onVelocidade,
  hora,
  onHora,
  onReiniciar,
}) => {
  const horaDia = ((hora % 24) + 24) % 24;

  return (
    <div className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-slate-800 w-[min(100vw-8rem,420px)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onRodando(!rodando)}
          aria-label={rodando ? 'Pausar simulação' : 'Continuar simulação'}
          aria-pressed={rodando}
          className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700"
        >
          {rodando ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden" role="radiogroup" aria-label="Velocidade">
          {VELOCIDADES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={velocidade === v}
              onClick={() => onVelocidade(v)}
              className={`px-2 py-1 text-[11px] font-bold tabular-nums ${
                velocidade === v ? 'bg-blue-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v}×
            </button>
          ))}
        </div>
        <span className="font-mono text-sm font-bold tabular-nums px-1" aria-live="polite">
          {formatarHora(horaDia)}
        </span>
        <button
          type="button"
          onClick={onReiniciar}
          className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-700 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50"
        >
          <RotateCcw className="w-3 h-3" />
          Recomeçar
        </button>
      </div>

      <label className="block mt-1.5">
        <span className="sr-only">Hora do dia</span>
        <input
          type="range"
          min={0}
          max={23}
          step="any"
          value={horaDia}
          onChange={(e) => onHora(Number(e.target.value))}
          aria-valuetext={formatarHora(horaDia)}
          className="w-full accent-blue-800"
        />
      </label>

      <div className="flex gap-1">
        {ATALHOS.map((a) => (
          <button
            key={a.h}
            type="button"
            title={a.titulo}
            onClick={() => onHora(a.h)}
            className={`flex-1 text-[11px] font-semibold rounded-md py-0.5 border ${
              Math.abs(horaDia - a.h) < 0.02
                ? 'bg-blue-50 text-blue-900 border-blue-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
};
