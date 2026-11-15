export type SeverityLevel = 'baixa' | 'media' | 'alta' | 'critica';

export interface Incident {
  id: string;
  lat: number;
  lng: number;
  tipo: string;
  severidade: SeverityLevel;
  resumo: string;
  horario?: string;
  origem?: 'Agente SMTT' | 'Câmera CAM-01' | 'Registro SMTT';
  pesoHeatmap?: number;
}
