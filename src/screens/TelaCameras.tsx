import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Tela } from '../components/shell/NavRail';

type TipoDeteccao = 'carro' | 'pesado' | 'ciclista' | 'pedestre';

const COR: Record<TipoDeteccao, string> = {
  carro: '#22d3ee',
  pesado: '#a78bfa',
  ciclista: '#facc15',
  pedestre: '#4ade80',
};

interface Deteccao {
  id: number;
  tipo: TipoDeteccao;
  pct: number;
  risco?: boolean;
  /** posição em % do quadro (1088×612) */
  x: number;
  y: number;
  w: number;
  h: number;
}

// Coordenadas extraídas 1:1 do protótipo Figma (quadro de 1088×612), convertidas para %.
const DETECCOES: Deteccao[] = [
  { id: 103, tipo: 'carro', pct: 48, x: 46.93, y: 6.57, w: 1.35, h: 4.07 },
  { id: 102, tipo: 'pesado', pct: 62, x: 47.55, y: 4.44, w: 3.28, h: 12.41 },
  { id: 104, tipo: 'pesado', pct: 69, x: 42.71, y: 13.43, w: 3.49, h: 6.94 },
  { id: 105, tipo: 'carro', pct: 63, x: 46.67, y: 17.78, w: 1.82, h: 4.81 },
  { id: 106, tipo: 'carro', pct: 63, x: 51.25, y: 18.7, w: 2.03, h: 4.07 },
  { id: 107, tipo: 'carro', pct: 80, x: 11.25, y: 22.13, w: 3.44, h: 3.06 },
  { id: 108, tipo: 'ciclista', pct: 25, risco: true, x: 24.9, y: 28.52, w: 1.04, h: 2.69 },
  { id: 109, tipo: 'carro', pct: 82, x: 32.55, y: 29.44, w: 3.8, h: 3.7 },
  { id: 110, tipo: 'carro', pct: 87, x: 22.71, y: 36.39, w: 4.06, h: 4.54 },
  { id: 111, tipo: 'pesado', pct: 87, risco: true, x: 27.24, y: 38.61, w: 9.43, h: 14.81 },
  { id: 112, tipo: 'carro', pct: 83, x: 21.51, y: 39.72, w: 4.17, h: 5.18 },
  { id: 113, tipo: 'pedestre', pct: 27, x: 48.49, y: 54.35, w: 0.74, h: 2.04 },
  { id: 114, tipo: 'ciclista', pct: 48, x: 62.24, y: 57.31, w: 2.24, h: 4.35 },
  { id: 115, tipo: 'carro', pct: 69, x: 41.2, y: 73.33, w: 5.16, h: 11.02 },
  { id: 116, tipo: 'ciclista', pct: 33, x: 7.03, y: 81.11, w: 2.6, h: 4.81 },
  { id: 117, tipo: 'carro', pct: 86, x: 45.0, y: 82.59, w: 4.84, h: 10.74 },
  { id: 118, tipo: 'carro', pct: 51, x: 37.97, y: 89.07, w: 4.06, h: 6.02 },
];

const CONTADORES: { rotulo: string; tipo: TipoDeteccao; valor: number }[] = [
  { rotulo: 'Carros', tipo: 'carro', valor: DETECCOES.filter((d) => d.tipo === 'carro').length },
  { rotulo: 'Pesados', tipo: 'pesado', valor: DETECCOES.filter((d) => d.tipo === 'pesado').length },
  { rotulo: 'Ciclistas', tipo: 'ciclista', valor: DETECCOES.filter((d) => d.tipo === 'ciclista').length },
  { rotulo: 'Pedestres', tipo: 'pedestre', valor: DETECCOES.filter((d) => d.tipo === 'pedestre').length },
];

const EVENTOS_HORA = [
  { titulo: 'Quase-acidente carro × ciclista', n: 2, cor: '#ef4444' },
  { titulo: 'Veículo sobre travessia ciclável', n: 5, cor: '#fb923c' },
  { titulo: 'Conversão sem dar preferência', n: 3, cor: '#fb923c' },
  { titulo: 'Velocidade acima de 60 km/h', n: 7, cor: '#facc15' },
  { titulo: 'Avanço de sinal vermelho', n: 1, cor: '#ef4444' },
];

const PADROES = [
  'TTC < 2 s entre trajetórias (carro×carro, carro×ciclista)',
  'PET < 1,5 s na zona de conflito',
  'Frenagem brusca (desaceleração > 4 m/s²)',
  'Veículo parado em ciclofaixa ou travessia',
  'Desvio brusco de ciclista ou pedestre',
  'Velocidade acima do limite da via',
];

// Barras da linha do tempo: decorativas (ritmo do dia), não um log exato de eventos.
const LINHA_TEMPO = [6, 12, 29, 31, 36, 34, 30, 55, 58, 76, 86, 59, 36, 30, 27, 24, 22, 36, 55].map((h, i) => ({
  h,
  cor: h > 70 ? '#ef4444' : h > 45 ? '#fb923c' : '#facc15',
  x: 4 + i * 5.1,
}));

interface Props {
  onNavegar: (t: Tela) => void;
}

