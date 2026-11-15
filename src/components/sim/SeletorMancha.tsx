import React from 'react';

export type Mancha = 'conflitos' | 'infracoes' | 'ocorrencias';

const OPCOES: { id: Mancha; nome: string; rampa: string }[] = [
  { id: 'conflitos', nome: 'Quase-acidentes', rampa: 'from-gv-orange to-gv-red' },
  { id: 'infracoes', nome: 'Infrações', rampa: 'from-pink-400 to-purple-950' },
  { id: 'ocorrencias', nome: 'Ocorrências', rampa: 'from-gv-cyan via-gv-amber to-gv-red' },
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
  const pontos = mancha === 'ocorrencias' ? null : pontosSim[mancha];
  const aviso =
    pontos === null
      ? 'Ocorrências já registradas no cruzamento. Não mudam com a simulação.'
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
                className={`w-2.5 h-2.5 rounded-sm ${a.borda ? 'border border-gv-border' : ''}`}
                style={{ background: a.cor }}
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
