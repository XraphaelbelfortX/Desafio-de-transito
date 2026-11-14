import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  LayerProps,
  MapLayerMouseEvent,
  MapRef,
} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Eye, AlertTriangle, Layers, Crosshair, KeyRound, Box } from 'lucide-react';
import { Incident } from '../types';
import { INTERSECTION_CENTER } from '../data/mockData';
import { RedeLayer, REDE_LAYER_IDS, ROTULO_TIPO } from './RedeLayer';
import { CameraControls3D, VistaPronta } from './CameraControls3D';
import { Predios3DLayer } from './Predios3DLayer';
import type { Simulacao } from '../sim/useSimulacao';
import type { TipoIntervencao } from '../sim/intervencoes';
import { paraGeo } from '../sim/geometria';
import { CamadaIntervencoes, centroDaZona } from './sim/CamadaIntervencoes';
import { CAMADAS_AGENTES, CamadaSimulacao } from './sim/CamadaSimulacao';
import { ControlesTempo } from './sim/ControlesTempo';
import { PainelAgente } from './sim/PainelAgente';
import { SeletorMancha, type Mancha } from './sim/SeletorMancha';
import { MIME_INTERVENCAO } from './sim/PainelIntervencoes';

/** Rumo aproximado da Av. dos Africanos (graus, sentido horário a partir do norte). */
const RUMO_AFRICANOS = 122;

/** Vistas prontas, no estilo do Google Earth, em volta do cruzamento. */
const VISTAS: VistaPronta[] = [
  { id: 'sul', nome: 'Da Vicente Venâncio (olhando para o norte)', bearing: RUMO_AFRICANOS - 90, pitch: 62, zoom: 18.3 },
  { id: 'norte', nome: 'Da Rua Minerva (olhando para o sul)', bearing: RUMO_AFRICANOS + 90, pitch: 62, zoom: 18.3 },
  { id: 'oeste', nome: 'Pela Africanos, sentido leste', bearing: RUMO_AFRICANOS, pitch: 72, zoom: 18.6 },
  { id: 'leste', nome: 'Pela Africanos, sentido oeste', bearing: RUMO_AFRICANOS + 180, pitch: 72, zoom: 18.6 },
  { id: 'alto', nome: 'Vista aérea oblíqua', bearing: -28, pitch: 50, zoom: 17.4 },
  { id: 'topo', nome: 'De cima (2D)', bearing: 0, pitch: 0, zoom: 17.8 },
];

/** Fundo de satélite (Esri World Imagery), sem necessidade de token. */
const SATELITE_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18, // a Esri não tem foto em z19 aqui; acima disso o MapLibre amplia o z18
      attribution: 'Imagens © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'satelite', type: 'raster' as const, source: 'esri' }],
  // Luz vinda do noroeste para dar volume às fachadas dos prédios 3D
  light: { anchor: 'viewport' as const, color: '#ffffff', intensity: 0.45, position: [1.3, 300, 40] as [number, number, number] },
  // Céu e névoa no horizonte quando a câmera está bem inclinada
  sky: {
    'sky-color': '#7fb2e5',
    'horizon-color': '#dfe9f3',
    'fog-color': '#dfe9f3',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.85,
  },
};

interface FeicaoRede {
  lng: number;
  lat: number;
  props: Record<string, unknown>;
}

/**
 * Substitua pelo seu token Mapbox real (ex: pk.eyJ1Ijoi...)
 * Enquanto estiver com o valor 'YOUR_MAPBOX_TOKEN', o componente utiliza automaticamente
 * o motor vetorial compatível para garantir renderização 100% funcional do Heatmap e 3D no MVP.
 */
export const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN';

