import React, { useMemo, useState } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  LayerProps,
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
} from 'lucide-react';
import { Incident } from '../types';
import { INTERSECTION_CENTER } from '../data/mockData';

/**
 * Substitua pelo seu token Mapbox real (ex: pk.eyJ1Ijoi...)
 * Enquanto estiver com o valor 'YOUR_MAPBOX_TOKEN', o componente utiliza automaticamente
 * o motor vetorial compatível para garantir renderização 100% funcional do Heatmap no MVP.
 */
export const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN';

interface TacticalMapProps {
  incidents: Incident[];
  activeInterventions: string[];
  riskReduction: number;
  onOpenStreetView: () => void;
  latestIncidentId: string | null;
}

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

  const [viewState, setViewState] = useState({
    latitude: INTERSECTION_CENTER.lat,
    longitude: INTERSECTION_CENTER.lng,
    zoom: INTERSECTION_CENTER.zoom,
    pitch: 35,
    bearing: -18,
  });

  const isPlaceholderToken =
    !customToken ||
    customToken.trim() === '' ||
    customToken.trim() === 'YOUR_MAPBOX_TOKEN';

  // GeoJSON dinâmico construído a partir do estado `incidents`, concentrando o calor
  // exatamente no entroncamento da Av. dos Africanos × Av. Vicente Venâncio de Queiroga
  const incidentsGeoJson = useMemo(() => {
    const coreIntersectionPoints = [
      { lng: -44.27128, lat: -2.55556, weight: 1.0 },
      { lng: -44.27126, lat: -2.55560, weight: 1.0 },
      { lng: -44.27130, lat: -2.55554, weight: 0.95 },
      { lng: -44.27123, lat: -2.55563, weight: 0.95 },
      { lng: -44.27134, lat: -2.55558, weight: 0.9 },
    ];

    return {
      type: 'FeatureCollection' as const,
      features: [
        ...incidents.map((incident) => ({
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
        ...coreIntersectionPoints.map((pt, index) => ({
          type: 'Feature' as const,
          properties: {
            id: `core-heat-${index}`,
            weight: pt.weight,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [pt.lng, pt.lat],
          },
        })),
      ],
    };
  }, [incidents]);

  // Camada nativa de Heatmap (Mapbox GL / react-map-gl)
  // A intensidade reduz visualmente conforme o gestor ativa intervenções táticas (estilo SimCity)
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
          13,
          1.6 * mitigationFactor,
          17,
          3.4 * mitigationFactor,
          20,
          4.2 * mitigationFactor,
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(37, 99, 235, 0)',
          0.18,
          'rgba(59, 130, 246, 0.45)',
          0.38,
          'rgba(250, 204, 21, 0.78)',
          0.62,
          'rgba(249, 115, 22, 0.90)',
          0.82,
          'rgba(239, 68, 68, 0.96)',
          1,
          'rgba(153, 27, 27, 1)',
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          36,
          17.5,
          78,
          19,
          110,
        ],
        'heatmap-opacity': 0.88,
      },
    };
  }, [riskReduction]);

  // Geometria de Urbanismo Tático (estilo SimCity) alinhada ao cruzamento real:
  // Av. dos Africanos × Av. Vicente Venâncio de Queiroga (-2.55556, -44.27128)
  const ciclofaixaGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'Ciclofaixa Vermelha - Av. dos Africanos × Vicente Venâncio de Queiroga' },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-44.27182, -2.55534],
              [-44.27148, -2.55548],
              [-44.27128, -2.55556],
              [-44.27105, -2.55565],
              [-44.27072, -2.55578],
            ],
          },
        },
      ],
    }),
    []
  );

  // Avanços de Calçada (Neckdowns) nas duas esquinas da boca da Av. Vicente Venâncio de Queiroga
  const neckdownGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'Avanço de Calçada - Esquina Oeste (Vicente Venâncio)' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [-44.27141, -2.55556],
                [-44.27131, -2.55559],
                [-44.27134, -2.55568],
                [-44.27144, -2.55565],
                [-44.27141, -2.55556],
              ],
            ],
          },
        },
        {
          type: 'Feature' as const,
          properties: { name: 'Avanço de Calçada - Esquina Leste (Vicente Venâncio)' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [-44.27122, -2.55562],
                [-44.27112, -2.55566],
                [-44.27115, -2.55575],
                [-44.27125, -2.55571],
                [-44.27122, -2.55562],
              ],
            ],
          },
        },
      ],
    }),
    []
  );

  // Linha de Tachões Refletivos exatamente na garganta da intersecção
  const tachoesCoords: [number, number][] = useMemo(
    () => [
      [-44.27146, -2.55550],
      [-44.27139, -2.55553],
      [-44.27132, -2.55556],
      [-44.27125, -2.55559],
      [-44.27118, -2.55562],
      [-44.27111, -2.55565],
    ],
    []
  );

  const handleRecenter = () => {
    setViewState({
      latitude: INTERSECTION_CENTER.lat,
      longitude: INTERSECTION_CENTER.lng,
      zoom: INTERSECTION_CENTER.zoom,
      pitch: 35,
      bearing: -18,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[430px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        // Quando YOUR_MAPBOX_TOKEN ainda não foi trocado, usa motor vetorial compatível para não dar tela em branco
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
        <NavigationControl position="bottom-right" showCompass={true} />

        {/* Camada Nativa de Heatmap de Quase-Acidentes centrada na intersecção */}
        <Source id="incidents-source" type="geojson" data={incidentsGeoJson}>
          <Layer {...heatmapLayer} />
        </Source>

        {/* Camadas SimCity de Intervenções Táticas Ativas na Intersecção */}
        {activeInterventions.includes('neckdown') && (
          <Source id="neckdown-source" type="geojson" data={neckdownGeoJson}>
            <Layer
              id="neckdown-fill"
              type="fill"
              paint={{
                'fill-color': '#10b981',
                'fill-opacity': 0.6,
              }}
            />
            <Layer
              id="neckdown-outline"
              type="line"
              paint={{
                'line-color': '#047857',
                'line-width': 2.5,
                'line-dasharray': [2, 1],
              }}
            />
          </Source>
        )}

        {activeInterventions.includes('ciclofaixa') && (
          <Source id="ciclofaixa-source" type="geojson" data={ciclofaixaGeoJson}>
            <Layer
              id="ciclofaixa-border"
              type="line"
              paint={{
                'line-color': '#ffffff',
                'line-width': 12,
                'line-opacity': 0.9,
              }}
            />
            <Layer
              id="ciclofaixa-line"
              type="line"
              paint={{
                'line-color': '#dc2626',
                'line-width': 8,
                'line-opacity': 0.95,
              }}
            />
          </Source>
        )}

        {/* Tachões Refletivos no Mapa quando ativados */}
        {activeInterventions.includes('tachao') &&
          tachoesCoords.map((coord, idx) => (
            <Marker
              key={`tachao-${idx}`}
              longitude={coord[0]}
              latitude={coord[1]}
              anchor="center"
            >
              <div
                title="Tachão Refletivo (Tartaruga) SINAPI"
                className="w-3.5 h-3.5 rounded-sm bg-amber-400 border-2 border-slate-900 shadow-[0_0_10px_rgba(251,191,36,0.95)] animate-pulse"
              />
            </Marker>
          ))}

        {/* Marcadores Interativos de Incidentes (Quase-Acidentes) */}
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
                  className={`absolute w-8 h-8 rounded-full opacity-40 animate-ping ${
                    incident.severidade === 'critica'
                      ? 'bg-red-500'
                      : 'bg-orange-400'
                  }`}
                />
                <span
                  className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 text-white shadow-md ${badgeColor}`}
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

      {/* HUD Superior Esquerdo: Identificação Geográfica da Intersecção */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-md pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
              Intersecção Crítica Monitorada • São Luís/MA
            </span>
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
            Av. dos Africanos × Av. Vicente Venâncio de Queiroga
          </h2>
          <p className="text-[11px] text-slate-300 mt-0.5 font-mono">
            Lat: {INTERSECTION_CENTER.lat}, Lng: {INTERSECTION_CENTER.lng} •{' '}
            <strong className="text-amber-300">{incidents.length} relatos ativos</strong>
          </p>
        </div>

        {/* Indicador de Obras Táticas Ativas no Mapa */}
        {activeInterventions.length > 0 && (
          <div className="bg-emerald-950/90 backdrop-blur-md text-emerald-100 px-3 py-2 rounded-lg border border-emerald-700/70 shadow-md flex items-center gap-2 text-xs pointer-events-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Modo SimCity Ativo:</strong> {activeInterventions.length}{' '}
              {activeInterventions.length === 1
                ? 'intervenção projetada'
                : 'intervenções projetadas'}{' '}
              no cruzamento (-{riskReduction}% risco)
            </span>
          </div>
        )}
      </div>

      {/* Botão Flutuante Obrigatório: "Simular Street View" */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onOpenStreetView}
          className="group flex items-center gap-2 bg-gov-navy hover:bg-blue-900 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg border border-blue-400/30 transition-all duration-200 hover:scale-[1.02] active:scale-95"
        >
          <Eye className="w-4 h-4 text-blue-300 group-hover:text-white transition-colors" />
          <span>Simular Street View</span>
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-blue-500/30 text-blue-200 rounded border border-blue-400/30 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> 3D IA
          </span>
        </button>

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
