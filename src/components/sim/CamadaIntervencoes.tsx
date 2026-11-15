import React, { useEffect, useMemo, useState } from 'react';
import { Layer, Marker, Popup, Source } from 'react-map-gl';
import { paraGeo, paraLocal, type Vec2 } from '../../sim/geometria';
import type { Rede } from '../../sim/rede';
import { analisar, DEFINICAO, type AnaliseIntervencao, type Intervencao, type TipoIntervencao } from '../../sim/intervencoes';
import type { Simulacao } from '../../sim/useSimulacao';
import { IconeIntervencao } from './IconeIntervencao';
import { PALETA } from './paleta';
import { ROTULO_CURTO, tintaSobre } from './zonasIntervencao';

/**
 * Intervenções no mapa: a mancha colorida é onde cada uma age; o ícone é só a alça para arrastar.
 * Fica dentro do <Map> do TacticalMap.
 */

const retangulo = (rede: Rede, x0: number, x1: number, y0: number, y1: number) => [
  [
    paraGeo(rede.quadro, { x: x0, y: y0 }),
    paraGeo(rede.quadro, { x: x1, y: y0 }),
    paraGeo(rede.quadro, { x: x1, y: y1 }),
    paraGeo(rede.quadro, { x: x0, y: y1 }),
    paraGeo(rede.quadro, { x: x0, y: y0 }),
  ],
];

const circulo = (rede: Rede, c: Vec2, r: number) => {
  const anel: [number, number][] = [];
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    anel.push(paraGeo(rede.quadro, { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }));
  }
  return [anel];
};

/** Centro da mancha: é para onde o mapa vai e onde o rótulo senta. */
export function centroDaZona(rede: Rede, tipo: TipoIntervencao, a: AnaliseIntervencao): Vec2 {
  if (!a.valida) return a.p;
  const { x } = a.p;
  switch (tipo) {
    case 'semaforo': {
      const c = rede.cruzamentos.find((k) => k.id === a.cruzamento);
      return c ? { x: c.x, y: 0 } : a.p;
    }
    case 'fechar_canteiro':
    case 'retorno': {
      if (!a.alvo) return tipo === 'retorno' ? { x, y: 0 } : a.p;
      const ab = rede.aberturas.find((k) => k.id === a.alvo);
      return ab ? { x: ab.xc, y: 0 } : a.p;
    }
    case 'faixa_elevada':
    case 'refugio':
      return { x, y: 0 };
    case 'lombada': {
      const s = a.lado === 'oeste' ? 1 : -1;
      return { x, y: (s * (rede.meioCanteiro + rede.borda)) / 2 };
    }
    default:
      return a.p;
  }
}

interface RotuloZona {
  id: string;
  n: number;
  lng: number;
  lat: number;
  nome: string;
  cor: string;
  tinta: string;
  valida: boolean;
  efeito: string;
  afastada: boolean;
  slot: number;
}

interface CenaZonas {
  areas: { type: 'FeatureCollection'; features: unknown[] };
  solidos: { type: 'FeatureCollection'; features: unknown[] };
  ligacoes: { type: 'FeatureCollection'; features: unknown[] };
  rotulos: RotuloZona[];
}

