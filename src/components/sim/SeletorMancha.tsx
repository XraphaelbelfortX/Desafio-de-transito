import React from 'react';
import { PALETA } from './paleta';

export type Mancha = 'conflitos' | 'infracoes' | 'relatos';

const OPCOES: { id: Mancha; nome: string; rampa: string }[] = [
  { id: 'conflitos', nome: 'Quase-acidentes', rampa: 'from-orange-300 to-orange-700' },
  { id: 'infracoes', nome: 'Infrações', rampa: 'from-red-300 to-red-800' },
  { id: 'relatos', nome: 'Relatos', rampa: 'from-slate-300 to-slate-600' },
];

const AGENTES: { cor: string; nome: string; borda?: boolean; anel?: string }[] = [
  { cor: PALETA.carro, nome: 'Carro', borda: true },
  { cor: PALETA.moto, nome: 'Moto' },
  { cor: PALETA.onibus, nome: 'Ônibus' },
  { cor: PALETA.pedestre, nome: 'Pedestre' },
  { cor: 'transparent', nome: 'Contorno de infrator', anel: PALETA.infracao },
  { cor: 'transparent', nome: 'Anel selecionado', anel: PALETA.selecionado },
];

interface Props {
  mancha: Mancha;
  onMancha: (m: Mancha) => void;
  erro: string | null;
  rodando: boolean;
  pontosSim: { conflitos: number; infracoes: number };
  relatosAtivos: boolean;
}

/** Seletor da mancha e legenda dos agentes, no canto do mapa. */
export const SeletorMancha: React.FC<Props> = ({ mancha, onMancha, erro, rodando, pontosSim, relatosAtivos }) => {
  const ativa = OPCOES.find((o) => o.id === mancha) ?? OPCOES[0];
  const pontos = mancha === 'relatos' ? null : pontosSim[mancha];
  const aviso =
    pontos === null
      ? relatosAtivos
        ? 'Relatos que já chegaram. Não mudam com a simulação.'
        : 'Relatos desligados. O mapa não mostra esses pontos.'
      : pontos === 0
        ? rodando
          ? 'Ainda vazia. A simulação pinta aqui conforme registra.'
          : 'Ainda vazia. A simulação está pausada.'
        : `${pontos.toLocaleString('pt-BR')} ${pontos === 1 ? 'ponto' : 'pontos'} nesta configuração.`;
  return (
    <div className="bg-gv-bg/90 backdrop-blur-md px-3 py-2 rounded-xl border border-gv-border shadow-md text-[11px] text-gv-ink max-w-full">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Mancha do mapa">
        {OPCOES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mancha === o.id}
            onClick={() => onMancha(o.id)}
            className={`px-2 py-1 rounded-lg font-semibold border ${
              mancha === o.id ? 'bg-gv-bg text-white border-gv-border' : 'bg-gv-card text-gv-ink border-gv-border hover:bg-gv-panel'
            }`}
          >
            {o.nome}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-gv-muted">Nenhum</span>
        <div className={`w-24 h-2 rounded-full bg-gradient-to-r ${ativa.rampa}`} />
        <span className="text-[10px] font-semibold text-gv-ink">Muitos</span>
      </div>
      <p className="text-[10px] text-gv-muted mt-1 leading-snug">{aviso}</p>
      <details className="mt-1.5">
        <summary className="cursor-pointer text-[10px] font-semibold text-gv-muted">Legenda dos agentes</summary>
        <ul className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1">
          {AGENTES.map((a) => (
            <li key={a.nome} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  background: a.cor,
                  boxShadow: a.anel ? `inset 0 0 0 2px ${a.anel}` : a.borda ? 'inset 0 0 0 1px #94a3b8' : undefined,
                }}
              />
              {a.nome}
            </li>
          ))}
          <li className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gv-green" />
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="w-2 h-2 rounded-full bg-gv-red" />
            Semáforo
          </li>
        </ul>
      </details>
      {erro && <p className="text-gv-red mt-1">Simulador indisponível: {erro}</p>}
    </div>
  );
};
