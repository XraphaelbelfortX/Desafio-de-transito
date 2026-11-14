export type SeverityLevel = 'baixa' | 'media' | 'alta' | 'critica';

export type InterventionIconName = 'ShieldAlert' | 'Bike' | 'Snail';

export interface Incident {
  id: string;
  lat: number;
  lng: number;
  tipo: string;
  severidade: SeverityLevel;
  resumo: string;
  horario?: string;
  origem?: 'WhatsApp Cidadão' | 'Agente SMTT' | 'Sensor Inteligente';
  pesoHeatmap?: number;
}

export interface Intervention {
  id: 'tachao' | 'ciclofaixa' | 'neckdown';
  nome: string;
  custo: number;
  reducaoRisco: number;
  tempoDias: number;
  icon: InterventionIconName;
  normaReferencia: string;
  codigoSinapi: string;
  descricaoTatica: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  incidentResumo?: string;
  timestamp: string;
}
