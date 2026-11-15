/**
 * Cores do mapa.
 * Vermelho é infração, laranja é conflito, azul é intervenção.
 * O semáforo usa verde, amarelo e vermelho porque é o estado da luz.
 */

export const PALETA = {
  infracao: '#ef4444',
  conflito: '#f97316',
  intervencao: '#2563eb',
  carro: '#f8fafc',
  moto: '#4682b4',
  onibus: '#c4b5fd',
  pedestre: '#57534e',
  pele: '#f1d2b0',
  selecionado: '#22d3ee',
  luzVerde: '#22c55e',
  luzAmarela: '#facc15',
  luzVermelha: '#ef4444',
  farol: '#fef3c7',
  pisca: '#fbbf24',
  asfalto: '#3b4252',
  meioFio: '#e7e5e4',
  grama: '#3f8f4a',
  faixa: '#ffffff',
  movimento: '#e2e8f0',
  relatos: '#64748b',
} as const;

export const rgba = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
