# Próximas etapas do simulador (prompt para quem vai continuar)

Você vai continuar o simulador de segurança viária do repositório **Desafio-de-transito** (React 18 + TypeScript + Vite + Tailwind + react-map-gl/MapLibre), na branch `feat/simulador-agentes`. O cruzamento é a Av. dos Africanos × Av. Vicente Venâncio de Queiroga, em São Luís (MA), para a SMTT.

## O que já existe (não refazer)

- **Motor da simulação** em `src/sim/` (sem dependência de tela). Carros, motos, ônibus e pedestres andam pela rede de faixas de `public/data/rede.geojson`; motoristas decidem, com fatores explícitos, se fazem conversão ou retorno proibido, se avançam o sinal e se cedem a vez ao pedestre. Quase-acidentes são medidos por PET (passagem pelo mesmo ponto com menos de 1,5 s de diferença) e TTC. Já calcula infrações, conflitos, atraso, risco e custos.
- **Painel de intervenções** (`src/components/sim/PainelIntervencoes.tsx`): as 9 intervenções arrastáveis para o mapa, lista com efeito e custo, edição dos tempos do semáforo, resultado ao vivo e cenários salvos A e B.
- **Hook** `useSimulacao()` em `src/sim/useSimulacao.ts`, já chamado no `App.tsx` e passado ao `TacticalMap` como `sim`. Ele carrega a rede, roda o motor num `requestAnimationFrame` e expõe tudo o que você precisa:

| Campo do `sim` | Para quê |
|---|---|
| `rodando`, `setRodando(bool)` | play e pausa |
| `velocidade`, `setVelocidade(1 \| 5 \| 20)` | velocidade. Hoje o padrão é **20**, porque não há controle na tela; mude para 1 em `useSimulacao.ts` quando os controles existirem. |
| `hora` (número, ex. 7.5), `definirHora(h)` | relógio da simulação; `definirHora` também zera as contagens. Use `formatarHora(h)` para exibir. |
| `reiniciar()` | recomeça no mesmo horário |
| `motorRef.current` | o `Motor`: `agentes`, `eventos`, `luzes()`, `metricas()` |
| `assinar(fn)` | chama `fn` a cada quadro; devolve a função para cancelar |
| `selecionar(id \| null)`, `selecionadoId`, `agente` | agente clicado; `agente` é um retrato atualizado 4 vezes por segundo |
| `pulsos.current` | conflitos recentes, com o instante real em que aconteceram |
| `rede` | geometria; `paraGeo(rede.quadro, {x, y})` (de `src/sim/geometria.ts`) converte metros locais em `[lng, lat]` |
| `cenarios.A`, `cenarios.B` | intervenções salvas pelo painel (ou `null`) |

## O que fazer

### 1. Controles de tempo
Barra no canto inferior esquerdo do mapa (o canto inferior direito já tem os controles de câmera): botão de play/pausa, velocidade 1×, 5× e 20×, relógio (ex. 07:32) e escolha do horário (controle deslizante de 0 a 23 h e atalhos: pico da manhã 7h, meio-dia 12h, pico da tarde 18h, noite 23h). Inclua um botão de recomeçar.

### 2. Agentes no mapa, em vermelho quando infringem
- A cada quadro, via `sim.assinar`, monte um GeoJSON e atualize a fonte com `map.getSource(id).setData(...)` (pegue o mapa com `useMap()` dentro do `<Map>`). **Não** ponha os agentes em estado do React: são ~100 objetos mudando 60 vezes por segundo.
- Cada agente tem `x`, `y` (metros locais, frente do veículo), `ang` (radianos), `comp` (comprimento), `tipo` (`carro`, `moto`, `onibus`, `pedestre`) e `infrator` (boolean). Veículo: retângulo girado (largura 1,8 m carro, 0,9 m moto, 2,5 m ônibus) em `fill-extrusion` (altura 1,5 / 1,3 / 3,1 m); o centro fica `comp/2` atrás da frente. Pedestre: círculo.
- Cores sugeridas: carro `#f8fafc`, moto `#7dd3fc`, ônibus `#c4b5fd`, pedestre `#fde047`, **infrator `#ef4444`**, selecionado `#22d3ee`. Ponha legenda.
- Semáforos: `motor.luzes()` devolve `{x, y, cor}` com `verde`, `amarelo` ou `vermelho`; desenhe como círculos.