/** Desenho no chão de cada intervenção, no lugar em que ela tem efeito. */
function cena(rede: Rede, ints: Intervencao[], analises: Map<string, AnaliseIntervencao>, selecionada: string | null, previa = false): CenaZonas {
  const areas: unknown[] = [];
  const solidos: unknown[] = [];
  const ligacoes: unknown[] = [];
  const rotulos: RotuloZona[] = [];
  const ocupacao = new Map<string, number>();
  const alguma = selecionada !== null;
  const poli = (coords: unknown, props: Record<string, unknown>) => ({
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: coords },
  });
  const linha = (de: [number, number], ate: [number, number]) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [de, ate] },
  });

  ints.forEach((i, indice) => {
    const a = analises.get(i.id);
    if (!a) return;
    const sel = i.id === selecionada;
    const cor = PALETA.intervencao;
    const opac = previa ? 0.4 : !a.valida ? 0.22 : sel ? 0.42 : alguma ? 0.16 : 0.3;
    const marca = {
      id: i.id,
      zid: previa ? '' : i.id,
      cor,
      borda: sel ? PALETA.selecionado : PALETA.intervencao,
      opac,
      sel: sel ? 1 : 0,
    };
    const { x, y } = a.p;
    const centro = centroDaZona(rede, i.tipo, a);
    let coords: number[][][] | null = null;
    let alt = 0;

    if (!a.valida) {
      coords = circulo(rede, centro, 14);
    } else {
      switch (i.tipo) {
        case 'camera':
          coords = circulo(rede, centro, DEFINICAO.camera.raio);
          break;
        case 'agente':
          coords = circulo(rede, centro, DEFINICAO.agente.raio);
          break;
        case 'semaforo':
          coords = circulo(rede, centro, 22);
          break;
        case 'fechar_canteiro': {
          const ab = rede.aberturas.find((k) => k.id === a.alvo);
          if (!ab) break;
          coords = retangulo(rede, ab.x0, ab.x1, -rede.meioCanteiro, rede.meioCanteiro);
          alt = 0.35;
          break;
        }
        case 'retorno':
          if (a.regulariza) {
            const ab = rede.aberturas.find((k) => k.id === a.alvo);
            if (!ab) break;
            coords = retangulo(rede, ab.x0, ab.x1, -rede.meioCanteiro, rede.meioCanteiro);
          } else {
            coords = retangulo(rede, x - 10, x + 10, -rede.meioCanteiro, rede.meioCanteiro);
            alt = 0.08;
          }
          break;
        case 'tachoes':
          coords = retangulo(rede, x - 8, x + 8, y - 0.85, y + 0.85);
          for (let k = -4.5; k <= 4.5; k++) {
            const cx = x + k * 1.6;
            solidos.push(poli(retangulo(rede, cx - 0.22, cx + 0.22, y - 0.18, y + 0.18), { ...marca, alt: 0.35 }));
          }
          break;
        case 'faixa_elevada':
          coords = retangulo(rede, x - 2.5, x + 2.5, -rede.borda, rede.borda);
          alt = 0.15;
          break;
        case 'refugio':
          coords = retangulo(rede, x - 2, x + 2, -rede.meioCanteiro, rede.meioCanteiro);
          alt = 0.22;
          break;
        case 'lombada': {
          const s = a.lado === 'oeste' ? 1 : -1;
          coords = retangulo(rede, x - 1.85, x + 1.85, s * rede.meioCanteiro, s * rede.borda);
          alt = 0.12;
          break;
        }
      }
    }

    if (!coords) return;
    areas.push(poli(coords, marca));
    if (alt > 0) solidos.push(poli(coords, { ...marca, alt }));

    const [lng, lat] = paraGeo(rede.quadro, centro);
    const drop = paraLocal(rede.quadro, i.lng, i.lat);
    const afastada = Math.hypot(drop.x - centro.x, drop.y - centro.y) > 8;
    if (afastada) ligacoes.push(linha([i.lng, i.lat], [lng, lat]));

    const chave = `${lng.toFixed(5)}:${lat.toFixed(5)}`;
    const slot = ocupacao.get(chave) ?? 0;
    ocupacao.set(chave, slot + 1);
    if (!previa) rotulos.push({
      id: i.id,
      n: indice + 1,
      lng,
      lat,
      nome: a.valida ? ROTULO_CURTO[i.tipo] : 'Sem efeito',
      cor,
      tinta: a.valida ? tintaSobre(i.tipo) : '#ffffff',
      valida: a.valida,
      efeito: a.efeito,
      afastada,
      slot,
    });
  });

  const colecao = (features: unknown[]) => ({ type: 'FeatureCollection' as const, features });
  return { areas: colecao(areas), solidos: colecao(solidos), ligacoes: colecao(ligacoes), rotulos };
}

interface Previa {
  tipo: TipoIntervencao;
  lng: number;
  lat: number;
  origem: 'painel' | 'icone';
}