/** Tela "Câmeras" (Sensor CAM-01 do Figma): mock ilustrativo de visão computacional — sem feed real. */
export const TelaCameras: React.FC<Props> = ({ onNavegar }) => (
  <div className="flex flex-col h-full min-h-0">
    <header className="shrink-0 px-5 py-3 flex flex-wrap items-center gap-3 border-b border-gv-border">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-gv-cyan" />
        <h1 className="text-lg font-bold text-gv-ink leading-tight">Guardião Viário</h1>
      </div>
      <p className="text-sm text-gv-muted">Sensores / CAM-01 · Av. dos Africanos × Av. Vicente Venâncio</p>
      <span className="ml-auto flex items-center gap-2 bg-gv-red/15 text-gv-red text-xs font-semibold px-3 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-gv-red animate-pulse" />
        AO VIVO · 15 FPS · inferência na borda
      </span>
    </header>

    <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col gap-3 p-3">
      <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="relative w-full flex-1 min-h-[360px] rounded-xl overflow-hidden border border-gv-border bg-black" style={{ aspectRatio: '1088 / 612' }}>
            <img src="/img/cam01-frame.png" alt="Quadro ilustrativo da câmera CAM-01 (a substituir por stream RTSP/HLS real)" className="absolute inset-0 w-full h-full object-cover" />
            <img src="/img/cam01-roi.svg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full" />
            <img src="/img/cam01-vetor-conflito.svg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full" />

            {DETECCOES.map((d) => (
              <div
                key={d.id}
                className="absolute rounded-sm"
                style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, border: `2px solid ${COR[d.tipo]}` }}
              >
                <span
                  className="absolute -top-[15px] -left-[3px] text-[9px] font-bold px-1 whitespace-nowrap text-gv-bg"
                  style={{ background: COR[d.tipo] }}
                >
                  #{d.id} {d.tipo} {d.pct}%
                </span>
              </div>
            ))}

            <div className="absolute px-2 py-1 rounded bg-black/65 text-gv-red text-[11px] font-semibold" style={{ left: '20.8%', top: '54.6%' }}>
              Z-03 · travessia ciclável
            </div>

            <div className="absolute left-3 top-[76%] max-w-[260px] bg-gv-red/95 text-white rounded-lg px-3 py-2.5 flex flex-col gap-1">
              <p className="text-xs font-extrabold">⚠ RISCO ALTO · CARRO × CICLISTA</p>
              <p className="text-[11px]">Veículo pesado #111 sobre a travessia ciclável</p>
              <p className="text-[11px]">Ciclista #108 a ~9 m · TTC estimado 1,8 s</p>
            </div>

            <div className="absolute flex gap-3 bg-black/60 text-white text-[11px] px-2.5 py-1.5 rounded-lg" style={{ left: '62.5%', top: '2%' }}>
              <span className="font-semibold">CAM-01 · poste 6 m · 1080p</span>
              <span className="text-gv-ink/80">YOLO + ByteTrack · homografia calibrada</span>
            </div>

            <div className="absolute bg-black/60 text-gv-ink text-[11px] px-2.5 py-1.5 rounded-lg" style={{ left: '71.5%', top: '93.5%' }}>
              Máscara LGPD: fachadas e placas borradas na borda
            </div>
          </div>

          <div className="shrink-0 bg-gv-panel border border-gv-border rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gv-ink">Eventos nas últimas 24h</h2>
                <p className="text-[11px] text-gv-muted">Clique num marcador para rever o clipe de 10 s do evento</p>
              </div>
              <div className="flex gap-4 text-[11px] text-gv-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gv-amber" />Velocidade</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gv-orange" />Invasão de faixa</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gv-red" />Quase-acidente</span>
              </div>
            </div>
            <div className="relative h-14">
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gv-border" />
              {LINHA_TEMPO.map((b, i) => (
                <div key={i} className="absolute bottom-0 w-1.5 rounded-sm" style={{ left: `${b.x}%`, height: `${b.h}%`, background: b.cor }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gv-muted mt-1">
              <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span>
            </div>
          </div>
        </div>

        <aside className="w-full xl:w-[300px] shrink-0 bg-gv-panel border border-gv-border rounded-xl p-4 flex flex-col gap-4 xl:min-h-0 max-h-[70vh] xl:max-h-none overflow-y-auto">
          <section>
            <h3 className="text-[11px] font-bold text-gv-muted mb-2">DETECÇÕES AGORA</h3>
            <div className="grid grid-cols-2 gap-2">
              {CONTADORES.map((c) => (
                <div key={c.rotulo} className="rounded-lg px-2.5 py-2 border" style={{ borderColor: `${COR[c.tipo]}80`, background: '#162036' }}>
                  <p className="text-xl font-bold" style={{ color: COR[c.tipo] }}>{c.valor}</p>
                  <p className="text-[11px] text-gv-muted">{c.rotulo}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-gv-muted mb-2">EVENTOS · ÚLTIMA HORA</h3>
            <ul className="flex flex-col gap-1.5">
              {EVENTOS_HORA.map((e) => (
                <li key={e.titulo} className="flex items-center gap-2 py-1">
                  <span className="w-1 h-4 rounded-sm shrink-0" style={{ background: e.cor }} />
                  <span className="flex-1 min-w-0 text-xs text-gv-ink">{e.titulo}</span>
                  <span className="text-sm font-bold" style={{ color: e.cor }}>{e.n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-gv-muted mb-2">PADRÕES QUE O MODELO RECONHECE</h3>
            <ol className="flex flex-col gap-1.5">
              {PADROES.map((p, i) => (
                <li key={p} className="flex gap-2 text-xs">
                  <span className="text-gv-cyan font-bold shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-gv-ink">{p}</span>
                </li>
              ))}
            </ol>
          </section>

          <button type="button" onClick={() => onNavegar('mapa')} className="mt-auto w-full py-3 rounded-lg bg-gv-cyan text-gv-cyanink text-sm font-bold hover:brightness-110">
            Ver no Mapa de Alerta →
          </button>
        </aside>
      </div>
    </div>
  </div>
);
