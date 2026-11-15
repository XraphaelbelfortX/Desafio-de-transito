# Guardião Viário — MVP Hackathon de Mobilidade Urbana (GovTech)

Simulador de segurança viária para a **SMTT São Luís/MA**, no cruzamento da **Av. dos Africanos com a Av. Vicente Venâncio de Queiroga**. O gestor coloca intervenções no mapa (câmera, semáforo, fechar canteiro, retorno, tachões, faixa elevada, refúgio, lombada, agente de trânsito) e uma simulação por agentes mede o efeito em quase-acidentes, infrações e atraso, com o custo de cada opção. As ocorrências registradas no cruzamento (agente, câmera, registro da SMTT) aparecem no Mapa de Alerta.

Guia completo (como funciona a simulação, o assistente, a visão computacional e o passo a passo de uso): [docs/guardiao-viario-guia.pdf](docs/guardiao-viario-guia.pdf).

## Stack
- **React 18 + TypeScript + Vite**
- **Tailwind CSS**
- **Lucide-React**
- **react-map-gl** com MapLibre (satélite Esri, sem token) ou Mapbox (com token)

## Estrutura
- [src/App.tsx](src/App.tsx): barra de navegação e as 4 telas.
- [src/screens/](src/screens/): **Mapa** (visão geral, um alerta por cruzamento), **Câmeras** (demonstração da visão computacional sobre a foto real), **Simular** (mesa de trabalho: paleta, mapa, painel de decisão) e **Relatórios** (relatório imprimível do cruzamento).
- [src/components/TacticalMap.tsx](src/components/TacticalMap.tsx): mapa do cruzamento (centro em -2.55498, -44.27049), rede de faixas, visão 3D, mancha de calor das ocorrências e área onde se soltam as intervenções. Na aba Mapa roda em modo compacto.
- [src/components/sim/PaletaIntervencoes.tsx](src/components/sim/PaletaIntervencoes.tsx) e [PainelIntervencoes.tsx](src/components/sim/PainelIntervencoes.tsx): catálogo das 9 intervenções; lista do que está no mapa (efeito, custo, tempos do semáforo), resultado ao vivo e cenários A e B.
- [src/components/sim/CamadaIntervencoes.tsx](src/components/sim/CamadaIntervencoes.tsx): desenho de cada intervenção no chão e ícone arrastável no mapa.
- [src/sim/](src/sim/): motor da simulação, sem dependência de tela (roda no navegador e no Node).
- [src/components/StreetViewModal.tsx](src/components/StreetViewModal.tsx): "Ver a rua": desenho em escala sobre a planta oficial da SMTT ([PlantaOficial.tsx](src/components/PlantaOficial.tsx)) e foto real do Google Street View ([StreetViewReal.tsx](src/components/StreetViewReal.tsx), precisa de `VITE_GOOGLE_MAPS_API_KEY`). Não altera a simulação.

## Simulador por agentes (`src/sim/`)
| Arquivo | O que faz |
|---|---|
| `rede.ts` | Lê `public/data/rede.geojson` e converte para metros locais. Larguras, aberturas e travessias saem do arquivo. |
| `demanda.ts` | Volumes por movimento e perfil por hora do dia. **Estimativas**: troque pela contagem da SMTT. |
| `intervencoes.ts` | Catálogo das 9 intervenções, regra de onde cada uma tem efeito e orçamento (SINAPI/SICRO). |
| `rotas.ts` | Rotas possíveis de cada desejo de viagem (legal, proibida ou desvio pelo bairro), pontos de espera, semáforos e zonas de conflito. |
| `motor.ts` | Simulação: veículos (modelo IDM) e pedestres, decisões explicáveis, infrações e quase-acidentes. |
| `cenarios.ts` | Rodada sem tela para comparar cenários, orçamento do cenário e a conta de risco. |
| `useSimulacao.ts` | Hook React que carrega a rede, roda o motor e guarda intervenções e cenários no navegador. |

Como funciona, em resumo:
- Cada motorista sorteia um perfil (impaciência, velocidade que gostaria de manter). Diante de uma manobra proibida, a chance de infringir sai de fatores explícitos: tempo economizado em relação à rota legal, fiscalização percebida (câmera, agente), barreira física (tachões), perfil, noite. Cada decisão fica guardada com os fatores, a chance e o sorteio.
- Quem cruza ou entra na avenida espera brecha; a exigência de folga cai com a espera e a impaciência. No semáforo, o motorista decide se avança o vermelho (amarelo curto aumenta o avanço).
- Pedestres esperam brecha (ou o verde); com refúgio atravessam em duas etapas. Faixa elevada faz mais motoristas cederem a vez.
- Quase-acidente = duas trajetórias passando pelo mesmo ponto com menos de 1,5 s de diferença (PET), ou risco de batida traseira (TTC). Grave abaixo de 0,8 s.
- **Conta de risco**: conflitos por hora × peso (grave 3, moderado 1; pedestre × 2; traseira × 0,7). A redução de um cenário é `1 − risco do cenário ÷ risco atual`. A versão anterior somava as porcentagens de cada intervenção (45% + 60% = 105%, travado em 90%); reduções não se somam, a segunda age sobre o risco que sobrou. Para combinar porcentagens use `combinarReducoes` (`1 − Π(1 − rᵢ)`).
- **Custos**: SINAPI média nacional não desonerada (05/2026) para meio-fio, pintura e concreto asfáltico; SICRO para o tachão (material MA, 07/2026); SCO-RJ para coluna de semáforo; contrato público para manutenção semafórica; edital SMTT 001/2024 para o agente. O que não tem composição pública aparece como **Estimativa** e deve ser trocado pela cotação da SMTT. Sem BDI.

O motor não depende de React: dá para rodar um cenário inteiro sem tela com `rodarCenario` (ver `cenarios.ts`).

## Rede de faixas
- O mapa usa satélite Esri World Imagery (sem token) e desenha a rede de faixas do trecho: Africanos 3+3 faixas, canteiro com as duas aberturas, caixas amarelas, Vicente Venâncio, rua do cruzamento norte (~140 m a oeste), travessias e os 12 movimentos de conversão.
- Movimentos: laranja = conflito principal (esquerda saindo da VV), verde = permitido, vermelho tracejado = proibido pela placa mas fisicamente possível. Clique numa feição para ver id, sentido e qual intervenção a elimina (`fechado_por`).
- A geometria é gerada por `scripts/gera-rede.mjs` em metros locais e convertida para lat/lon. O `metadata.calibrado` do arquivo ainda está `false`: confira `ANCORA` e `RUMO_GRAUS` no satélite e rode `node scripts/gera-rede.mjs`. O simulador lê a geometria do arquivo gerado, então recalibrar o script recalibra a simulação.

## Token Mapbox
Em [src/components/TacticalMap.tsx](src/components/TacticalMap.tsx), a constante `MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN'` pode receber um token real (ou cole pelo botão **Token** no mapa). Sem token, o mapa usa MapLibre com o satélite Esri.

## Próximas etapas
Controles de tempo, agentes desenhados no mapa com o painel do porquê, mapa de calor de infrações e conflitos e a tela de comparação Atual × A × B estão descritos em [docs/proximas-etapas-simulador.md](docs/proximas-etapas-simulador.md).

## Como executar
```bash
npm install
npm run dev
```
