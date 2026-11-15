/**
 * Carregador mínimo da API do Google Maps (Street View), sem depender de pacote externo.
 * Injeta o script uma única vez e reaproveita a mesma Promise em chamadas seguintes.
 */

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

declare global {
  interface Window {
    google?: typeof google;
  }
}

let carregamento: Promise<typeof google> | null = null;

export function carregarGoogleMaps(): Promise<typeof google> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (carregamento) return carregamento;
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY não configurada'));
  }

  carregamento = new Promise((resolve, reject) => {
    const callbackName = '__guardiaoViarioGoogleMapsPronto';
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Google Maps carregou sem o objeto esperado'));
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google Maps'));
    document.head.appendChild(script);
  });
  return carregamento;
}
