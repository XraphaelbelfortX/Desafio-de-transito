import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Tela } from '../components/shell/NavRail';

type TipoDeteccao = 'carro' | 'pesado' | 'moto' | 'pedestre';

const COR: Record<TipoDeteccao, string> = {
  carro: '#22d3ee',
  pesado: '#a78bfa',
  moto: '#fb923c',
  pedestre: '#4ade80',
};

interface Deteccao {
  id: number;
  tipo: TipoDeteccao;
  pct: number;
  risco?: boolean;
  /** posição em % do quadro real da câmera (foto do próprio cruzamento) */
  x: number;
  y: number;
  w: number;
  h: number;
}

// Coordenadas calibradas na foto real do cruzamento (Google Street View, Av. dos Africanos
// com Av. Vicente Venâncio) — a mesma cena que aparece na aba Mapa.
const DETECCOES: Deteccao[] = [
  { id: 101, tipo: 'carro', pct: 83, x: 28.7, y: 33.7, w: 9.2, h: 9.9 },
  { id: 102, tipo: 'pesado', pct: 74, x: 0, y: 36.2, w: 5.1, h: 16.2 },
  { id: 103, tipo: 'carro', pct: 91, risco: true, x: 42.7, y: 35.5, w: 8.3, h: 20.4 },
  { id: 104, tipo: 'moto', pct: 88, risco: true, x: 62.5, y: 41.1, w: 13.4, h: 27.2 },
  { id: 105, tipo: 'moto', pct: 85, risco: true, x: 78.9, y: 46.1, w: 12.1, h: 28.5 },
  { id: 106, tipo: 'pedestre', pct: 41, x: 77.1, y: 27.0, w: 1.7, h: 12.9 },
  { id: 107, tipo: 'moto', pct: 62, x: 95.6, y: 67.2, w: 4.4, h: 21.4 },
];

const CONTADORES: { rotulo: string; tipo: TipoDeteccao; valor: number }[] = [
  { rotulo: 'Carros', tipo: 'carro', valor: DETECCOES.filter((d) => d.tipo === 'carro').length },
  { rotulo: 'Pesados', tipo: 'pesado', valor: DETECCOES.filter((d) => d.tipo === 'pesado').length },
  { rotulo: 'Motos', tipo: 'moto', valor: DETECCOES.filter((d) => d.tipo === 'moto').length },
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
          <div className="relative w-full flex-1 min-h-[360px] rounded-xl overflow-hidden border border-gv-border bg-black" style={{ aspectRatio: '1872 / 677' }}>
            <img src="/img/cam01-real.png" alt="Foto real do cruzamento (Google Street View), usada aqui como quadro da câmera CAM-01" className="absolute inset-0 w-full h-full object-cover" />

            {/* Zona de conflito: onde o carro #103 cruza a frente das motos #104/#105 */}
            <div
              className="absolute rounded-lg border-2 border-dashed border-gv-red/70"
              style={{ left: '40%', top: '34%', width: '53%', height: '43%' }}
            />

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

            <div className="absolute left-3 bottom-3 max-w-[280px] bg-gv-red/95 text-white rounded-lg px-3 py-2.5 flex flex-col gap-1">
              <p className="text-xs font-extrabold">⚠ RISCO ALTO · CARRO × MOTO</p>
              <p className="text-[11px]">Carro #103 cruza a frente das motos #104 e #105</p>
              <p className="text-[11px]">TTC estimado 1,6 s · conversão sem dar preferência</p>
            </div>

            <div className="absolute flex gap-3 bg-black/60 text-white text-[11px] px-2.5 py-1.5 rounded-lg" style={{ left: '2%', top: '2%' }}>
              <span className="font-semibold">CAM-01 · poste 6 m · 1080p</span>
              <span className="text-gv-ink/80 hidden sm:inline">YOLO + ByteTrack · homografia calibrada</span>
            </div>

            <div className="absolute bg-black/60 text-gv-ink text-[11px] px-2.5 py-1.5 rounded-lg" style={{ right: '2%', bottom: '2%' }}>
              Máscara LGPD: placas borradas na borda
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
