import React, { useEffect, useRef } from 'react';
import { Layer, Source, useMap } from 'react-map-gl';
import type { GeoJSONSource, HeatmapLayerSpecification } from 'maplibre-gl';
import { paraGeo, type QuadroLocal } from '../../sim/geometria';
import type { Agente, Evento } from '../../sim/motor';
import type { Simulacao } from '../../sim/useSimulacao';
import type { Mancha } from './SeletorMancha';
import { PALETA, rgba } from './paleta';
import { registrarSprites } from './sprites';

/** Camadas que o clique do mapa pode acertar. Só entram em interactiveLayerIds com o mapa pronto. */
export const CAMADAS_AGENTES = ['sim-veiculos-alvo', 'sim-veiculos', 'sim-pedestres'] as const;

const VAZIO = { type: 'FeatureCollection' as const, features: [] };
const PULSO_MS = 600;

type Colecao = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: Record<string, string | number | boolean>;
    geometry: { type: 'Point'; coordinates: [number, number] };
  }[];
};

interface Memoria {
  v: number;
  ang: number;
  x: number;
  y: number;
  rot: number;
  dist: number;
  pisca: -1 | 0 | 1;
  piscaAte: number;
  freioAte: number;
}

const enrolar = (d: number) => {
  let a = d;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const bearingDe = (q: QuadroLocal, ang: number) => {
  const rumo = Math.atan2(q.sin, q.cos);
  return (90 - ((ang + rumo) * 180) / Math.PI + 3600) % 360;
};

const aproximar = (atual: number, alvo: number) => {
  const d = ((alvo - atual + 540) % 360) - 180;
  return (atual + d * 0.4 + 360) % 360;
};

const pontos = (q: QuadroLocal, eventos: Evento[], tipo: Evento['tipo']): Colecao => ({
  type: 'FeatureCollection',
  features: eventos
    .filter((e) => e.tipo === tipo)
    .map((e) => ({
      type: 'Feature' as const,
      properties: { peso: e.peso },
      geometry: { type: 'Point' as const, coordinates: paraGeo(q, { x: e.x, y: e.y }) },
    })),
});

const enviar = (mapa: { getSource: (id: string) => unknown }, id: string, dados: Colecao) => {
  const fonte = mapa.getSource(id) as GeoJSONSource | undefined;
  fonte?.setData(dados as never);
};

const pinturaCalor = (paradas: (number | string)[]) =>
  ({
    'heatmap-weight': ['get', 'peso'],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 15, 1.2, 18, 2.2],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 15, 18, 17, 36, 19, 64],
    'heatmap-opacity': 0.9,
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...paradas],
  }) as HeatmapLayerSpecification['paint'];

const rampa = (claro: string, meio: string, forte: string) => [
  0, rgba(claro, 0),
  0.15, rgba(claro, 0.45),
  0.4, rgba(meio, 0.72),
  0.75, rgba(forte, 0.88),
  1, rgba(forte, 0.96),
];

const icone = (imagem: unknown) =>
  ({
    'icon-image': imagem,
    'icon-rotate': ['get', 'rot'],
    'icon-rotation-alignment': 'map',
    'icon-pitch-alignment': 'map',
    'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.16, 17, 0.28, 19, 0.46],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-anchor': 'center',
  }) as never;

interface Props {
  sim: Simulacao;
  mancha: Mancha;
  onCamadas: (prontas: boolean) => void;
  onPontos: (conflitos: number, infracoes: number) => void;
}

/**
 * Agentes, semáforos, pulsos e mancha da simulação.
 * Cada agente é um ponto; o sprite sai do canvas. O GeoJSON não entra no estado do React.
 */
