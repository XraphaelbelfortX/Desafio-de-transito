import React from 'react';
import { DEFINICAO, type Categoria, type TipoIntervencao } from '../../sim/intervencoes';

/**
 * Ícone de cada intervenção no formato de placa de trânsito:
 * a forma e a cor dizem a categoria (losango amarelo = moderação de velocidade, como as
 * placas de advertência; círculo azul = fiscalização; retângulo escuro = controle;
 * quadrado verde = mudança de geometria).
 */

export const COR_CATEGORIA: Record<Categoria, { fundo: string; traco: string; tinta: string; nome: string }> = {
  moderacao: { fundo: '#facc15', traco: '#1f2937', tinta: '#111827', nome: 'Moderação de velocidade' },
  fiscalizacao: { fundo: '#1d4ed8', traco: '#ffffff', tinta: '#ffffff', nome: 'Fiscalização' },
  controle: { fundo: '#111827', traco: '#e5e7eb', tinta: '#ffffff', nome: 'Controle do cruzamento' },
  geometria: { fundo: '#15803d', traco: '#ffffff', tinta: '#ffffff', nome: 'Geometria da via' },
};

const Glifo: React.FC<{ tipo: TipoIntervencao; tinta: string }> = ({ tipo, tinta }) => {
  const t = { stroke: tinta, strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (tipo) {
    case 'camera':
      return (
        <g {...t}>
          <rect x="5.5" y="8.4" width="13" height="8.4" rx="1.6" />
          <circle cx="12" cy="12.6" r="2.5" />
          <path d="M9.5 9 10.5 7.2h3L14.5 9" />
        </g>
      );
    case 'semaforo':
      return (
        <g>
          <rect x="8.2" y="4.2" width="7.6" height="15.6" rx="2.2" fill="#1f2937" stroke={tinta} strokeWidth="1.4" />
          <circle cx="12" cy="8" r="1.7" fill="#ef4444" />
          <circle cx="12" cy="12" r="1.7" fill="#facc15" />
          <circle cx="12" cy="16" r="1.7" fill="#22c55e" />
        </g>
      );
    case 'fechar_canteiro':
      return (
        <g {...t}>
          <path d="M4.5 8h15M4.5 16h15" />
          <rect x="7.4" y="10" width="9.2" height="4" rx="0.8" fill={tinta} />
        </g>
      );
    case 'retorno':
      return (
        <g {...t}>
          <path d="M8 19V10a4 4 0 0 1 8 0v4" />
          <path d="m13.2 12.2 2.8 2.8 2.8-2.8" />
        </g>
      );
    case 'tachoes':
      return (
        <g fill={tinta}>
          <path d="M5.5 15a2 2 0 0 1 4 0z" />
          <path d="M10 15a2 2 0 0 1 4 0z" />
          <path d="M14.5 15a2 2 0 0 1 4 0z" />
          <rect x="5" y="15" width="14" height="1.3" rx="0.4" />
        </g>
      );
    case 'faixa_elevada':
      return (
        <g {...t}>
          <path d="M4.5 16.5 7 12h10l2.5 4.5" />
          <path d="M9.4 12v4.5M12 12v4.5M14.6 12v4.5" strokeWidth="1.5" />
        </g>
      );
    case 'refugio':
      return (
        <g {...t}>
          <circle cx="12" cy="7" r="1.6" fill={tinta} stroke="none" />
          <path d="M12 9.2v4.6M12 13.8l-2 3.4M12 13.8l2 3.4M9.6 11.2h4.8" />
          <path d="M6 18.6h12" strokeWidth="2.2" />
        </g>
      );
    case 'lombada':
      return (
        <g {...t}>
          <path d="M4.5 15.5h3.2c1.5 0 2-4 4.3-4s2.8 4 4.3 4h3.2" />
        </g>
      );
    case 'agente':
      return (
        <g {...t}>
          <path d="M8.6 8.4h6.8M9.4 8.4l.6-1.8h4l.6 1.8" />
          <circle cx="12" cy="10.6" r="1.9" />
          <path d="M8 18.5c.4-2.7 2-4.2 4-4.2s3.6 1.5 4 4.2" />
        </g>
      );
  }
};

interface Props {
  tipo: TipoIntervencao;
  tamanho?: number;
  invalida?: boolean;
  selecionada?: boolean;
  titulo?: string;
}

export const IconeIntervencao: React.FC<Props> = ({ tipo, tamanho = 32, invalida, selecionada }) => {
  const cat = DEFINICAO[tipo].categoria;
  const c = COR_CATEGORIA[cat];
  const contorno = invalida ? '#0f172a' : selecionada ? '#22d3ee' : c.traco;
  const larguraContorno = invalida || selecionada ? 2 : 1.2;
  const tracejado = invalida ? '2.2 1.6' : undefined;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      {cat === 'moderacao' && (
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2" transform="rotate(45 12 12)" fill={c.fundo} stroke={contorno} strokeWidth={larguraContorno} strokeDasharray={tracejado} />
      )}
      {cat === 'fiscalizacao' && <circle cx="12" cy="12" r="10.6" fill={c.fundo} stroke={contorno} strokeWidth={larguraContorno} strokeDasharray={tracejado} />}
      {cat === 'controle' && <rect x="3.4" y="1.6" width="17.2" height="20.8" rx="4" fill={c.fundo} stroke={contorno} strokeWidth={larguraContorno} strokeDasharray={tracejado} />}
      {cat === 'geometria' && <rect x="1.8" y="1.8" width="20.4" height="20.4" rx="3" fill={c.fundo} stroke={contorno} strokeWidth={larguraContorno} strokeDasharray={tracejado} />}
      <g transform={cat === 'moderacao' ? 'translate(12 12) scale(0.9) translate(-12 -12)' : undefined}>
        <Glifo tipo={tipo} tinta={c.tinta} />
      </g>
    </svg>
  );
};