interface TacticalMapProps {
  incidents: Incident[];
  onOpenStreetView: () => void;
  latestIncidentId: string | null;
  sim: Simulacao;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  incidents,
  onOpenStreetView,
  latestIncidentId,
  sim,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [customToken, setCustomToken] = useState<string>(MAPBOX_TOKEN);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showRede, setShowRede] = useState(true);
  const [feicaoRede, setFeicaoRede] = useState<FeicaoRede | null>(null);

  // Estados da Visão 3D Interativa
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [predios3D, setPredios3D] = useState<boolean>(true);
  const mapRef = useRef<MapRef>(null);
  const [soltando, setSoltando] = useState(false);
  const [mancha, setMancha] = useState<Mancha>('conflitos');
  const [pontosSim, setPontosSim] = useState({ conflitos: 0, infracoes: 0 });
  const aoPontos = useCallback((conflitos: number, infracoes: number) => {
    setPontosSim((atual) => (atual.conflitos === conflitos && atual.infracoes === infracoes ? atual : { conflitos, infracoes }));
  }, []);
  const [camadasAgentes, setCamadasAgentes] = useState(false);
  const aoCamadas = useCallback((prontas: boolean) => {
    setCamadasAgentes((atual) => (atual === prontas ? atual : prontas));
  }, []);

  // Esc cancela a colocação ou a seleção. O foco do mapa só acontece quando o painel pede.
  const { modoColocar, setModoColocar, focoTick, intervencaoSelecionada, selecionarIntervencao } = sim;
  useEffect(() => {
    if (!modoColocar && !intervencaoSelecionada) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modoColocar) setModoColocar(null);
      else selecionarIntervencao(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [modoColocar, setModoColocar, intervencaoSelecionada, selecionarIntervencao]);

  useEffect(() => {
    if (!focoTick || !mapRef.current) return;
    const id = sim.intervencaoSelecionada;
    const rede = sim.rede;
    if (!id || !rede) return;
    const a = sim.analises.get(id);
    const i = sim.intervencoes.find((x) => x.id === id);
    if (!i) return;
    const [lng, lat] = a ? paraGeo(rede.quadro, centroDaZona(rede, i.tipo, a)) : [i.lng, i.lat];
    mapRef.current.easeTo({
      center: [lng, lat],
      zoom: Math.max(mapRef.current.getZoom(), 17.9),
      duration: 650,
    });
    // Só o pedido de foco dispara o enquadramento; clicar o ícone no mapa não recentraliza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoTick]);

  const [viewState, setViewState] = useState({
    latitude: INTERSECTION_CENTER.lat,
    longitude: INTERSECTION_CENTER.lng,
    zoom: INTERSECTION_CENTER.zoom,
    pitch: 60,
    bearing: -25,
  });

  // Garante que se INTERSECTION_CENTER atualizar via HMR, a câmera foca no único mapa de calor correto
  useEffect(() => {
    setViewState((prev) => ({
      ...prev,
      latitude: INTERSECTION_CENTER.lat,
      longitude: INTERSECTION_CENTER.lng,
      zoom: INTERSECTION_CENTER.zoom,
    }));
  }, []);

  const isPlaceholderToken =
    !customToken ||
    customToken.trim() === '' ||
    customToken.trim() === 'YOUR_MAPBOX_TOKEN';

  //Alternar entre 2D Plano e 3D Tático SimCity
  const handleToggle3DMode = () => {
    setIs3DMode((prev) => {
      const next = !prev;
      const alvo = {
        latitude: INTERSECTION_CENTER.lat,
        longitude: INTERSECTION_CENTER.lng,
        zoom: next ? 18.4 : 17.8,
        pitch: next ? 62 : 0,
        bearing: next ? -28 : 0,
      };
      // Transição animada, como no Google Earth; sem o mapa pronto, salta direto
      if (mapRef.current) {
        mapRef.current.easeTo({
          center: [alvo.longitude, alvo.latitude],
          zoom: alvo.zoom,
          pitch: alvo.pitch,
          bearing: alvo.bearing,
          duration: 1200,
        });
      } else {
        setViewState((vs) => ({ ...vs, ...alvo }));
      }
      return next;
    });
  };

  // Clique no mapa: coloca a intervenção escolhida ou inspeciona a rede de faixas
  const handleMapClick = (e: MapLayerMouseEvent) => {
    if (sim.modoColocar) {
      sim.adicionar(sim.modoColocar, e.lngLat.lng, e.lngLat.lat);
      return;
    }
    const agente = e.features?.find((f) => f.layer?.id === 'sim-veiculos' || f.layer?.id === 'sim-pedestres');
    if (agente?.properties && agente.properties.id != null) {
      sim.selecionar(Number(agente.properties.id));
      sim.selecionarIntervencao(null);
      setFeicaoRede(null);
      setSelectedIncident(null);
      return;
    }
    try {
      const mapa = mapRef.current?.getMap();
      const camadasZona = ['sim-int-areas-fill', 'sim-int-solidos-3d'].filter((id) => mapa?.getLayer(id));
      if (mapa && camadasZona.length > 0) {
        const zona = mapa.queryRenderedFeatures(e.point, { layers: camadasZona });
        const bruto = zona[0]?.properties?.zid ?? zona[0]?.properties?.id;
        const idZona = bruto;
        if (idZona != null && String(idZona) !== '') {
          sim.selecionar(null);
          sim.selecionarIntervencao(String(idZona));
          setFeicaoRede(null);
          setSelectedIncident(null);
          return;
        }
      }
    } catch {
      /* a camada da zona ainda não entrou no estilo */
    }
    sim.selecionar(null);
    sim.selecionarIntervencao(null);
    const feicao = e.features?.find((f) => REDE_LAYER_IDS.includes(f.layer?.id as (typeof REDE_LAYER_IDS)[number]));
    setFeicaoRede(feicao ? { lng: e.lngLat.lng, lat: e.lngLat.lat, props: feicao.properties ?? {} } : null);
  };

  // Soltar uma intervenção arrastada do painel
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const tipo = e.dataTransfer.getData(MIME_INTERVENCAO) as TipoIntervencao;
    setSoltando(false);
    if (!tipo || !mapRef.current) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const p = mapRef.current.unproject([e.clientX - r.left, e.clientY - r.top]);
    sim.adicionar(tipo, p.lng, p.lat);
  };

  // GeoJSON Único do Heatmap construído exclusivamente a partir dos alertas (`incidents`) no cruzamento atual
  const incidentsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: incidents.map((incident) => ({
        type: 'Feature' as const,
        properties: {
          id: incident.id,
          tipo: incident.tipo,
          severidade: incident.severidade,
          resumo: incident.resumo,
          weight:
            incident.severidade === 'critica'
              ? 1.0
              : incident.severidade === 'alta'
              ? 0.9
              : incident.severidade === 'media'
              ? 0.75
              : 0.5,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [incident.lng, incident.lat],
        },
      })),
    }),
    [incidents]
  );

  // Camada nativa de Heatmap (única mancha de calor centrada exatamente nos alertas)
  // (os relatos são fatos passados: a mancha não muda quando se coloca uma intervenção)
  const heatmapLayer: LayerProps = useMemo(() => {
    return {
      id: 'incidents-heatmap',
      type: 'heatmap',
      paint: {
        'heatmap-weight': ['get', 'weight'],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          1.8,
          18,
          3.6,
          20,
          4.5,
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(37, 99, 235, 0)',
          0.18,
          'rgba(59, 130, 246, 0.48)',
          0.38,
          'rgba(250, 204, 21, 0.82)',
          0.62,
          'rgba(249, 115, 22, 0.92)',
          0.82,
          'rgba(239, 68, 68, 0.97)',
          1,
          'rgba(153, 27, 27, 1)',
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          42,
          18,
          92,
          20,
          130,
        ],
        'heatmap-opacity': is3DMode ? 0.78 : 0.88,
      },
    };
  }, [is3DMode]);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [INTERSECTION_CENTER.lng, INTERSECTION_CENTER.lat],
        zoom: is3DMode ? 18.4 : INTERSECTION_CENTER.zoom,
        pitch: is3DMode ? 62 : 0,
        bearing: is3DMode ? -28 : 0,
        duration: 1400,
      });
      return;
    }
    setViewState({
      latitude: INTERSECTION_CENTER.lat,
      longitude: INTERSECTION_CENTER.lng,
      zoom: is3DMode ? 18.4 : INTERSECTION_CENTER.zoom,
      pitch: is3DMode ? 62 : 0,
      bearing: is3DMode ? -28 : 0,
    });
  };

  return (
    <div
      className={`relative w-full h-full min-h-[450px] rounded-xl overflow-hidden border shadow-sm bg-slate-900 ${
        soltando ? 'border-cyan-400 ring-2 ring-cyan-400/60' : 'border-slate-200'
      }`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(MIME_INTERVENCAO)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setSoltando(true);
      }}
      onDragLeave={() => setSoltando(false)}
      onDrop={handleDrop}
    >
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        maxPitch={85}
        mapLib={(isPlaceholderToken ? maplibregl : undefined) as never}
        mapboxAccessToken={isPlaceholderToken ? undefined : customToken}
        mapStyle={
          isPlaceholderToken
            ? SATELITE_STYLE
            : 'mapbox://styles/mapbox/satellite-streets-v12'
        }
        interactiveLayerIds={[
          ...(showRede ? REDE_LAYER_IDS : []),
          ...(sim.pronto && camadasAgentes ? CAMADAS_AGENTES : []),
        ]}
        cursor={sim.modoColocar ? 'crosshair' : feicaoRede ? 'pointer' : undefined}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
      >
        {/* Prédios 3D do OpenStreetMap (só na visão 3D) */}
        <Predios3DLayer visible={is3DMode && predios3D} />

        {/* Camada Nativa Única de Heatmap de Quase-Acidentes centrada nos alertas */}
        <Source id="incidents-source" type="geojson" data={incidentsGeoJson}>
          <Layer {...heatmapLayer} layout={{ visibility: mancha === 'relatos' ? 'visible' : 'none' }} />
        </Source>

        {/* Rede de faixas (gerada por scripts/gera-rede.mjs) */}
        <RedeLayer visible={showRede} />

        {/* Agentes, semáforos e mancha da simulação (GeoJSON direto na fonte, sem estado React) */}
        <CamadaSimulacao sim={sim} mancha={mancha} onCamadas={aoCamadas} onPontos={aoPontos} />

        {feicaoRede && (
          <Popup
            longitude={feicaoRede.lng}
            latitude={feicaoRede.lat}
            anchor="bottom"
            offset={10}
            onClose={() => setFeicaoRede(null)}
            closeOnClick={false}
          >
            <div className="p-1 max-w-[240px] text-slate-800 text-[11px] leading-snug">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                {ROTULO_TIPO[String(feicaoRede.props.tipo)] ?? String(feicaoRede.props.tipo)}
              </p>
              <p className="text-xs font-bold text-slate-900">{String(feicaoRede.props.nome ?? '')}</p>
              <p className="font-mono text-[10px] text-slate-500">id: {String(feicaoRede.props.id)}</p>
              {feicaoRede.props.sentido != null && <p>Sentido: {String(feicaoRede.props.sentido)}</p>}
              {feicaoRede.props.tipo === 'movimento' && (
                <>
                  <p>
                    Sinalização:{' '}
                    <strong className={feicaoRede.props.permitido === true ? 'text-emerald-700' : 'text-red-700'}>
                      {feicaoRede.props.permitido === true ? 'permitido' : 'proibido (infração possível)'}
                    </strong>
                  </p>
                  {feicaoRede.props.conflito != null && <p>Conflito: {String(feicaoRede.props.conflito).replace(/_/g, ' ')}</p>}
                  {feicaoRede.props.fechado_por != null && (
                    <p>Deixa de existir com: {String(feicaoRede.props.fechado_por).replace(/_/g, ' ')}</p>
                  )}
                </>
              )}
            </div>
          </Popup>
        )}

        {/* Intervenções colocadas pelo painel (desenho no chão + ícones arrastáveis) */}
        <CamadaIntervencoes sim={sim} />

        {/* Marcadores dos relatos só aparecem com a mancha Relatos */}
        {mancha === 'relatos' && incidents.map((incident) => {
          const isNew = incident.id === latestIncidentId;
          const badgeColor =
            incident.severidade === 'critica'
              ? 'bg-red-600 border-red-200'
              : incident.severidade === 'alta'
              ? 'bg-orange-500 border-orange-100'
              : 'bg-amber-500 border-amber-100';

          return (
            <Marker
              key={incident.id}
              longitude={incident.lng}
              latitude={incident.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedIncident(incident);
              }}
            >
              <button
                type="button"
                aria-label={`Ver relato: ${incident.tipo}`}
                className={`group relative flex items-center justify-center transition-transform duration-200 hover:scale-125 focus:outline-none ${
                  isNew ? 'scale-125' : ''
                }`}
              >
                <span
                  className={`absolute w-9 h-9 rounded-full opacity-45 animate-ping ${
                    incident.severidade === 'critica'
                      ? 'bg-red-500'
                      : 'bg-orange-400'
                  }`}
                />
                <span
                  className={`relative flex items-center justify-center w-7 h-7 rounded-full border-2 text-white shadow-lg ${badgeColor}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
              </button>
            </Marker>
          );
        })}

        {/* Popup de Detalhes do Relato */}
        {mancha === 'relatos' && selectedIncident && (
          <Popup
            longitude={selectedIncident.lng}
            latitude={selectedIncident.lat}
            anchor="bottom"
            offset={16}
            onClose={() => setSelectedIncident(null)}
            closeButton={true}
            closeOnClick={false}
            className="z-30"
          >
            <div className="p-1.5 max-w-[240px] text-slate-800">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    selectedIncident.severidade === 'critica'
                      ? 'bg-red-100 text-red-800'
                      : selectedIncident.severidade === 'alta'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Severidade {selectedIncident.severidade}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {selectedIncident.horario || 'Recente'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 mb-1">
                {selectedIncident.tipo}
              </p>
              <p className="text-[11px] text-slate-600 leading-snug">
                {selectedIncident.resumo}
              </p>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Origem: {selectedIncident.origem || 'WhatsApp'}</span>
                <span className="font-mono">
                  {selectedIncident.lat.toFixed(5)}, {selectedIncident.lng.toFixed(5)}
                </span>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* HUD Superior Esquerdo: identificação do cruzamento e painel do agente */}
      <div className="absolute top-3 left-3 bottom-[17.5rem] z-10 flex flex-col gap-2 w-[min(100%-1.5rem,340px)] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <p className="text-[11px] font-semibold leading-snug">
            Africanos × Vicente Venâncio
            <span className="text-slate-400 font-medium"> · {is3DMode ? '3D' : '2D'}</span>
          </p>
        </div>

        {sim.modoColocar && (
          <div className="bg-blue-950/90 text-blue-50 text-xs px-3 py-2 rounded-lg border border-blue-500/50 shadow pointer-events-auto">
            Clique no lugar. A mancha colorida mostra onde passa a agir. Esc cancela.
          </div>
        )}

        {sim.agente && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PainelAgente agente={sim.agente} onFechar={() => sim.selecionar(null)} />
          </div>
        )}
      </div>

      {/* Controles de câmera no estilo Google Earth */}
      <CameraControls3D
        mapRef={mapRef}
        centro={{ lat: INTERSECTION_CENTER.lat, lng: INTERSECTION_CENTER.lng }}
        bearing={viewState.bearing}
        pitch={viewState.pitch}
        is3D={is3DMode}
        onToggle3D={handleToggle3DMode}
        predios3D={predios3D}
        onTogglePredios={() => setPredios3D((v) => !v)}
        vistas={VISTAS}
      />

      {/* Botões Flutuantes Superiores Direitos: Visão 3D + Simular Street View */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Botão Alternar Visão 3D / 2D */}
          <button
            type="button"
            onClick={handleToggle3DMode}
            className={`flex items-center gap-1.5 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-lg border transition-all duration-200 ${
              is3DMode
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                : 'bg-white/95 hover:bg-white text-slate-800 border-slate-300'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>{is3DMode ? 'Visão 3D Ativa' : 'Ativar Visão 3D'}</span>
          </button>

          {/* Botão Obrigatório: Simular Street View */}
          <button
            type="button"
            onClick={onOpenStreetView}
            className="group flex items-center gap-2 bg-gov-navy hover:bg-blue-900 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg border border-blue-400/30 transition-all duration-200 hover:scale-[1.02] active:scale-95"
          >
            <Eye className="w-4 h-4 text-blue-300 group-hover:text-white transition-colors" />
            <span>Ver a rua</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRecenter}
            title="Centralizar na Intersecção (Av. dos Africanos × Vicente Venâncio de Queiroga)"
            className="flex items-center gap-1.5 bg-white/95 hover:bg-white text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow border border-slate-200 transition"
          >
            <Crosshair className="w-3.5 h-3.5 text-blue-700" />
            <span>Focar Intersecção</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowRede((prev) => !prev);
              setFeicaoRede(null);
            }}
            aria-pressed={showRede}
            title="Mostrar/ocultar a rede de faixas"
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow border transition ${
              showRede
                ? 'bg-blue-700 text-white border-blue-800 hover:bg-blue-800'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Rede de faixas</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTokenInput((prev) => !prev)}
            title="Configurar YOUR_MAPBOX_TOKEN"
            className="flex items-center gap-1 bg-white/95 hover:bg-white text-slate-600 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow border border-slate-200 transition"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Token</span>
          </button>
        </div>

        {showTokenInput && (
          <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-200 w-72 text-xs">
            <p className="font-semibold text-slate-800 mb-1">
              Token Mapbox (`YOUR_MAPBOX_TOKEN`)
            </p>
            <p className="text-[11px] text-slate-500 mb-2">
              Cole seu token `pk.eyJ...` ou mantenha `YOUR_MAPBOX_TOKEN` para usar o mapa vetorial integrado.
            </p>
            <input
              type="text"
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              placeholder="pk.eyJ1Ijoi..."
              className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        )}
      </div>

      {/* Mancha, legenda e controles de tempo no canto inferior esquerdo */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2 items-start max-w-[min(100%-5.5rem,440px)]">
        <SeletorMancha mancha={mancha} onMancha={setMancha} erro={sim.erro} rodando={sim.rodando} pontosSim={pontosSim} />
        <ControlesTempo
          rodando={sim.rodando}
          onRodando={sim.setRodando}
          velocidade={sim.velocidade}
          onVelocidade={sim.setVelocidade}
          hora={sim.hora}
          onHora={sim.definirHora}
          onReiniciar={sim.reiniciar}
        />
      </div>
    </div>
  );
};
