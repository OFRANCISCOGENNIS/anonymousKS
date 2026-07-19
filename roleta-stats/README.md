# Roleta Stats — Plataforma de Análise Estatística de Roleta

Aplicação web de **estudo estatístico** de resultados históricos de roleta.
Ela **não prevê resultados**: cada giro é um evento independente, análises
históricas não conferem vantagem futura (falácia do apostador) e a casa mantém
vantagem matemática em qualquer estratégia — o aviso é permanente na interface.

Stack: HTML5 + CSS3 + JavaScript ES2023 (Vanilla, ES Modules), sem dependências.

## Como rodar

Por usar ES Modules, sirva por HTTP (não abra via `file://`):

```bash
cd roleta-stats
python3 -m http.server 8080
# App:    http://localhost:8080/
# Testes: http://localhost:8080/tests/testes.html
```

## Arquitetura de arquivos

```
roleta-stats/
├── index.html              # Shell da aplicação (visões + navegação + aviso legal)
├── css/
│   └── estilo.css          # Tema dark mobile-first, variáveis CSS, WCAG AA
├── js/
│   ├── app.js              # Ponto de entrada: registra e inicia módulos
│   ├── core/
│   │   ├── barramento.js       # Pub/sub entre módulos (desacoplamento)
│   │   └── registroModulos.js  # Ciclo de vida padronizado dos módulos
│   └── modules/
│       ├── persistencia.js     # IndexedDB (giros/estratégias) + LocalStorage (config)
│       ├── configuracoes.js    # Config do usuário (tipo de roleta europeia/americana)
│       └── ui.js               # Roteador hash, visões, toasts, painel
├── tests/
│   ├── testes.html         # Runner de testes no navegador
│   └── testes.js           # Testes: barramento, módulos, config, CRUD IndexedDB
└── README.md
```

Módulos planejados para as próximas fases: `stats`, `mathEngine` (funções
puras), `simulator`, `strategies`, `io` (import/export), `dashboard`.

## Fases

| Fase | Escopo | Status |
|------|--------|--------|
| 1 | Fundação: estrutura, layout dark responsivo, sistema de módulos, persistência IndexedDB | ✅ Entregue |
| 2 | Cadastro de giros (0–36, cor derivada, europeia/americana), metadados, import/export CSV/JSON/XLSX, backup | ⏳ |
| 3 | Motor estatístico: descritivas, categorias, gaps, qui-quadrado, runs test, Markov descritivo | ⏳ |
| 4 | Visualizações e dashboard | ⏳ |
| 5 | Simulador Monte Carlo de estratégias (EV negativo sempre explícito) | ⏳ |
| 6 | Extras: PWA (manifest + service worker), atalhos, logs, polimento | ⏳ |

## Nota de teste — Fase 1

1. Suba o servidor e abra `http://localhost:8080/`.
2. Verifique: aviso legal fixo sob o cabeçalho; status "dados locais ok" no
   canto superior; navegação entre as 5 visões (hash router, funciona por
   teclado); layout responsivo (nav vira lateral ≥ 768px).
3. Em **Configurações**, troque para "Americana" e salve — o cartão "Tipo de
   roleta" do Painel atualiza via barramento de eventos.
4. "Apagar todos os dados locais" pede confirmação e zera IndexedDB + config.
5. Abra `tests/testes.html`: todos os testes devem passar (barramento,
   registro de módulos, normalização de config e CRUD completo do IndexedDB
   em banco isolado `roleta-stats-teste`).