const ouvintesPrevia = new Set<(p: Previa | null) => void>();
let previaAtual: Previa | null = null;

/** A prévia não passa pelo estado do mapa, para o arraste do ícone não saltar. */
export function definirPrevia(p: Previa | null) {
  previaAtual = p;
  ouvintesPrevia.forEach((fn) => fn(p));
}

function usePrevia() {
  const [p, setP] = useState<Previa | null>(previaAtual);
  useEffect(() => {
    const fn = (v: Previa | null) => setP(v);
    ouvintesPrevia.add(fn);
    return () => {
      ouvintesPrevia.delete(fn);
    };
  }, []);
  return p;
}

const PreviaArraste: React.FC<{ rede: Rede }> = ({ rede }) => {
  const previa = usePrevia();
  const geo = useMemo(() => {
    if (!previa) return null;
    const local = paraLocal(rede.quadro, previa.lng, previa.lat);
    const a = analisar(rede, { id: 'previa', tipo: previa.tipo, p: local });
    return cena(rede, [{ id: 'previa', tipo: previa.tipo, lng: previa.lng, lat: previa.lat }], new Map([['previa', a]]), null, true);
  }, [rede, previa]);
  if (!previa || !geo) return null;
  return (
    <>
      <Source id="sim-int-previa" type="geojson" data={geo.areas as never}>
        <Layer id="sim-int-previa-fill" type="fill" paint={{ 'fill-color': PALETA.intervencao, 'fill-opacity': 0.38 }} />
        <Layer
          id="sim-int-previa-borda"
          type="line"
          paint={{ 'line-color': PALETA.intervencao, 'line-width': 2, 'line-dasharray': [1.2, 0.8], 'line-opacity': 0.95 }}
        />
      </Source>
      <Source id="sim-int-previa-lig" type="geojson" data={geo.ligacoes as never}>
        <Layer
          id="sim-int-previa-lig"
          type="line"
          paint={{ 'line-color': '#f8fafc', 'line-width': 2, 'line-dasharray': [1.2, 1], 'line-opacity': 0.9 }}
        />
      </Source>
      {previa.origem === 'painel' && (
        <Marker longitude={previa.lng} latitude={previa.lat} anchor="center" style={{ zIndex: 6 }}>
          <div className="pointer-events-none" style={{ filter: 'drop-shadow(0 8px 5px rgba(0,0,0,0.55))' }}>
            <IconeIntervencao tipo={previa.tipo} tamanho={36} />
          </div>
        </Marker>
      )}
    </>
  );
};

