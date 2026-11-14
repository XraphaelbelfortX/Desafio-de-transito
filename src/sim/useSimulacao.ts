import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { lerRede, type Rede } from './rede';
import { Motor, type Agente, type Decisao, type Metricas, type TipoAgente, type TipoInfracao } from './motor';
import {
  analisar,
  TEMPOS_PADRAO,
  type AnaliseIntervencao,
  type Intervencao,
  type TemposSemaforo,
  type TipoIntervencao,
} from './intervencoes';
import { orcarCenario, paraLocais, type OrcamentoCenario } from './cenarios';
import { paraKmh } from './geometria';

export type Velocidade = 1 | 5 | 20;
export type IdCenario = 'A' | 'B';

/** Retrato do agente para o painel (cópia simples, atualizada 4 vezes por segundo). */
export interface AgenteVisao {
  id: number;
  tipo: TipoAgente;
  estado: string;
  vKmh: number;
  vDesKmh: number;
  imp: number;
  infrator: boolean;
  infracoes: TipoInfracao[];
  decisoes: Decisao[];
  desejo: string | null;
  rota: string;
  espera: number;
  naVia: boolean;
}

export interface PulsoConflito {
  realT: number;
  x: number;
  y: number;
  grave: boolean;
}

export interface Simulacao {
  pronto: boolean;
  erro: string | null;
  rede: Rede | null;
  motorRef: MutableRefObject<Motor | null>;
  assinar: (fn: () => void) => () => void;
  pulsos: MutableRefObject<PulsoConflito[]>;
  rodando: boolean;
  setRodando: (v: boolean) => void;
  velocidade: Velocidade;
  setVelocidade: (v: Velocidade) => void;
  hora: number;
  definirHora: (h: number) => void;
  reiniciar: () => void;
  metricas: Metricas | null;
  nAgentes: number;
  intervencoes: Intervencao[];
  analises: Map<string, AnaliseIntervencao>;
  orcamento: OrcamentoCenario | null;
  adicionar: (tipo: TipoIntervencao, lng: number, lat: number) => void;
  mover: (id: string, lng: number, lat: number) => void;
  remover: (id: string) => void;
  atualizarTempos: (id: string, tempos: TemposSemaforo) => void;
  carregar: (ints: Intervencao[]) => void;
  limpar: () => void;
  modoColocar: TipoIntervencao | null;
  setModoColocar: (t: TipoIntervencao | null) => void;
  intervencaoSelecionada: string | null;
  selecionarIntervencao: (id: string | null) => void;
  selecionadoId: number | null;
  selecionar: (id: number | null) => void;
  agente: AgenteVisao | null;
  cenarios: Record<IdCenario, Intervencao[] | null>;
  salvarCenario: (id: IdCenario) => void;
  apagarCenario: (id: IdCenario) => void;
}

const CHAVE = 'guardiao-viario:simulador:v1';

const lerSalvo = (): { intervencoes: Intervencao[]; cenarios: Record<IdCenario, Intervencao[] | null> } => {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) {
      const d = JSON.parse(bruto);
      return { intervencoes: d.intervencoes ?? [], cenarios: { A: d.cenarios?.A ?? null, B: d.cenarios?.B ?? null } };
    }
  } catch {
    /* armazenamento indisponível: começa vazio */
  }
  return { intervencoes: [], cenarios: { A: null, B: null } };
};

const visao = (a: Agente, naVia: boolean): AgenteVisao => ({
  id: a.id,
  tipo: a.tipo,
  estado: a.estado,
  vKmh: a.tipo === 'pedestre' ? a.v * 3.6 : paraKmh(a.v),
  vDesKmh: paraKmh(a.vDes),
  imp: a.imp,
  infrator: a.infrator,
  infracoes: [...a.infracoes],
  decisoes: a.decisoes.map((d) => ({ ...d, fatores: d.fatores?.map((f) => ({ ...f })) })),
  desejo: a.desejo?.descricao ?? null,
  rota: a.rota.descricao,
  espera: a.esperaTotal,
  naVia,
});