### 3. Painel do agente clicado (o porquê da decisão)
- Inclua as camadas dos agentes em `interactiveLayerIds` **só quando `sim.pronto`** (o MapLibre registra erro se a camada ainda não existe). No clique, `sim.selecionar(Number(feature.properties.id))`.
- `sim.agente` traz: `tipo`, `estado` (ex. "esperando brecha (PARE)"), `vKmh`, `vDesKmh`, `imp` (impaciência 0 a 1), `infracoes`, `desejo` (frase "vir pela pista norte e entrar na Vicente Venâncio"), `naVia` e `decisoes[]` (mais recente primeiro). Cada decisão: `titulo`, `texto`, `infracao`, e, quando houver, `fatores[]` (`rotulo` e `efeito`; positivo aumenta a chance, negativo reduz), `probabilidade` e `sorteio`.
- Mostre os fatores como barras divergentes (à direita aumenta, à esquerda reduz) e a frase "Chance calculada: 64%. Sorteio: 0,41, abaixo da chance." Painel flutuante no canto superior esquerdo do mapa, com altura máxima e rolagem.

### 4. Mapa de calor de infrações e conflitos
- `motor.eventos`: `{tipo: 'conflito' | 'infracao', x, y, peso, grave, descricao}`. Atualize a fonte a cada ~0,5 s (não a cada quadro).
- Seletor da mancha: Quase-acidentes, Infrações e Ocorrências (a mancha das ocorrências registradas já existe no `TacticalMap`; esconda os marcadores quando ela não estiver selecionada).
- Uma rampa de uma cor por camada (ex. laranja → vermelho escuro para conflitos, rosa → roxo para infrações), transparente no zero.
- Opcional: um anel que cresce e some em cada conflito novo, usando `sim.pulsos` (idade = agora − `realT`, some em 1,6 s).
- As contagens zeram quando as intervenções mudam (`motor.configurar`), então o mapa de calor mostra a configuração atual.

### 5. Comparação Atual × A × B, com custos SINAPI/SICRO
- Volte o botão "Comparar atual, A e B" no rodapé do `PainelIntervencoes` e abra uma tela (modal grande).
- Para cada cenário (Atual = sem intervenções; A e B = `sim.cenarios`), rode `rodarCenario(sim.rede, paraLocais(sim.rede, ints), { hora, aoProgresso })` de `src/sim/cenarios.ts`. Leva ~3 s por cenário (3 rodadas de 1 h com as mesmas sementes nos três cenários, em pedaços que não travam a tela). Mostre barra de progresso. Devolve `{ metricas, riscoMin, riscoMax }`.
- Custos: `orcarCenario(rede, ints)` devolve `implantacao`, `mensal`, `prazoDias` e `itens[]`, cada um com `orcamento.implantacao[]` e `orcamento.mensal[]` (`descricao`, `fonte`, `codigo`, `referencia`, `unidade`, `quantidade`, `precoUnitario`).
- **Risco (conta corrigida)**: use `metricas.risco` e `reducaoDeRisco(riscoCenario, riscoAtual)` (= 1 − cenário ÷ atual). Nunca some porcentagens de intervenções; se precisar combinar, `combinarReducoes`.
- Mostre: risco por hora (com a faixa entre as rodadas), quase-acidentes graves, infrações, atraso médio, custo em 12 meses (implantação + 12 × mensal); tabela com todos os números (infrações e conflitos por tipo, espera do pedestre, implantação, mensal, prazo); memorial de custos por cenário com os itens "Estimativa" destacados; nota explicando a conta de risco e que os volumes são estimativas (`src/sim/demanda.ts`).
- Gráficos: um eixo por gráfico (nada de dois eixos), barras horizontais pequenas, uma por cenário, com o valor escrito ao lado e legenda. Cores já validadas para daltonismo: Atual `#2a78d6`, A `#eb6834`, B `#1baf7a` (a de B tem pouco contraste: mantenha os valores escritos e a tabela).
- Se A ou B estiver vazio, diga como salvar no painel em vez de mostrar coluna vazia.

## Números de referência (para conferir se está tudo ligado certo)
Pico das 7h30, 3 rodadas de 1 h: Atual tem risco ~600/h, ~250 quase-acidentes/h e ~390 infrações/h. Fechar o canteiro da VV dá cerca de −40% de risco (as conversões migram para o retorno proibido da abertura norte). Semáforo na VV dá cerca de −50% de risco, com atraso médio subindo de ~26 s para ~46 s. Câmera no canteiro da VV corta ~25% das infrações e ~17% do risco. Faixa elevada + refúgio corta ~50% dos conflitos com pedestre.

## Cuidados
- O objeto `sim` muda de identidade a cada renderização: nas dependências de `useEffect`, use os campos (`sim.modoColocar`, `sim.assinar`…), não o `sim` inteiro.
- O app roda em `React.StrictMode` (efeitos rodam duas vezes em desenvolvimento): sempre devolva a limpeza.
- Não mexa no motor sem necessidade; se mexer, rode um cenário antes e depois e compare com os números acima.
- Textos em português, frases curtas, sem prometer o que a tela não faz (nada de "IA", "tempo real", "digital twin" se não for verdade).
