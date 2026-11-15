import React, { useEffect, useState } from 'react';
import { Lightbulb, MapPin, Plus, X } from 'lucide-react';
import { Marker } from 'react-map-gl';
import { DEFINICAO } from '../../sim/intervencoes';
import { paraLocais } from '../../sim/cenarios';
import { sugerir, type Sugestao } from '../../sim/sugestoes';
import type { Simulacao } from '../../sim/useSimulacao';
import { IconeIntervencao } from './IconeIntervencao';

export interface Assistente {
  sugestoes: Sugestao[];
  /** Minutos simulados que embasam as sugestões. */
  minutos: number;
  ignorar: (chave: string) => void;
  aplicar: (s: Sugestao) => void;
  destacada: string | null;
  destacar: (chave: string | null) => void;
}

/** Recalcula as sugestões a cada 3 s a partir do que a simulação mediu. */
export function useAssistente(sim: Simulacao): Assistente {
  const [todas, setTodas] = useState<Sugestao[]>([]);
  const [minutos, setMinutos] = useState(0);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [destacada, setDestacada] = useState<string | null>(null);
  const { rede, motorRef, intervencoes, adicionar } = sim;

  useEffect(() => {
    if (!rede) return;
    const calcular = () => {
      const motor = motorRef.current;
      if (!motor) return;
      const horas = motor.metricas().horas;
      setMinutos(horas * 60);
      setTodas(sugerir(rede, motor.eventos, horas, paraLocais(rede, intervencoes), motor.fluxoRetorno));
    };
    calcular();
    const id = window.setInterval(calcular, 3000);
    return () => window.clearInterval(id);
  }, [rede, motorRef, intervencoes]);

  return {
    sugestoes: todas.filter((s) => !ignoradas.includes(s.chave)),
    minutos,
    ignorar: (chave) => setIgnoradas((l) => [...l, chave]),
    aplicar: (s) => adicionar(s.tipo, s.lng, s.lat),
    destacada,
    destacar: setDestacada,
  };
}

/** Cartão do assistente no painel de intervenções. */
export const CartaoSugestoes: React.FC<{ assistente: Assistente }> = ({ assistente: a }) => {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <section aria-label="Sugestões do assistente" className="rounded-xl border border-violet-200 bg-violet-50/60 overflow-hidden">
      <header className="px-3 py-2 flex items-center gap-2 border-b border-violet-200 bg-violet-100/70">
        <Lightbulb className="w-4 h-4 text-violet-700" />
        <h3 className="text-sm font-extrabold text-violet-950 flex-1">Sugestões do assistente</h3>
        <span className="text-[10px] font-semibold text-violet-800">quem decide é você</span>
      </header>
      {a.sugestoes.length === 0 ? (
        <p className="text-[11px] text-violet-900 px-3 py-2.5">
          {a.minutos < 5
            ? 'Deixe a simulação rodar alguns minutos (use 20×). O assistente olha onde acontecem os quase-acidentes e as infrações e sugere onde agir.'
            : 'Nada novo a sugerir com o que está no mapa. Rode mais tempo ou mude a hora do dia.'}
        </p>
      ) : (
        <ol className="divide-y divide-violet-200">
          {a.sugestoes.map((s, i) => {
            const def = DEFINICAO[s.tipo];
            const aberto = aberta === s.chave || (aberta === null && i === 0);
            return (
              <li
                key={s.chave}
                className={`px-3 py-2.5 ${a.destacada === s.chave ? 'bg-violet-100' : ''}`}
                onMouseEnter={() => a.destacar(s.chave)}
                onMouseLeave={() => a.destacar(null)}
              >
                <button type="button" onClick={() => setAberta(aberto ? '' : s.chave)} className="w-full flex items-start gap-2 text-left">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-violet-700 text-white text-[11px] font-extrabold flex items-center justify-center">S{i + 1}</span>
                  <IconeIntervencao tipo={s.tipo} tamanho={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 leading-snug">
                      {def.nome} no {s.lugar}
                    </span>
                    <span className="block text-[11px] text-violet-900">{s.destaque ?? `${Math.round(s.parteRisco * 100)}% do risco medido está aqui`}</span>
                  </span>
                </button>
                {aberto && (
                  <div className="mt-2 ml-8">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800 mb-1">Por quê</p>
                    <ul className="space-y-1">
                      {s.porque.map((t) => (
                        <li key={t} className="text-[11px] text-slate-700 leading-snug pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[0.45rem] before:w-1.5 before:h-1.5 before:rounded-full before:bg-violet-400">
                          {t}
                        </li>
                      ))}
                    </ul>
                    {s.alternativa && (
                      <p className="text-[11px] text-slate-600 mt-1.5">
                        <strong className="text-slate-800">Alternativa:</strong> {DEFINICAO[s.alternativa.tipo].nome.toLowerCase()}. {s.alternativa.motivo}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => a.aplicar(s)}
                        className="flex items-center gap-1 text-[11px] font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-lg px-2.5 py-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Testar aqui
                      </button>
                      <button
                        type="button"
                        onClick={() => a.ignorar(s.chave)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-2.5 py-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Ignorar
                      </button>
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5 ml-auto">
                        <MapPin className="w-3 h-3" /> S{i + 1} no mapa
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {a.sugestoes.length > 0 && (
        <p className="text-[10px] text-violet-900/80 px-3 py-1.5 border-t border-violet-200">
          Baseado em {Math.round(a.minutos)} min simulados desde a última mudança no mapa. Depois de testar, veja a variação contra hoje.
        </p>
      )}
    </section>
  );
};

/** Alfinetes S1, S2… no mapa, onde cada sugestão agiria. */
export const MarcadoresSugestao: React.FC<{ assistente: Assistente }> = ({ assistente: a }) => (
  <>
    <style>{`@keyframes alfinete-entra { from { transform: translateY(-12px) scale(0.55); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    {a.sugestoes.map((s, i) => {
      const ativo = a.destacada === s.chave;
      return (
        <Marker key={s.chave} longitude={s.lng} latitude={s.lat} anchor="bottom">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              a.destacar(ativo ? null : s.chave);
            }}
            title={`Sugestão: ${DEFINICAO[s.tipo].nome} no ${s.lugar}`}
            className="block"
            style={{ animation: 'alfinete-entra 0.4s ease-out both', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.45))' }}
          >
            <svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true" className={ativo ? 'scale-110 origin-bottom' : ''}>
              <path d="M16 38s-12-12.5-12-22a12 12 0 1 1 24 0c0 9.5-12 22-12 22z" fill="#2563eb" stroke="#ffffff" strokeWidth="1.6" />
              <text x="16" y="18" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffffff">
                S{i + 1}
              </text>
            </svg>
          </button>
        </Marker>
      );
    })}
  </>
);
