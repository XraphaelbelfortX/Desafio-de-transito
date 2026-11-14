import React, { useMemo, useState, useEffect } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  LayerProps,
  MapLayerMouseEvent,
} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Eye,
  AlertTriangle,
  MapPin,
  Layers,
  Crosshair,
  Sparkles,
  CheckCircle2,
  KeyRound,
  Box,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import { Incident } from '../types';
import { INTERSECTION_CENTER } from '../data/mockData';

/**
 * Substitua pelo seu token Mapbox real (ex: pk.eyJ1Ijoi...)
 * Enquanto estiver com o valor 'YOUR_MAPBOX_TOKEN', o componente utiliza automaticamente
 * o motor vetorial compatível para garantir renderização 100% funcional do Heatmap e 3D no MVP.
 */
export const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN';

interface TacticalMapProps {
  incidents: Incident[];
  activeInterventions: string[];
  riskReduction: number;
  onOpenStreetView: () => void;
  latestIncidentId: string | null;
}

interface Custom3DElement {
  id: string;
  lng: number;
  lat: number;
  kind: 'tachao' | 'balizador';
}

// Helper para criar um pequeno polígono 3D (caixa/cilindro extrudado em metros) ao redor de [lng, lat]
const createBoxPolygon = (
  lng: number,
  lat: number,
  halfWidthDeg: number,
  halfHeightDeg: number,
  heightMeters: number,
  color: string
) => ({
  type: 'Feature' as const,
  properties: {
    height: heightMeters,
    base: 0,
    color,
  },
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [lng - halfWidthDeg, lat - halfHeightDeg],
        [lng + halfWidthDeg, lat - halfHeightDeg],
        [lng + halfWidthDeg, lat + halfHeightDeg],
        [lng - halfWidthDeg, lat + halfHeightDeg],
        [lng - halfWidthDeg, lat - halfHeightDeg],
      ],
    ],
  },
});