export const CamadaSimulacao: React.FC<Props> = ({ sim, mancha, onCamadas, onPontos }) => {
  const { current } = useMap();
  const selecionadoRef = useRef(sim.selecionadoId);
  selecionadoRef.current = sim.selecionadoId;
  const memoria = useRef(new Map<number, Memoria>());

  useEffect(() => {
    const mapa = current?.getMap();
    if (!mapa) return;
    let vivo = true;
    const verificar = () => {
      if (!vivo) return;
      onCamadas(Boolean(mapa.getLayer('sim-veiculos') && mapa.getLayer('sim-veiculos-alvo') && mapa.getLayer('sim-pedestres')));
    };
    verificar();
    mapa.on('idle', verificar);
    mapa.on('styledata', verificar);
    const id = window.setInterval(() => {
      verificar();
      if (mapa.getLayer('sim-veiculos') && mapa.getLayer('sim-pedestres')) window.clearInterval(id);
    }, 200);
    return () => {
      vivo = false;
      window.clearInterval(id);
      mapa.off('idle', verificar);
      mapa.off('styledata', verificar);
      onCamadas(false);
    };
  }, [current, onCamadas]);

  useEffect(() => {
    const mapa = current?.getMap();
    const rede = sim.rede;
    if (!mapa || !rede) return;
    const quadro = rede.quadro;
    let ultimoCalor = 0;
    let conflitosAntes = -1;
    let infracoesAntes = -1;

    const lembrar = (a: Agente, agora: number) => {
      const rotAlvo = bearingDe(quadro, a.ang);
      let m = memoria.current.get(a.id);
      if (!m) {
        m = { v: a.v, ang: a.ang, x: a.x, y: a.y, rot: rotAlvo, dist: 0, pisca: 0, piscaAte: 0, freioAte: 0 };
        memoria.current.set(a.id, m);
        return m;
      }
      const dAng = enrolar(a.ang - m.ang);
      if (dAng > 0.008) {
        m.pisca = 1;
        m.piscaAte = agora + 500;
      } else if (dAng < -0.008) {
        m.pisca = -1;
        m.piscaAte = agora + 500;
      }
      if (m.v - a.v > 0.03) m.freioAte = agora + 320;
      m.dist += Math.hypot(a.x - m.x, a.y - m.y);
      m.rot = aproximar(m.rot, rotAlvo);
      m.v = a.v;
      m.ang = a.ang;
      m.x = a.x;
      m.y = a.y;
      if (agora > m.piscaAte) m.pisca = 0;
      return m;
    };

    const desenhar = () => {
      registrarSprites(mapa as never);
      const motor = sim.motorRef.current;
      if (!motor) return;
      const agora = performance.now();
      const sel = selecionadoRef.current;
      const veiculos: Colecao = { type: 'FeatureCollection', features: [] };
      const pedestres: Colecao = { type: 'FeatureCollection', features: [] };
      const alvos: Colecao = { type: 'FeatureCollection', features: [] };
      const vivos = new Set<number>();

      const eventos = motor.eventos;
      const tAgora = eventos.length ? eventos[eventos.length - 1].t : 0;
      const emConflito = new Set<number>();
      for (let i = eventos.length - 1; i >= 0 && i > eventos.length - 80; i--) {
        const e = eventos[i];
        if (tAgora - e.t > 2.5) break;
        if (e.tipo === 'conflito') for (const id of e.agentes) emConflito.add(id);
      }
      const pulsosVivos = sim.pulsos.current.filter((p) => agora - p.realT >= 0 && agora - p.realT < 1200);

      for (const a of motor.agentes) {
        vivos.add(a.id);
        const m = lembrar(a, agora);
        if (a.tipo === 'pedestre') {
          let anelPed = '';
          const perto = pulsosVivos.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < 5);
          if (a.infrator || a.ped?.correu) anelPed = 'vermelho';
          else if (emConflito.has(a.id) || perto) anelPed = 'laranja';
          pedestres.features.push({
            type: 'Feature',
            properties: {
              id: a.id,
              rot: m.rot,
              passo: Math.floor(m.dist / 0.65) % 3,
              anel: anelPed,
            },
            geometry: { type: 'Point', coordinates: paraGeo(quadro, { x: a.x, y: a.y }) },
          });
          continue;
        }
        const centro = {
          x: a.x - (Math.cos(a.ang) * a.comp) / 2,
          y: a.y - (Math.sin(a.ang) * a.comp) / 2,
        };
        const pulso = a.infrator ? 0.4 + 0.6 * Math.abs(Math.sin(agora / 170)) : 0;
        veiculos.features.push({
          type: 'Feature',
          properties: {
            id: a.id,
            tipo: a.tipo,
            rot: m.rot,
            freio: agora < m.freioAte ? 1 : 0,
            pisca: m.pisca,
            contorno: pulso,
            selecao: a.id === sel ? 1 : 0,
          },
          geometry: { type: 'Point', coordinates: paraGeo(quadro, centro) },
        });
        alvos.features.push({
          type: 'Feature',
          properties: { id: a.id },
          geometry: { type: 'Point', coordinates: paraGeo(quadro, centro) },
        });
      }
      for (const id of memoria.current.keys()) if (!vivos.has(id)) memoria.current.delete(id);

      const luzes: Colecao = {
        type: 'FeatureCollection',
        features: motor.luzes().map((l) => ({
          type: 'Feature' as const,
          properties: { cor: l.cor, rot: 0 },
          geometry: { type: 'Point' as const, coordinates: paraGeo(quadro, { x: l.x, y: l.y }) },
        })),
      };

      const pulsos: Colecao = { type: 'FeatureCollection', features: [] };
      for (const p of sim.pulsos.current) {
        const idade = agora - p.realT;
        if (idade < 0 || idade >= PULSO_MS) continue;
        pulsos.features.push({
          type: 'Feature',
          properties: { t: idade / PULSO_MS, grave: p.grave },
          geometry: { type: 'Point', coordinates: paraGeo(quadro, { x: p.x, y: p.y }) },
        });
      }

      enviar(mapa, 'sim-veiculos', veiculos);
      enviar(mapa, 'sim-veiculos-alvo', alvos);
      enviar(mapa, 'sim-pedestres', pedestres);
      enviar(mapa, 'sim-luzes', luzes);
      enviar(mapa, 'sim-pulsos', pulsos);

      if (agora - ultimoCalor > 500) {
        ultimoCalor = agora;
        const conflitos = pontos(quadro, eventos, 'conflito');
        const infracoes = pontos(quadro, eventos, 'infracao');
        enviar(mapa, 'sim-calor-conflitos', conflitos);
        enviar(mapa, 'sim-calor-infracoes', infracoes);
        if (conflitos.features.length !== conflitosAntes || infracoes.features.length !== infracoesAntes) {
          conflitosAntes = conflitos.features.length;
          infracoesAntes = infracoes.features.length;
          onPontos(conflitosAntes, infracoesAntes);
        }
      }
    };

    desenhar();
    return sim.assinar(desenhar);
  }, [current, onPontos, sim.assinar, sim.motorRef, sim.pulsos, sim.rede]);

  const visivel = (qual: Mancha) => (mancha === qual ? 'visible' : 'none') as 'visible' | 'none';
  const pedestreIcone = {
    'icon-image': ['concat', 'spr-ped-', ['to-string', ['get', 'passo']]],
    'icon-rotate': ['get', 'rot'],
    'icon-rotation-alignment': 'map',
    'icon-pitch-alignment': 'map',
    'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.28, 17, 0.42, 19, 0.62],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };

  return (
    <>
      <Source id="sim-calor-conflitos" type="geojson" data={VAZIO}>
        <Layer
          id="sim-calor-conflito"
          type="heatmap"
          layout={{ visibility: visivel('conflitos') }}
          paint={pinturaCalor(rampa(PALETA.conflito, '#ea580c', '#c2410c'))}
        />
      </Source>
      <Source id="sim-calor-infracoes" type="geojson" data={VAZIO}>
        <Layer
          id="sim-calor-infracao"
          type="heatmap"
          layout={{ visibility: visivel('infracoes') }}
          paint={pinturaCalor(rampa(PALETA.infracao, '#dc2626', '#991b1b'))}
        />
      </Source>

      <Source id="sim-veiculos" type="geojson" data={VAZIO}>
        <Layer id="sim-veiculos" type="symbol" layout={icone(['concat', 'spr-', ['get', 'tipo']])} />
        <Layer
          id="sim-veiculos-freio"
          type="symbol"
          layout={icone(['concat', 'spr-freio-', ['get', 'tipo']])}
          paint={{ 'icon-opacity': ['get', 'freio'] }}
        />
        <Layer
          id="sim-veiculos-pisca"
          type="symbol"
          layout={icone([
            'case',
            ['==', ['get', 'pisca'], -1],
            ['concat', 'spr-pisca-dir-', ['get', 'tipo']],
            ['concat', 'spr-pisca-esq-', ['get', 'tipo']],
          ])}
          paint={{ 'icon-opacity': ['case', ['==', ['get', 'pisca'], 0], 0, 1] }}
        />
        <Layer
          id="sim-veiculos-contorno"
          type="symbol"
          layout={icone(['concat', 'spr-contorno-', ['get', 'tipo']])}
          paint={{ 'icon-opacity': ['get', 'contorno'] }}
        />
        <Layer
          id="sim-veiculos-anel"
          type="symbol"
          layout={icone(['concat', 'spr-anel-', ['get', 'tipo']])}
          paint={{ 'icon-opacity': ['get', 'selecao'] }}
        />
      </Source>

      <Source id="sim-veiculos-alvo" type="geojson" data={VAZIO}>
        <Layer
          id="sim-veiculos-alvo"
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-opacity': 0.01, 'circle-color': '#000000', 'circle-pitch-alignment': 'viewport' }}
        />
      </Source>
      <Source id="sim-pedestres" type="geojson" data={VAZIO}>
        <Layer
          id="sim-pedestres-anel"
          type="symbol"
          layout={{
            ...pedestreIcone,
            'icon-image': [
              'match',
              ['get', 'anel'],
              'vermelho',
              'spr-anel-ped-vermelho',
              'laranja',
              'spr-anel-ped-laranja',
              'spr-ped-0',
            ],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.42, 17, 0.62, 19, 0.9],
          } as never}
          paint={{ 'icon-opacity': ['case', ['==', ['get', 'anel'], ''], 0, 1] }}
        />
        <Layer id="sim-pedestres" type="symbol" layout={pedestreIcone as never} />
      </Source>

      <Source id="sim-luzes" type="geojson" data={VAZIO}>
        <Layer
          id="sim-luzes"
          type="symbol"
          layout={{
            'icon-image': ['concat', 'spr-luz-', ['get', 'cor']],
            'icon-pitch-alignment': 'map',
            'icon-rotation-alignment': 'map',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.28, 17, 0.42, 19, 0.62],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          } as never}
        />
      </Source>

      <Source id="sim-pulsos" type="geojson" data={VAZIO}>
        <Layer
          id="sim-pulsos"
          type="circle"
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['get', 't'], 0, 4, 1, 16],
            'circle-opacity': ['-', 0.9, ['*', 0.9, ['get', 't']]],
            'circle-color': ['case', ['get', 'grave'], PALETA.infracao, PALETA.conflito],
            'circle-blur': 0.35,
            'circle-pitch-alignment': 'map',
          }}
        />
      </Source>
    </>
  );
};
