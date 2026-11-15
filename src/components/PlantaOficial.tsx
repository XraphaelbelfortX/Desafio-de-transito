import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Minus, Plus, RotateCw, Trash2, MousePointerClick } from 'lucide-react';
import { CATALOGO, type TipoIntervencao } from '../sim/intervencoes';
import { IconeIntervencao } from './sim/IconeIntervencao';
import { COR_ZONA } from './sim/zonasIntervencao';

// Folha da planta: 3402 × 1684 pt (1200 × 594 mm) na escala 1:500 → 600 × 297 m de terreno.
const LARG_M = 600.1;
const ALT_M = 297.0;
const PROPORCAO = 1684 / 3402;
const ZOOMS = [1600, 2400, 3400];
const CHAVE = 'guardiao-viario:planta:v1';

type Forma = 'area' | 'ponto';

interface Estilo {
  forma: Forma;
  /** tamanho inicial em metros: [ao longo da avenida, atravessando] */
  m: [number, number];
  rotulo: string;
  fundo?: (girado: boolean) => string;
  borda?: string;
  tracejada?: boolean;
}

const ESTILO: Record<TipoIntervencao, Estilo> = {
  fechar_canteiro: {
    forma: 'area',
    m: [20, 3],
    rotulo: 'Canteiro ampliado',
    fundo: () => 'repeating-linear-gradient(45deg,#3f8f5a 0 5px,#2f7447 5px 10px)',
    borda: '#1f5c36',
  },
  tachoes: {
    forma: 'area',
    m: [30, 1.2],
    rotulo: 'Linha de tachões',
    fundo: (g) => `repeating-linear-gradient(${g ? 0 : 90}deg,#facc15 0 6px,transparent 6px 13px)`,
  },
  faixa_elevada: {
    forma: 'area',
    m: [4, 14],
    rotulo: 'Faixa elevada',
    fundo: (g) => `repeating-linear-gradient(${g ? 90 : 0}deg,#ffffff 0 4px,#c2410c 4px 8px)`,
    borda: '#7c2d12',
  },
  lombada: {
    forma: 'area',
    m: [1.5, 7],
    rotulo: 'Lombada',
    fundo: () => 'repeating-linear-gradient(45deg,#facc15 0 4px,#111827 4px 8px)',
  },
  refugio: {
    forma: 'area',
    m: [6, 2.5],
    rotulo: 'Refúgio de pedestre',
    fundo: () => '#9ca3af',
    borda: '#f8fafc',
  },
  retorno: {
    forma: 'area',
    m: [10, 6],
    rotulo: 'Retorno',
    fundo: () => 'rgba(45,212,191,0.28)',
    borda: '#2dd4bf',
    tracejada: true,
  },
  camera: { forma: 'ponto', m: [0, 0], rotulo: 'Câmera' },
  semaforo: { forma: 'ponto', m: [0, 0], rotulo: 'Semáforo' },
  agente: { forma: 'ponto', m: [0, 0], rotulo: 'Agente' },
};

interface Item {
  id: string;
  tipo: TipoIntervencao;
  /** posição e tamanho em % da planta */
  x: number;
  y: number;
  w: number;
  h: number;
  girado: boolean;
}

const wPct = (m: number) => (m / LARG_M) * 100;
const hPct = (m: number) => (m / ALT_M) * 100;
const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const medidas = (i: Item) => {
  const w = (i.w / 100) * LARG_M;
  const h = (i.h / 100) * ALT_M;
  return { w, h, area: w * h };
};

const lerSalvo = (): Item[] => {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Item[]) : [];
  } catch {
    return [];
  }
};

interface Props {
  /** intervenções colocadas na aba Simular (só para contar) */
  nSimulacao: number;
}

/**
 * Planta oficial de sinalização da SMTT com uma camada de desenho por cima:
 * escolha a intervenção, clique na planta e ela aparece desenhada, em escala,
 * para arrastar, redimensionar e girar.
 */
