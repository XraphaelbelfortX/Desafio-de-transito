import React, { useEffect, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl';
import {
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Building2,
  Video,
} from 'lucide-react';

/**
 * Controles de câmera no estilo Google Earth para o mapa do cruzamento:
 * bússola que mostra o rumo (clique = norte para cima), botão 2D/3D,
 * girar 45° em volta do cruzamento, inclinar, zoom, órbita automática
 * para apresentação e vistas prontas.
 */

export interface VistaPronta {
  id: string;
  nome: string;
  bearing: number;
  pitch: number;
  zoom: number;
}

interface CameraControls3DProps {
  mapRef: React.RefObject<MapRef>;
  centro: { lat: number; lng: number };
  bearing: number;
  pitch: number;
  is3D: boolean;
  onToggle3D: () => void;
  predios3D: boolean;
  onTogglePredios: () => void;
  vistas: VistaPronta[];
}

const DUR = 900;

export const CameraControls3D: React.FC<CameraControls3DProps> = ({
  mapRef,
  centro,
  bearing,
  pitch,
  is3D,
  onToggle3D,
  predios3D,
  onTogglePredios,
  vistas,
}) => {
  const [orbitando, setOrbitando] = useState(false);
  const [menuVistas, setMenuVistas] = useState(false);
  const raf = useRef<number | null>(null);

  const map = () => mapRef.current;

  // Órbita automática em volta do cruzamento (para a apresentação)
  useEffect(() => {
    const m = map();
    if (!orbitando || !m) return;
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduz) {
      setOrbitando(false);
      return;
    }
    let ultimo = performance.now();
    const passo = (agora: number) => {
      const dt = (agora - ultimo) / 1000;
      ultimo = agora;
      m.jumpTo({
        center: [centro.lng, centro.lat],
        bearing: m.getBearing() + dt * 8, // 8° por segundo
        pitch: Math.max(m.getPitch(), 55),
      });
      raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    // Qualquer interação do usuário interrompe a órbita
    const parar = () => setOrbitando(false);
    const canvas = m.getCanvas();
    canvas.addEventListener('mousedown', parar);
    canvas.addEventListener('touchstart', parar, { passive: true });
    canvas.addEventListener('wheel', parar, { passive: true });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      canvas.removeEventListener('mousedown', parar);
      canvas.removeEventListener('touchstart', parar);
      canvas.removeEventListener('wheel', parar);
    };
  }, [orbitando, centro.lat, centro.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const girar = (graus: number) =>
    map()?.easeTo({ center: [centro.lng, centro.lat], bearing: (map()?.getBearing() ?? 0) + graus, duration: DUR });
  const inclinar = (graus: number) =>
    map()?.easeTo({ pitch: Math.min(85, Math.max(0, (map()?.getPitch() ?? 0) + graus)), duration: DUR / 2 });
  const zoom = (d: number) => map()?.easeTo({ zoom: (map()?.getZoom() ?? 18) + d, duration: DUR / 2 });
  const norte = () => map()?.easeTo({ bearing: 0, duration: DUR });
  const irPara = (v: VistaPronta) => {
    setOrbitando(false);
    setMenuVistas(false);
    map()?.flyTo({ center: [centro.lng, centro.lat], bearing: v.bearing, pitch: v.pitch, zoom: v.zoom, duration: 1600, essential: true });
  };

  const btn =
    'w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 disabled:hover:bg-transparent';
  const grupo = 'bg-white/95 backdrop-blur rounded-full shadow-lg border border-slate-200 overflow-hidden';

  return (
    <div className="absolute bottom-14 right-3 z-20 flex flex-col items-end gap-2 select-none">
      {/* Vistas prontas */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuVistas((v) => !v)}
          aria-expanded={menuVistas}
          title="Vistas prontas do cruzamento"
          className={`${grupo} h-10 px-3 flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100`}
        >
          <Video className="w-4 h-4 text-blue-700" />
          Vistas
        </button>
        {menuVistas && (
          <div className="absolute bottom-12 right-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs">
            {vistas.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => irPara(v)}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 text-slate-800"
              >
                {v.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prédios 3D e órbita */}
      <div className={`${grupo} flex flex-col`}>
        <button
          type="button"
          onClick={onTogglePredios}
          aria-pressed={predios3D}
          title={predios3D ? 'Ocultar prédios 3D (OpenStreetMap)' : 'Mostrar prédios 3D (OpenStreetMap)'}
          className={`${btn} ${predios3D ? 'text-blue-700' : ''}`}
        >
          <Building2 className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => setOrbitando((o) => !o)}
          aria-pressed={orbitando}
          title={orbitando ? 'Parar órbita' : 'Orbitar em volta do cruzamento'}
          className={`${btn} ${orbitando ? 'text-blue-700' : ''}`}
        >
          {orbitando ? <Pause className="w-[18px] h-[18px]" /> : <Play className="w-[18px] h-[18px]" />}
        </button>
      </div>

      {/* Bússola + girar */}
      <div className={`${grupo} flex items-center`}>
        <button type="button" onClick={() => girar(-45)} title="Girar 45° para a esquerda" className={btn}>
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={norte}
          title={`Rumo ${Math.round(((bearing % 360) + 360) % 360)}° · clique para norte para cima`}
          aria-label="Apontar para o norte"
          className={btn}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 transition-transform"
            style={{ transform: `rotate(${-bearing}deg) rotateX(${Math.min(pitch, 70) * 0.6}deg)` }}
            aria-hidden="true"
          >
            <polygon points="12,2 15.5,12 8.5,12" fill="#dc2626" />
            <polygon points="12,22 15.5,12 8.5,12" fill="#94a3b8" />
            <text x="12" y="10.2" textAnchor="middle" fontSize="5" fontWeight="700" fill="#fff">N</text>
          </svg>
        </button>
        <button type="button" onClick={() => girar(45)} title="Girar 45° para a direita" className={btn}>
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Inclinação + 2D/3D */}
      <div className={`${grupo} flex flex-col items-center`}>
        <button type="button" onClick={() => inclinar(15)} disabled={pitch >= 84} title="Inclinar mais" className={btn}>
          <ChevronUp className="w-5 h-5" />
        </button>
        <span className="text-[10px] font-mono text-slate-500 tabular-nums" aria-live="polite">
          {Math.round(pitch)}°
        </span>
        <button type="button" onClick={() => inclinar(-15)} disabled={pitch <= 0.5} title="Inclinar menos" className={btn}>
          <ChevronDown className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onToggle3D}
          title={is3D ? 'Mudar para vista 2D (de cima)' : 'Mudar para vista 3D (inclinada)'}
          className="w-10 h-10 border-t border-slate-200 text-xs font-extrabold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          {is3D ? '2D' : '3D'}
        </button>
      </div>

      {/* Zoom */}
      <div className={`${grupo} flex items-center`}>
        <button type="button" onClick={() => zoom(-1)} title="Afastar" className={btn}>
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-slate-200" />
        <button type="button" onClick={() => zoom(1)} title="Aproximar" className={btn}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <p className="hidden md:block text-[10px] text-white/90 bg-slate-900/70 px-2 py-1 rounded">
        Ctrl + arrastar (ou botão direito) gira e inclina
      </p>
    </div>
  );
};