let seq = 0;
const novoId = (tipo: string) => `${tipo}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function useSimulacao(): Simulacao {
  const salvo = useMemo(lerSalvo, []);
  const [rede, setRede] = useState<Rede | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const motorRef = useRef<Motor | null>(null);
  const ouvintes = useRef(new Set<() => void>());
  const pulsos = useRef<PulsoConflito[]>([]);
  const [rodando, setRodando] = useState(true);
  // sem controles de tempo na tela ainda: roda a 20× para as métricas do painel firmarem rápido
  const [velocidade, setVelocidade] = useState<Velocidade>(20);
  const [hora, setHora] = useState(7);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [nAgentes, setNAgentes] = useState(0);
  const [intervencoes, setIntervencoes] = useState<Intervencao[]>(salvo.intervencoes);
  const [cenarios, setCenarios] = useState<Record<IdCenario, Intervencao[] | null>>(salvo.cenarios);
  const [modoColocar, setModoColocar] = useState<TipoIntervencao | null>(null);
  const [intervencaoSelecionada, selecionarIntervencao] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [agente, setAgente] = useState<AgenteVisao | null>(null);
  const rodandoRef = useRef(rodando);
  const velocidadeRef = useRef(velocidade);
  const selecionadoRef = useRef<number | null>(null);
  rodandoRef.current = rodando;
  velocidadeRef.current = velocidade;

  // carrega a rede de faixas
  useEffect(() => {
    let vivo = true;
    fetch('/data/rede.geojson')
      .then((r) => {
        if (!r.ok) throw new Error(`não foi possível ler /data/rede.geojson (${r.status})`);
        return r.json();
      })
      .then((g) => {
        if (!vivo) return;
        const rd = lerRede(g);
        const m = new Motor(rd, paraLocais(rd, salvo.intervencoes), (Date.now() % 100000) + 1);
        m.definirHora(7);
        motorRef.current = m;
        setRede(rd);
      })
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [salvo]);

  // laço de animação: avança o motor e avisa as camadas do mapa a cada quadro
  useEffect(() => {
    if (!rede) return;
    let raf = 0;
    let ultimo = performance.now();
    let ultimoUI = 0;
    let vistos = motorRef.current?.eventos.length ?? 0;
    const quadro = (agora: number) => {
      const m = motorRef.current;
      if (m) {
        const real = Math.min(0.1, (agora - ultimo) / 1000);
        if (rodandoRef.current) {
          const total = real * velocidadeRef.current;
          const n = Math.max(1, Math.ceil(total / 0.1));
          for (let i = 0; i < n; i++) m.passo(total / n);
        }
        if (m.eventos.length < vistos) vistos = 0;
        for (; vistos < m.eventos.length; vistos++) {
          const e = m.eventos[vistos];
          if (e.tipo === 'conflito') pulsos.current.push({ realT: agora, x: e.x, y: e.y, grave: e.grave });
        }
        if (pulsos.current.length > 60) pulsos.current.splice(0, pulsos.current.length - 60);
        ouvintes.current.forEach((fn) => fn());
        if (agora - ultimoUI > 250) {
          ultimoUI = agora;
          setHora(m.hora());
          setMetricas(m.metricas());
          setNAgentes(m.agentes.length);
          const sel = selecionadoRef.current;
          if (sel !== null) {
            const a = m.agentes.find((g) => g.id === sel);
            setAgente((ant) => (a ? visao(a, true) : ant ? { ...ant, naVia: false } : null));
          }
        }
      }
      ultimo = agora;
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [rede]);

  // reconfigura o motor quando as intervenções mudam
  useEffect(() => {
    const m = motorRef.current;
    if (!rede || !m) return;
    m.configurar(paraLocais(rede, intervencoes));
    pulsos.current = [];
    setMetricas(m.metricas());
  }, [rede, intervencoes]);

  // guarda intervenções e cenários no navegador
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify({ intervencoes, cenarios }));
    } catch {
      /* sem armazenamento: segue só em memória */
    }
  }, [intervencoes, cenarios]);

  const analises = useMemo(() => {
    const mapa = new Map<string, AnaliseIntervencao>();
    if (!rede) return mapa;
    for (const i of paraLocais(rede, intervencoes)) mapa.set(i.id, analisar(rede, i));
    return mapa;
  }, [rede, intervencoes]);

  const orcamento = useMemo(() => (rede ? orcarCenario(rede, paraLocais(rede, intervencoes)) : null), [rede, intervencoes]);

  const assinar = useCallback((fn: () => void) => {
    ouvintes.current.add(fn);
    return () => {
      ouvintes.current.delete(fn);
    };
  }, []);

  const selecionar = useCallback((id: number | null) => {
    selecionadoRef.current = id;
    setSelecionadoId(id);
    const m = motorRef.current;
    const a = id !== null && m ? m.agentes.find((g) => g.id === id) : undefined;
    setAgente(a ? visao(a, true) : null);
  }, []);

  const definirHora = useCallback((h: number) => {
    const m = motorRef.current;
    if (!m) return;
    m.definirHora(h);
    m.reiniciarMetricas();
    pulsos.current = [];
    setHora(h);
    setMetricas(m.metricas());
  }, []);

  const reiniciar = useCallback(() => {
    const m = motorRef.current;
    if (!m || !rede) return;
    const h = m.hora();
    const novo = new Motor(rede, paraLocais(rede, intervencoes), (Date.now() % 100000) + 1);
    novo.definirHora(h);
    motorRef.current = novo;
    pulsos.current = [];
    selecionar(null);
    setMetricas(novo.metricas());
  }, [rede, intervencoes, selecionar]);

  const adicionar = useCallback((tipo: TipoIntervencao, lng: number, lat: number) => {
    const id = novoId(tipo);
    setIntervencoes((l) => [...l, { id, tipo, lng, lat, tempos: tipo === 'semaforo' ? { ...TEMPOS_PADRAO } : undefined }]);
    selecionarIntervencao(id);
    setModoColocar(null);
  }, []);

  const mover = useCallback((id: string, lng: number, lat: number) => {
    setIntervencoes((l) => l.map((i) => (i.id === id ? { ...i, lng, lat } : i)));
  }, []);

  const remover = useCallback((id: string) => {
    setIntervencoes((l) => l.filter((i) => i.id !== id));
    selecionarIntervencao((s) => (s === id ? null : s));
  }, []);

  const atualizarTempos = useCallback((id: string, tempos: TemposSemaforo) => {
    setIntervencoes((l) => l.map((i) => (i.id === id ? { ...i, tempos } : i)));
  }, []);

  const carregar = useCallback((ints: Intervencao[]) => {
    setIntervencoes(ints.map((i) => ({ ...i, tempos: i.tempos ? { ...i.tempos } : undefined })));
    selecionarIntervencao(null);
  }, []);

  const limpar = useCallback(() => {
    setIntervencoes([]);
    selecionarIntervencao(null);
  }, []);

  const salvarCenario = useCallback(
    (id: IdCenario) => setCenarios((c) => ({ ...c, [id]: intervencoes.map((i) => ({ ...i })) })),
    [intervencoes]
  );
  const apagarCenario = useCallback((id: IdCenario) => setCenarios((c) => ({ ...c, [id]: null })), []);

  return {
    pronto: !!rede,
    erro,
    rede,
    motorRef,
    assinar,
    pulsos,
    rodando,
    setRodando,
    velocidade,
    setVelocidade,
    hora,
    definirHora,
    reiniciar,
    metricas,
    nAgentes,
    intervencoes,
    analises,
    orcamento,
    adicionar,
    mover,
    remover,
    atualizarTempos,
    carregar,
    limpar,
    modoColocar,
    setModoColocar,
    intervencaoSelecionada,
    selecionarIntervencao,
    selecionadoId,
    selecionar,
    agente,
    cenarios,
    salvarCenario,
    apagarCenario,
  };
}

export const formatarHora = (h: number) => {
  const total = Math.floor((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const formatarReais = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