export const CamadaIntervencoes: React.FC<{ sim: Simulacao }> = ({ sim }) => {
  const { rede, intervencoes, analises, intervencaoSelecionada } = sim;
  const geo = useMemo(
    () => (rede ? cena(rede, intervencoes, analises, intervencaoSelecionada) : null),
    [rede, intervencoes, analises, intervencaoSelecionada]
  );
  if (!rede || !geo) return null;

  const selecionada = geo.rotulos.find((r) => r.id === intervencaoSelecionada) ?? null;
  const tipoSelecionado = intervencoes.find((i) => i.id === intervencaoSelecionada)?.tipo;

  return (
    <>
      <Source id="sim-int-areas" type="geojson" data={geo.areas as never}>
        <Layer id="sim-int-areas-fill" type="fill" paint={{ 'fill-color': ['get', 'cor'], 'fill-opacity': ['get', 'opac'] }} />
        <Layer
          id="sim-int-areas-borda"
          type="line"
          paint={{
            'line-color': ['get', 'borda'],
            'line-width': ['case', ['==', ['get', 'sel'], 1], 4, 2.25],
            'line-opacity': 0.95,
          }}
        />
      </Source>
      <Source id="sim-int-solidos" type="geojson" data={geo.solidos as never}>
        <Layer
          id="sim-int-solidos-3d"
          type="fill-extrusion"
          paint={{
            'fill-extrusion-color': ['get', 'cor'],
            'fill-extrusion-height': ['get', 'alt'],
            'fill-extrusion-opacity': 0.4,
          }}
        />
      </Source>
      <Source id="sim-int-ligacoes" type="geojson" data={geo.ligacoes as never}>
        <Layer id="sim-int-ligacoes-halo" type="line" paint={{ 'line-color': '#0f172a', 'line-width': 4, 'line-opacity': 0.55 }} />
        <Layer
          id="sim-int-ligacoes-linha"
          type="line"
          paint={{ 'line-color': '#f8fafc', 'line-width': 2, 'line-dasharray': [1.2, 1.1], 'line-opacity': 0.95 }}
        />
      </Source>

      {geo.rotulos.map((r) => {
        const sel = r.id === intervencaoSelecionada;
        return (
          <Marker
            key={`rotulo-${r.id}`}
            longitude={r.lng}
            latitude={r.lat}
            anchor="bottom"
            offset={[0, -6 - r.slot * 28]}
            style={{ zIndex: sel ? 4 : 2 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              sim.selecionarIntervencao(sel ? null : r.id);
            }}
          >
            <button
              type="button"
              className={`flex items-center gap-1 rounded-full border pl-0.5 pr-2 py-0.5 text-[11px] font-bold shadow-lg ${
                sel ? 'border-gv-cyan ring-2 ring-gv-cyan/80' : 'border-white/80'
              } ${r.valida ? 'bg-gv-border text-white' : 'bg-gv-red text-white'}`}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                style={{ background: r.cor, color: r.tinta, boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.35)' }}
              >
                {r.n}
              </span>
              {r.nome}
            </button>
          </Marker>
        );
      })}

      {intervencoes.map((i) => {
        const a = analises.get(i.id);
        const sel = i.id === intervencaoSelecionada;
        return (
          <Marker
            key={i.id}
            longitude={i.lng}
            latitude={i.lat}
            anchor="center"
            draggable
            style={{ zIndex: sel ? 5 : 3 }}
            onDragStart={() => {
              sim.selecionarIntervencao(i.id);
              definirPrevia({ tipo: i.tipo, lng: i.lng, lat: i.lat, origem: 'icone' });
            }}
            onDrag={(e) => definirPrevia({ tipo: i.tipo, lng: e.lngLat.lng, lat: e.lngLat.lat, origem: 'icone' })}
            onDragEnd={(e) => {
              definirPrevia(null);
              sim.mover(i.id, e.lngLat.lng, e.lngLat.lat);
            }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              sim.selecionarIntervencao(sel ? null : i.id);
            }}
          >
            <button
              type="button"
              title={a ? `${DEFINICAO[i.tipo].nome}: ${a.efeito}` : DEFINICAO[i.tipo].nome}
              aria-label={`${DEFINICAO[i.tipo].nome}. ${a?.efeito ?? ''} Arraste para mudar o lugar.`}
              className="cursor-grab active:cursor-grabbing drop-shadow-[0_6px_4px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gv-cyan rounded"
            >
              <IconeIntervencao tipo={i.tipo} tamanho={sel ? 40 : 32} invalida={a ? !a.valida : false} selecionada={sel} />
            </button>
          </Marker>
        );
      })}

      {selecionada && tipoSelecionado && (
        <Popup
          longitude={selecionada.lng}
          latitude={selecionada.lat}
          anchor="bottom"
          offset={[0, -34 - selecionada.slot * 28]}
          closeButton={false}
          closeOnClick={false}
          maxWidth="220px"
        >
          <div className="text-gv-ink max-w-[200px]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gv-muted">Onde age</p>
            <p className="text-xs font-bold text-gv-ink">{DEFINICAO[tipoSelecionado].nome}</p>
            <p className="text-[11px] leading-snug mt-0.5">{selecionada.efeito}</p>
            {selecionada.afastada && (
              <p className="text-[11px] text-gv-muted mt-1">A linha tracejada liga a mancha ao ícone.</p>
            )}
            {!selecionada.valida && (
              <p className="text-[11px] text-gv-red font-medium mt-1">Arraste o ícone até o lugar certo.</p>
            )}
          </div>
        </Popup>
      )}
      <PreviaArraste rede={rede} />
    </>
  );
};