export const TacticalMap: React.FC<TacticalMapProps> = ({
  incidents,
  activeInterventions,
  riskReduction,
  onOpenStreetView,
  latestIncidentId,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [customToken, setCustomToken] = useState<string>(MAPBOX_TOKEN);
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Estados da Visão 3D Interativa (SimCity) e Construtor de Tartarugas 3D
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [placementTool, setPlacementTool] = useState<'none' | 'tachao' | 'balizador'>('none');
  const [custom3DElements, setCustom3DElements] = useState<Custom3DElement[]>([]);

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
      setViewState((vs) => ({
        ...vs,
        latitude: INTERSECTION_CENTER.lat,
        longitude: INTERSECTION_CENTER.lng,
        zoom: next ? 18.4 : 17.8,
        pitch: next ? 62 : 0,
        bearing: next ? -28 : 0,
      }));
      if (!next) setPlacementTool('none');
      return next;
    });
  };

  // Clique no mapa para adicionar Tartarugas 3D ou Balizadores 3D manualmente na pista
  const handleMapClick = (e: MapLayerMouseEvent) => {
    if (placementTool === 'none') return;
    const { lng, lat } = e.lngLat;

    if (placementTool === 'tachao') {
      // Cria uma fileira tática de 3 tartarugas 3D no ponto clicado
      const offsets = [-0.000018, 0, 0.000018];
      const newStuds: Custom3DElement[] = offsets.map((off, idx) => ({
        id: `custom-tachao-${Date.now()}-${idx}`,
        lng: lng + off,
        lat: lat + off * 0.7,
        kind: 'tachao',
      }));
      setCustom3DElements((prev) => [...prev, ...newStuds]);
    } else if (placementTool === 'balizador') {
      setCustom3DElements((prev) => [
        ...prev,
        {
          id: `custom-balizador-${Date.now()}`,
          lng,
          lat,
          kind: 'balizador',
        },
      ]);
    }
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
  const heatmapLayer: LayerProps = useMemo(() => {
    const mitigationFactor = Math.max(0.28, 1 - riskReduction / 115);
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
          1.8 * mitigationFactor,
          18,
          3.6 * mitigationFactor,
          20,
          4.5 * mitigationFactor,
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
  }, [riskReduction, is3DMode]);

  // Coordenadas das Tartarugas (Tachões Refletivos) nas duas pistas e no retorno dentro do círculo vermelho
  const tachoesCoords: [number, number][] = useMemo(
    () => [
      // Linha de contenção na agulha do retorno
      [-44.27067, -2.55485],
      [-44.27065, -2.55490],
      [-44.27062, -2.55495],
      [-44.27060, -2.55500],
      // Linha de aproximação Pista Sul (Vicente Venâncio)
      [-44.27061, -2.55505],
      [-44.27057, -2.55508],
      [-44.27053, -2.55511],
      // Linha de segregação na travessia central
      [-44.27052, -2.55501],
      [-44.27049, -2.55498],
      [-44.27046, -2.55495],
      // Linha de aproximação Pista Norte (Rua Minerva)
      [-44.27043, -2.55491],
      [-44.27039, -2.55488],
      [-44.27035, -2.55485],
    ],
    []
  );

  // Polígonos 3D Extrudados (fill-extrusion) para as Tartarugas + Balizadores + Elementos adicionados pelo usuário
  const tactical3DObjectsGeoJson = useMemo(() => {
    const features = [];

    // 1. Tartarugas do Catálogo (quando o toggle 'tachao' está ativo)
    if (activeInterventions.includes('tachao')) {
      for (const [lng, lat] of tachoesCoords) {
        // Base preta/cinza do tachão 3D + topo amarelo refletivo extrudado
        features.push(createBoxPolygon(lng, lat, 0.000009, 0.000009, 0.55, '#facc15'));
      }
    }

    // 2. Balizadores 3D sobre os Avanços de Calçada (quando o toggle 'neckdown' está ativo)
    if (activeInterventions.includes('neckdown')) {
      const bollardCoords: [number, number][] = [
        [-44.27063, -2.55506],
        [-44.27057, -2.55506],
        [-44.27057, -2.55511],
        [-44.27042, -2.55485],
        [-44.27036, -2.55485],
        [-44.27036, -2.55490],
      ];
      for (const [lng, lat] of bollardCoords) {
        features.push(createBoxPolygon(lng, lat, 0.000006, 0.000006, 1.8, '#f59e0b'));
      }
    }

    // 3. Tartarugas e Balizadores 3D adicionados interativamente com clique no mapa
    for (const item of custom3DElements) {
      if (item.kind === 'tachao') {
        features.push(
          createBoxPolygon(item.lng, item.lat, 0.000009, 0.000009, 0.6, '#fde047')
        );
      } else {
        features.push(
          createBoxPolygon(item.lng, item.lat, 0.000007, 0.000007, 1.9, '#ef4444')
        );
      }
    }

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [activeInterventions, tachoesCoords, custom3DElements]);

  // Geometria da Ciclofaixa Vermelha (Suporta 2D e Extrusão 3D)
  const ciclofaixaGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'Ciclofaixa Central - Av. dos Africanos' },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-44.27076, -2.55481],
              [-44.27049, -2.55498],
              [-44.27024, -2.55514],
            ],
          },
        },
        {
          type: 'Feature' as const,
          properties: { name: 'Travessia Cicloviária - Vicente Venâncio × Rua Minerva' },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-44.27064, -2.55514],
              [-44.27049, -2.55498],
              [-44.27034, -2.55482],
            ],
          },
        },
      ],
    }),
    []
  );

  // Avanços de Calçada (Neckdowns) com suporte a volume 3D (`fill-extrusion`)
  const neckdownGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {
            name: 'Avanço de Calçada 3D - Esquina Pista Sul (Vicente Venâncio)',
            height: 0.9,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [-44.27065, -2.55505],
                [-44.27055, -2.55505],
                [-44.27055, -2.55513],
                [-44.27065, -2.55513],
                [-44.27065, -2.55505],
              ],
            ],
          },
        },
        {
          type: 'Feature' as const,
          properties: {
            name: 'Avanço de Calçada 3D - Esquina Pista Norte (Rua Minerva)',
            height: 0.9,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [-44.27044, -2.55484],
                [-44.27034, -2.55484],
                [-44.27034, -2.55492],
                [-44.27044, -2.55492],
                [-44.27044, -2.55484],
              ],
            ],
          },
        },
      ],
    }),
    []
  );

  const handleRecenter = () => {
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
      className={`relative w-full h-full min-h-[450px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 ${
        placementTool !== 'none' ? 'cursor-crosshair' : ''
      }`}
    >
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        maxPitch={80}
        mapLib={(isPlaceholderToken ? maplibregl : undefined) as never}
        mapboxAccessToken={isPlaceholderToken ? undefined : customToken}
        mapStyle={
          isPlaceholderToken
            ? 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
            : 'mapbox://styles/mapbox/streets-v12'
        }
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={true} visualizePitch={true} />

        {/* Camada Nativa Única de Heatmap de Quase-Acidentes centrada nos alertas */}
        <Source id="incidents-source" type="geojson" data={incidentsGeoJson}>
          <Layer {...heatmapLayer} />
        </Source>

        {/* Avanço de Calçada (Neckdown) em 2D e Extrusão 3D Volumétrica */}
        {activeInterventions.includes('neckdown') && (
          <Source id="neckdown-source" type="geojson" data={neckdownGeoJson}>
            <Layer
              id="neckdown-extrusion-3d"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': '#10b981',
                'fill-extrusion-height': is3DMode ? ['get', 'height'] : 0.1,
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.85,
              }}
            />
            <Layer
              id="neckdown-outline"
              type="line"
              paint={{
                'line-color': '#047857',
                'line-width': 2.5,
              }}
            />
          </Source>
        )}

        {/* Ciclofaixa Vermelha no Cruzamento */}
        {activeInterventions.includes('ciclofaixa') && (
          <Source id="ciclofaixa-source" type="geojson" data={ciclofaixaGeoJson}>
            <Layer
              id="ciclofaixa-border"
              type="line"
              paint={{
                'line-color': '#ffffff',
                'line-width': 14,
                'line-opacity': 0.92,
              }}
            />
            <Layer
              id="ciclofaixa-line"
              type="line"
              paint={{
                'line-color': '#dc2626',
                'line-width': 10,
                'line-opacity': 0.96,
              }}
            />
          </Source>
        )}

        {/* Camada Volumétrica 3D (fill-extrusion) para Tartarugas (Tachões) e Balizadores */}
        <Source id="tactical-3d-objects" type="geojson" data={tactical3DObjectsGeoJson}>
          <Layer
            id="tactical-3d-extrusion"
            type="fill-extrusion"
            paint={{
              'fill-extrusion-color': ['get', 'color'],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'base'],
              'fill-extrusion-opacity': 0.95,
            }}
          />
        </Source>

        {/* Marcadores Luminosos das Tartarugas (Catálogo + Adicionadas no Mapa 3D) */}
        {activeInterventions.includes('tachao') &&
          tachoesCoords.map((coord, idx) => (
            <Marker
              key={`tachao-${idx}`}
              longitude={coord[0]}
              latitude={coord[1]}
              anchor="center"
            >
              <div
                title="Tartaruga / Tachão Refletivo 3D (SINAPI)"
                className="w-3.5 h-3.5 rounded-sm bg-amber-400 border-2 border-slate-900 shadow-[0_0_12px_rgba(251,191,36,1)] transform rotate-45"
              />
            </Marker>
          ))}

        {custom3DElements.map((item) => (
          <Marker
            key={item.id}
            longitude={item.lng}
            latitude={item.lat}
            anchor="center"
          >
            <div
              title={
                item.kind === 'tachao'
                  ? 'Tartaruga 3D adicionada pelo gestor'
                  : 'Balizador 3D adicionado pelo gestor'
              }
              className={
                item.kind === 'tachao'
                  ? 'w-3.5 h-3.5 rounded-sm bg-yellow-300 border-2 border-slate-950 shadow-[0_0_14px_rgba(253,224,71,1)] transform rotate-45'
                  : 'w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg'
              }
            />
          </Marker>
        ))}

        {/* Marcadores Interativos de Alertas (Quase-Acidentes) exatamente sobre a mancha de calor */}
        {incidents.map((incident) => {
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
        {selectedIncident && (
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
                <span>Origem: {selectedIncident.origem || 'WhatsApp IA'}</span>
                <span className="font-mono">
                  {selectedIncident.lat.toFixed(5)}, {selectedIncident.lng.toFixed(5)}
                </span>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* HUD Superior Esquerdo: Identificação + Ferramenta Construtor 3D de Tartarugas */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-md pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
              {is3DMode ? 'Visão 3D Tática (Pitch 60°) • SimCity' : 'Visão 2D Plana • São Luís/MA'}
            </span>
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
            Av. dos Africanos × Av. Vicente Venâncio de Queiroga
          </h2>
          <p className="text-[11px] text-slate-300 mt-0.5 font-mono">
            Lat: {INTERSECTION_CENTER.lat}, Lng: {INTERSECTION_CENTER.lng} •{' '}
            <strong className="text-amber-300">{incidents.length} alertas no cruzamento</strong>
          </p>
        </div>

        {/* Barra de Simulação Interativa 3D: Adicionar Tartarugas / Balizadores clicando na pista */}
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-xl border border-blue-500/40 shadow-lg pointer-events-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              Simulador 3D na Via (Clique para Inserir):
            </span>
            {custom3DElements.length > 0 && (
              <button
                type="button"
                onClick={() => setCustom3DElements([])}
                className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Limpar ({custom3DElements.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!is3DMode) handleToggle3DMode();
                setPlacementTool((prev) => (prev === 'tachao' ? 'none' : 'tachao'));
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border ${
                placementTool === 'tachao'
                  ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Tartarugas 3D</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!is3DMode) handleToggle3DMode();
                setPlacementTool((prev) =>
                  prev === 'balizador' ? 'none' : 'balizador'
                );
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border ${
                placementTool === 'balizador'
                  ? 'bg-red-600 text-white border-red-300 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                  : 'bg-slate-800 hover:bg-slate-700 text-red-300 border-slate-700'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Balizador 3D</span>
            </button>
          </div>

          {placementTool !== 'none' && (
            <p className="text-[10px] text-emerald-300 font-medium">
              Modo ativo: clique em qualquer ponto do cruzamento no mapa para implantar{' '}
              {placementTool === 'tachao'
                ? 'uma fileira de tartarugas refletivas 3D'
                : 'um balizador cilíndrico 3D'}
              !
            </p>
          )}
        </div>

        {/* Indicador de Obras Táticas Ativas no Mapa */}
        {activeInterventions.length > 0 && (
          <div className="bg-emerald-950/90 backdrop-blur-md text-emerald-100 px-3 py-2 rounded-lg border border-emerald-700/70 shadow-md flex items-center gap-2 text-xs pointer-events-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Modo SimCity Ativo:</strong> {activeInterventions.length}{' '}
              {activeInterventions.length === 1
                ? 'intervenção 3D projetada'
                : 'intervenções 3D projetadas'}{' '}
              no cruzamento (-{riskReduction}% risco)
            </span>
          </div>
        )}
      </div>

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
            <span>Simular Street View</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-blue-500/30 text-blue-200 rounded border border-blue-400/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Rua 3D
            </span>
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

      {/* Legenda do Heatmap na base esquerda do mapa */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md flex flex-wrap items-center gap-4 text-[11px] text-slate-700">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Layers className="w-3.5 h-3.5 text-blue-800" />
          <span>Mancha de Calor (Quase-Acidentes):</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Moderado</span>
          <div className="w-24 h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-600" />
          <span className="text-[10px] font-bold text-red-700">Crítico</span>
        </div>
      </div>
    </div>
  );
};
