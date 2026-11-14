import React from 'react';

export type Mancha = 'conflitos' | 'infracoes' | 'relatos';

const OPCOES: { id: Mancha; nome: string; rampa: string }[] = [
  { id: 'conflitos', nome: 'Quase-acidentes', rampa: 'from-orange-400 to-red-950' },
  { id: 'infracoes', nome: 'Infrações', rampa: 'from-pink-400 to-purple-950' },
  { id: 'relatos', nome: 'Relatos', rampa: 'from-blue-500 via-amber-400 to-red-700' },
];

const AGENTES = [
  { cor: '#f8fafc', nome: 'Carro', borda: true },
  { cor: '#7dd3fc', nome: 'Moto' },
  { cor: '#c4b5fd', nome: 'Ônibus' },
  { cor: '#fde047', nome: 'Pedestre' },
  { cor: '#ef4444', nome: 'Infrator' },
  { cor: '#22d3ee', nome: 'Selecionado' },
];

interface Props {
  mancha: Mancha;
  onMancha: (m: Mancha) => void;
  erro: string | null;
  rodando: boolean;
  pontosSim: { conflitos: number; infracoes: number };
}

/** Seletor da mancha e legenda dos agentes, no canto do mapa. */
export const SeletorMancha: React.FC<Props> = ({ mancha, onMancha, erro, rodando, pontosSim }) => {
  const ativa = OPCOES.find((o) => o.id === mancha) ?? OPCOES[0];
  const pontos = mancha === 'relatos' ? null : pontosSim[mancha];
  const aviso =
    pontos === null
      ? 'Relatos que já chegaram. Não mudam com a simulação.'
      : pontos === 0
        ? rodando
          ? 'Ainda vazia. A simulação pinta aqui conforme registra.'
          : 'Ainda vazia. A simulação está pausada.'
        : `${pontos.toLocaleString('pt-BR')} ${pontos === 1 ? 'ponto' : 'pontos'} nesta configuração.`;
  return (
    <div className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-[11px] text-slate-700 max-w-full">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Mancha do mapa">
        {OPCOES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mancha === o.id}
            onClick={() => onMancha(o.id)}
            className={`px-2 py-1 rounded-lg font-semibold border ${
              mancha === o.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {o.nome}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-slate-500">Nenhum</span>
        <div className={`w-24 h-2 rounded-full bg-gradient-to-r ${ativa.rampa}`} />
        <span className="text-[10px] font-semibold text-slate-700">Muitos</span>
      </div>
      <p className="text-[10px] text-slate-500 mt-1 leading-snug">{aviso}</p>
      <details className="mt-1.5">
        <summary className="cursor-pointer text-[10px] font-semibold text-slate-500">Legenda dos agentes</summary>
        <ul className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1">
          {AGENTES.map((a) => (
            <li key={a.nome} className="flex items-center gap-1">
              <span
                className={`w-2.5 h-2.5 rounded-sm ${a.borda ? 'border border-slate-400' : ''}`}
                style={{ background: a.cor }}
              />
              {a.nome}
            </li>
          ))}
          <li className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Semáforo
          </li>
        </ul>
      </details>
      {erro && <p className="text-red-700 mt-1">Simulador indisponível: {erro}</p>}
    </div>
  );
};