export const PlantaOficial: React.FC<Props> = ({ nSimulacao }) => {
  const [itens, setItens] = useState<Item[]>(lerSalvo);
  const [armado, setArmado] = useState<TipoIntervencao | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const plantaRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ id: string; modo: 'mover' | 'redim'; x0: number; y0: number; item: Item } | null>(null);
  const centroAntes = useRef<{ cx: number; cy: number } | null>(null);
  const larguraPx = ZOOMS[zoom];

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(itens));
    } catch {
      /* sem armazenamento: segue só na memória */
    }
  }, [itens]);

  // Abre já enquadrando o cruzamento (a planta tem a legenda e o carimbo à direita).
  useLayoutEffect(() => {
    const r = rolagemRef.current;
    if (!r) return;
    const altura = larguraPx * PROPORCAO;
    if (centroAntes.current) {
      r.scrollLeft = centroAntes.current.cx * larguraPx - r.clientWidth / 2;
      r.scrollTop = centroAntes.current.cy * altura - r.clientHeight / 2;
    } else {
      r.scrollLeft = 0.2 * larguraPx - r.clientWidth / 2;
      r.scrollTop = 0.47 * altura - r.clientHeight / 2;
    }
  }, [larguraPx]);

  const mudarZoom = (d: number) => {
    const r = rolagemRef.current;
    if (r) {
      const altura = larguraPx * PROPORCAO;
      centroAntes.current = {
        cx: (r.scrollLeft + r.clientWidth / 2) / larguraPx,
        cy: (r.scrollTop + r.clientHeight / 2) / altura,
      };
    }
    setZoom((z) => Math.min(ZOOMS.length - 1, Math.max(0, z + d)));
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmado(null);
        setSel(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !(e.target instanceof HTMLInputElement)) {
        setItens((l) => l.filter((i) => i.id !== sel));
        setSel(null);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [sel]);

  const pontoNaPlanta = (clientX: number, clientY: number) => {
    const r = plantaRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };

  const cliqueNaPlanta = (e: React.MouseEvent) => {
    if (!armado) {
      setSel(null);
      return;
    }
    const p = pontoNaPlanta(e.clientX, e.clientY);
    const est = ESTILO[armado];
    const w = est.forma === 'area' ? wPct(est.m[0]) : 0;
    const h = est.forma === 'area' ? hPct(est.m[1]) : 0;
    const novo: Item = { id: `${armado}-${Date.now()}`, tipo: armado, x: p.x - w / 2, y: p.y - h / 2, w, h, girado: false };
    setItens((l) => [...l, novo]);
    setSel(novo.id);
    setArmado(null);
  };

  const iniciarArrasto = (e: React.PointerEvent, item: Item, modo: 'mover' | 'redim') => {
    if (armado) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { id: item.id, modo, x0: e.clientX, y0: e.clientY, item };
    setSel(item.id);
  };

  const moverArrasto = (e: React.PointerEvent) => {
    const a = arrasto.current;
    if (!a || !plantaRef.current) return;
    const r = plantaRef.current.getBoundingClientRect();
    const dx = ((e.clientX - a.x0) / r.width) * 100;
    const dy = ((e.clientY - a.y0) / r.height) * 100;
    setItens((l) =>
      l.map((i) => {
        if (i.id !== a.id) return i;
        if (a.modo === 'mover') return { ...i, x: a.item.x + dx, y: a.item.y + dy };
        return { ...i, w: Math.max(wPct(0.8), a.item.w + dx), h: Math.max(hPct(0.8), a.item.h + dy) };
      }),
    );
  };

  const fimArrasto = () => {
    arrasto.current = null;
  };

  const girar = (id: string) =>
    setItens((l) =>
      l.map((i) => {
        if (i.id !== id) return i;
        // troca os lados em metros, mantendo o centro no mesmo lugar
        const wm = (i.w / 100) * LARG_M;
        const hm = (i.h / 100) * ALT_M;
        const w = wPct(hm);
        const h = hPct(wm);
        return { ...i, w, h, x: i.x + i.w / 2 - w / 2, y: i.y + i.h / 2 - h / 2, girado: !i.girado };
      }),
    );

  const remover = (id: string) => {
    setItens((l) => l.filter((i) => i.id !== id));
    setSel(null);
  };

  const areas = CATALOGO.filter((d) => ESTILO[d.tipo].forma === 'area');
  const pontos = CATALOGO.filter((d) => ESTILO[d.tipo].forma === 'ponto');

  const botaoPaleta = (tipo: TipoIntervencao) => {
    const ativo = armado === tipo;
    return (
      <button
        key={tipo}
        type="button"
        onClick={() => {
          setArmado(ativo ? null : tipo);
          setSel(null);
        }}
        aria-pressed={ativo}
        className={`flex items-center gap-2 w-full text-left rounded-lg border px-2 py-1.5 transition ${
          ativo ? 'border-gv-cyan bg-gv-cyan/15' : 'border-gv-border bg-gv-card hover:border-gv-cyan/40'
        }`}
      >
        <IconeIntervencao tipo={tipo} tamanho={20} />
        <span className="text-[11px] font-semibold text-gv-ink leading-tight">{ESTILO[tipo].rotulo}</span>
      </button>
    );
  };

  return (
    <div className="w-full h-[min(560px,calc(100vh-280px))] min-h-[360px] bg-gv-bg flex">
      {/* Barra lateral: o que desenhar e o que já está desenhado */}
      <aside className="w-[210px] shrink-0 bg-gv-panel border-r border-gv-border p-3 overflow-y-auto flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gv-muted mb-1.5">1. Escolha</p>
          <div className="flex flex-col gap-1">{areas.map((d) => botaoPaleta(d.tipo))}</div>
          <div className="flex flex-col gap-1 mt-1">{pontos.map((d) => botaoPaleta(d.tipo))}</div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gv-muted mb-1.5">2. Na planta ({itens.length})</p>
          {itens.length === 0 ? (
            <p className="text-[11px] text-gv-muted">Nada desenhado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {itens.map((i) => {
                const m = medidas(i);
                const est = ESTILO[i.tipo];
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setSel(i.id)}
                      className={`w-full text-left rounded-lg border px-2 py-1.5 ${
                        sel === i.id ? 'border-gv-cyan bg-gv-cyan/10' : 'border-gv-border bg-gv-card hover:border-gv-cyan/40'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gv-ink">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COR_ZONA[i.tipo] }} />
                        {est.rotulo}
                      </span>
                      {est.forma === 'area' && (
                        <span className="block text-[10px] text-gv-muted tabular-nums mt-0.5">
                          {fmt(m.w)} × {fmt(m.h)} m · ≈ {fmt(m.area)} m²
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {itens.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setItens([]);
                setSel(null);
              }}
              className="mt-2 text-[11px] font-semibold text-gv-muted hover:text-gv-red"
            >
              Apagar tudo
            </button>
          )}
        </div>

        <p className="text-[10px] text-gv-muted mt-auto">
          Medidas pela escala da planta (1:500), aproximadas. Na simulação agora: {nSimulacao}{' '}
          {nSimulacao === 1 ? 'intervenção' : 'intervenções'} (aba Simular).
        </p>
      </aside>

      {/* Planta com a camada de desenho */}
      <div className="relative flex-1 min-w-0">
        <div ref={rolagemRef} className="absolute inset-0 overflow-auto bg-white">
          <div
            ref={plantaRef}
            className={`relative select-none ${armado ? 'cursor-crosshair' : ''}`}
            style={{ width: larguraPx, height: larguraPx * PROPORCAO }}
            onClick={cliqueNaPlanta}
          >
            <img
              src="/img/planta-oficial-smtt.png"
              alt="Planta oficial de sinalização da SMTT para o cruzamento Av. dos Africanos × Av. Vicente Venâncio (projeto 01/01, escala 1:500)"
              className="absolute inset-0 w-full h-full"
              draggable={false}
            />

            {itens.map((i) => {
              const est = ESTILO[i.tipo];
              const selecionado = sel === i.id;
              const m = medidas(i);

              if (est.forma === 'ponto') {
                return (
                  <div
                    key={i.id}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1 bg-white shadow-md touch-none ${
                      selecionado ? 'ring-2 ring-gv-cyan' : 'ring-1 ring-black/30'
                    } ${armado ? '' : 'cursor-move'}`}
                    style={{ left: `${i.x}%`, top: `${i.y}%` }}
                    onPointerDown={(e) => iniciarArrasto(e, i, 'mover')}
                    onPointerMove={moverArrasto}
                    onPointerUp={fimArrasto}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconeIntervencao tipo={i.tipo} tamanho={26} />
                    {selecionado && (
                      <div className="absolute left-1/2 -translate-x-1/2 -top-8 flex items-center gap-1 whitespace-nowrap bg-gv-bg text-white text-[11px] font-semibold rounded-md px-1.5 py-1 shadow">
                        {est.rotulo}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => remover(i.id)}
                          aria-label={`Apagar ${est.rotulo}`}
                          className="p-0.5 rounded hover:bg-white/15"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={i.id}
                  className={`absolute touch-none ${armado ? '' : 'cursor-move'}`}
                  style={{
                    left: `${i.x}%`,
                    top: `${i.y}%`,
                    width: `${i.w}%`,
                    height: `${i.h}%`,
                    minWidth: 6,
                    minHeight: 6,
                    background: est.fundo?.(i.girado),
                    border: est.borda ? `2px ${est.tracejada ? 'dashed' : 'solid'} ${est.borda}` : undefined,
                    outline: selecionado ? '2px solid #22d3ee' : undefined,
                    outlineOffset: 2,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                  }}
                  onPointerDown={(e) => iniciarArrasto(e, i, 'mover')}
                  onPointerMove={moverArrasto}
                  onPointerUp={fimArrasto}
                  onClick={(e) => e.stopPropagation()}
                  title={`${est.rotulo} · ${fmt(m.w)} × ${fmt(m.h)} m`}
                >
                  {selecionado && (
                    <>
                      <div className="absolute left-0 -top-8 flex items-center gap-1 whitespace-nowrap bg-gv-bg text-white text-[11px] font-semibold rounded-md px-1.5 py-1 shadow">
                        {est.rotulo} · {fmt(m.w)} × {fmt(m.h)} m
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => girar(i.id)}
                          aria-label={`Girar ${est.rotulo}`}
                          title="Girar 90°"
                          className="p-0.5 rounded hover:bg-white/15"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => remover(i.id)}
                          aria-label={`Apagar ${est.rotulo}`}
                          title="Apagar (Delete)"
                          className="p-0.5 rounded hover:bg-white/15"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div
                        className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-gv-cyan border border-white rounded-sm cursor-nwse-resize"
                        onPointerDown={(e) => iniciarArrasto(e, i, 'redim')}
                        onPointerMove={moverArrasto}
                        onPointerUp={fimArrasto}
                        title="Arraste para aumentar ou diminuir"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dica e controles flutuantes */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
          <div
            className={`pointer-events-auto flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow ${
              armado ? 'bg-gv-cyan text-gv-cyanink' : 'bg-gv-bg/90 text-gv-ink border border-gv-border'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            {armado
              ? `Clique na planta onde vai ${ESTILO[armado].rotulo.toLowerCase()} (Esc cancela)`
              : 'Escolha uma intervenção à esquerda · arraste para mover · puxe o canto para aumentar'}
          </div>
          <div className="pointer-events-auto flex items-center gap-1">
            <div className="flex items-center bg-gv-bg/90 border border-gv-border rounded-lg overflow-hidden">
              <button type="button" onClick={() => mudarZoom(-1)} disabled={zoom === 0} aria-label="Afastar" className="p-1.5 text-gv-ink hover:bg-white/10 disabled:opacity-40">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => mudarZoom(1)} disabled={zoom === ZOOMS.length - 1} aria-label="Aproximar" className="p-1.5 text-gv-ink hover:bg-white/10 disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <a
              href="/img/planta-oficial-smtt.png"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 bg-gv-bg/90 border border-gv-border text-gv-ink text-[11px] font-semibold px-2 py-1.5 rounded-lg hover:border-gv-cyan/40"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Original
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
