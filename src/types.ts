export type SeverityLevel = 'baixa' | 'media' | 'alta' | 'critica';

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

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  incidentResumo?: string;
  timestamp: string;
}
