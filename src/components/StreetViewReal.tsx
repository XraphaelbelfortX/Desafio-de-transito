import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { carregarGoogleMaps, GOOGLE_MAPS_API_KEY } from '../lib/googleMaps';
import { DEFINICAO, type Intervencao } from '../sim/intervencoes';
import { COR_ZONA } from './sim/zonasIntervencao';
import type { Incident } from '../types';

type Status = 'sem-chave' | 'carregando' | 'pronto' | 'sem-cobertura' | 'erro';

const COR_INCIDENTE: Record<Incident['severidade'], string> = {
  critica: '#ef4444',
  alta: '#fb923c',
  media: '#facc15',
  baixa: '#8a97b0',
};

interface Props {
  centro: { lat: number; lng: number };
  incidents: Incident[];
  intervencoes: Intervencao[];
}

/**
 * Street View real do Google (foto do cruzamento) com pins das intervenções e das ocorrências
 * sobrepostos na posição certa — o Google cuida da projeção em perspectiva.
 * Sem VITE_GOOGLE_MAPS_API_KEY configurada, mostra a explicação em vez de tentar carregar.
 */
export const StreetViewReal: React.FC<Props> = ({ centro, incidents, intervencoes }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const marcadoresRef = useRef<google.maps.Marker[]>([]);
  const [status, setStatus] = useState<Status>(GOOGLE_MAPS_API_KEY ? 'carregando' : 'sem-chave');

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !divRef.current) return;
    let vivo = true;

    carregarGoogleMaps()
      .then((g) => {
        if (!vivo || !divRef.current) return;
        const servico = new g.maps.StreetViewService();
        servico.getPanorama({ location: centro, radius: 100 }, (dados, estado) => {
          if (!vivo) return;
          if (estado !== g.maps.StreetViewStatus.OK || !dados?.location) {
            setStatus('sem-cobertura');
            return;
          }
          const panorama = new g.maps.StreetViewPanorama(divRef.current!, {
            pano: dados.location.pano,
            pov: { heading: 0, pitch: 0 },
            zoom: 0,
            addressControl: false,
            fullscreenControl: false,
            motionTracking: false,
            motionTrackingControl: false,
          });

          const marcar = (lat: number, lng: number, titulo: string, cor: string) => {
            const m = new g.maps.Marker({
              position: { lat, lng },
              map: panorama,
              title: titulo,
              icon: {
                path: g.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: cor,
                fillOpacity: 1,
                strokeColor: '#0b1220',
                strokeWeight: 2,
              },
            });
            marcadoresRef.current.push(m);
          };

          for (const i of intervencoes) marcar(i.lat, i.lng, DEFINICAO[i.tipo].nome, COR_ZONA[i.tipo]);
          for (const inc of incidents) marcar(inc.lat, inc.lng, inc.tipo, COR_INCIDENTE[inc.severidade]);

          setStatus('pronto');
        });
      })
      .catch(() => vivo && setStatus('erro'));

    return () => {
      vivo = false;
      marcadoresRef.current.forEach((m) => m.setMap(null));
      marcadoresRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro.lat, centro.lng, incidents, intervencoes]);

  if (status === 'sem-chave') {
    return (
      <div className="w-full h-[390px] flex flex-col items-center justify-center gap-2 text-center px-6 bg-gv-bg">
        <AlertTriangle className="w-6 h-6 text-gv-amber" />
        <p className="text-sm font-bold text-gv-ink">Street View real desligada</p>
        <p className="text-xs text-gv-muted max-w-md">
          Defina <code className="text-gv-cyan">VITE_GOOGLE_MAPS_API_KEY</code> num arquivo <code className="text-gv-cyan">.env</code> (veja{' '}
          <code className="text-gv-cyan">.env.example</code>) para trocar a ilustração por uma foto real do Google Street
          View com os pins das intervenções e das ocorrências em cima.
        </p>
      </div>
    );
  }

  if (status === 'sem-cobertura') {
    return (
      <div className="w-full h-[390px] flex flex-col items-center justify-center gap-2 text-center px-6 bg-gv-bg">
        <AlertTriangle className="w-6 h-6 text-gv-amber" />
        <p className="text-sm font-bold text-gv-ink">Sem foto do Street View perto daqui</p>
        <p className="text-xs text-gv-muted">O Google não tem uma captura de rua a menos de 100 m deste ponto.</p>
      </div>
    );
  }

  if (status === 'erro') {
    return (
      <div className="w-full h-[390px] flex flex-col items-center justify-center gap-2 text-center px-6 bg-gv-bg">
        <AlertTriangle className="w-6 h-6 text-gv-red" />
        <p className="text-sm font-bold text-gv-ink">Não deu para carregar o Google Maps</p>
        <p className="text-xs text-gv-muted">Confira a chave em VITE_GOOGLE_MAPS_API_KEY e se o faturamento está ativo no Google Cloud.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[390px] bg-gv-bg">
      <div ref={divRef} className="absolute inset-0" />
      {status === 'carregando' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-gv-muted text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando a rua…
        </div>
      )}
    </div>
  );
};
