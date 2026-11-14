import React, { useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl';
import { paraGeo, type Vec2 } from '../../sim/geometria';
import type { Rede } from '../../sim/rede';
import { DEFINICAO, type AnaliseIntervencao, type Intervencao } from '../../sim/intervencoes';
import type { Simulacao } from '../../sim/useSimulacao';
import { IconeIntervencao } from './IconeIntervencao';

/**
 * Intervenções no mapa: o desenho no chão (onde cada uma tem efeito) e o ícone arrastável.
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

/** Desenho no chão de cada intervenção, na posição em que ela tem efeito. */
function geometrias(rede: Rede, ints: Intervencao[], analises: Map<string, AnaliseIntervencao>, selecionada: string | null) {
  const solidos: unknown[] = [];
  const areas: unknown[] = [];
  const poli = (coords: unknown, props: Record<string, unknown>) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: coords } });
  for (const i of ints) {
    const a = analises.get(i.id);
    if (!a?.valida) continue;
    const { x, y } = a.p;
    const sel = i.id === selecionada;
    switch (i.tipo) {
      case 'camera':
        areas.push(poli(circulo(rede, a.p, DEFINICAO.camera.raio), { cor: '#3b82f6', opac: sel ? 0.22 : 0.1 }));
        break;
      case 'agente':
        areas.push(poli(circulo(rede, a.p, DEFINICAO.agente.raio), { cor: '#6366f1', opac: sel ? 0.25 : 0.12 }));
        break;
      case 'semaforo': {
        const c = rede.cruzamentos.find((k) => k.id === a.cruzamento);
        if (c) areas.push(poli(circulo(rede, { x: c.x, y: 0 }, 22), { cor: '#111827', opac: sel ? 0.3 : 0.15 }));
        break;
      }
      case 'fechar_canteiro': {
        const ab = rede.aberturas.find((k) => k.id === a.alvo);
        if (ab) solidos.push(poli(retangulo(rede, ab.x0, ab.x1, -rede.meioCanteiro, rede.meioCanteiro), { cor: '#16a34a', alt: 0.3 }));
        break;
      }
      case 'retorno':
        if (a.regulariza) {
          const ab = rede.aberturas.find((k) => k.id === a.alvo);
          if (ab) areas.push(poli(retangulo(rede, ab.x0, ab.x1, -rede.meioCanteiro, rede.meioCanteiro), { cor: '#22c55e', opac: 0.35 }));
        } else {
          solidos.push(poli(retangulo(rede, x - 10, x + 10, -rede.meioCanteiro, rede.meioCanteiro), { cor: '#475569', alt: 0.02 }));
        }
        break;
      case 'tachoes':
        for (let k = -4.5; k <= 4.5; k++) {
          const cx = x + k * 1.6;
          solidos.push(poli(retangulo(rede, cx - 0.22, cx + 0.22, y - 0.18, y + 0.18), { cor: '#facc15', alt: 0.3 }));
        }
        break;
      case 'faixa_elevada':
        solidos.push(poli(retangulo(rede, x - 2.5, x + 2.5, -rede.borda, rede.borda), { cor: '#f1f5f9', alt: 0.15 }));
        break;
      case 'refugio':
        solidos.push(poli(retangulo(rede, x - 2, x + 2, -rede.meioCanteiro, rede.meioCanteiro), { cor: '#cbd5e1', alt: 0.2 }));
        break;
      case 'lombada': {
        const s = a.lado === 'oeste' ? 1 : -1;
        solidos.push(poli(retangulo(rede, x - 1.85, x + 1.85, s * rede.meioCanteiro, s * rede.borda), { cor: '#facc15', alt: 0.1 }));
        break;
      }
    }
  }
  return {
    solidos: { type: 'FeatureCollection', features: solidos },
    areas: { type: 'FeatureCollection', features: areas },
  };
}

export const CamadaIntervencoes: React.FC<{ sim: Simulacao }> = ({ sim }) => {
  const { rede } = sim;
  const geo = useMemo(
    () => (rede ? geometrias(rede, sim.intervencoes, sim.analises, sim.intervencaoSelecionada) : null),
    [rede, sim.intervencoes, sim.analises, sim.intervencaoSelecionada]
  );
  if (!rede || !geo) return null;

  return (
    <>
      <Source id="sim-int-areas" type="geojson" data={geo.areas as never}>
        <Layer id="sim-int-areas-fill" type="fill" paint={{ 'fill-color': ['get', 'cor'], 'fill-opacity': ['get', 'opac'] }} />
        <Layer id="sim-int-areas-borda" type="line" paint={{ 'line-color': ['get', 'cor'], 'line-width': 1.2, 'line-dasharray': [2, 2] }} />
      </Source>
      <Source id="sim-int-solidos" type="geojson" data={geo.solidos as never}>
        <Layer
          id="sim-int-solidos-3d"
          type="fill-extrusion"
          paint={{ 'fill-extrusion-color': ['get', 'cor'], 'fill-extrusion-height': ['get', 'alt'], 'fill-extrusion-opacity': 0.92 }}
        />
      </Source>

      {/* ícones: arraste para reposicionar, clique para editar */}
      {sim.intervencoes.map((i) => {
        const a = sim.analises.get(i.id);
        const sel = i.id === sim.intervencaoSelecionada;
        return (
          <Marker
            key={i.id}
            longitude={i.lng}
            latitude={i.lat}
            anchor="center"
            draggable
            onDragStart={() => sim.selecionarIntervencao(i.id)}
            onDragEnd={(e) => sim.mover(i.id, e.lngLat.lng, e.lngLat.lat)}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              sim.selecionarIntervencao(sel ? null : i.id);
            }}
          >
            <button
              type="button"
              title={a ? `${DEFINICAO[i.tipo].nome}: ${a.efeito}` : DEFINICAO[i.tipo].nome}
              aria-label={`${DEFINICAO[i.tipo].nome}: ${a?.efeito ?? ''}`}
              className="cursor-grab active:cursor-grabbing drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
            >
              <IconeIntervencao tipo={i.tipo} tamanho={sel ? 38 : 32} invalida={a ? !a.valida : false} selecionada={sel} />
            </button>
          </Marker>
        );
      })}
    </>
  );
};
