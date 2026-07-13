# AnaliseCKCP_OTIMIZADO — Documentação completa

Documentação de referência do módulo VBA `vba/AnaliseCKCP_OTIMIZADO.bas`.
Versão atual: **7.035 linhas · 61 Subs · 71 Functions** (módulo `AnaliseCKCP`).

> Para visão geral de arquitetura, fluxo e regras de negócio, ver `CLAUDE.md` e `ARCHITECTURE.md`.
> Este arquivo é o **índice detalhado por linha** de todos os procedimentos.

---

## 1. Ponto de entrada e UI

| Linha | Procedimento | Papel |
|------:|--------------|-------|
| 115 | `Sub GerarRelatorio()` | **Orquestrador principal.** Chama toda a cadeia de geração. |
| 221 | `Sub MostrarTelaFuturista(nLin, seg)` | Painel HUD final desenhado com Shapes. |
| 296 | `Sub AddTxt(...)` | Helper: caixa de texto no splash. |
| 317 | `Sub MetricBlock(...)` | Helper: bloco de métrica no splash. |
| 325 | `Sub LimparSplash()` | Remove shapes do splash. |
| 336 | `Sub FecharSplash([ignorar])` | Fecha o splash (callback OnTime). |

## 2. Localização e mapeamento da base

| Linha | Procedimento | Papel |
|------:|--------------|-------|
| 346 | `Function LocalizarBase() As Worksheet` | Acha a aba com `Elemento PEP`. |
| 373 | `Function MapearColunas(ws) As Boolean` | Mapeia colunas do SAP (tolerante a acento). |
| 427 | `Function TemCabecalhosMinimos(ws) As Boolean` | Valida colunas obrigatórias. |
| 436 | `Function PontuarBase(ws) As Long` | Pontua abas candidatas à base. |
| 446 | `Function ColLike(ws, frags) As Long` | Busca coluna por fragmento. |
| 470 | `Function SemAcento(s) As String` | Normaliza acentuação. |
| 5105 | `Function ColExata(ws, frags) As Long` | Busca coluna por match exato. |

## 3. Carga de dados em memória

| Linha | Procedimento | Papel |
|------:|--------------|-------|
| 486 | `Sub CarregarDados(ws)` | Carrega base para o array `dados`. |
| 509 | `Function ValorCampo(lin, col, [padrao])` | Leitura de campo por índice. |
| 519 | `Function TextoCampo(lin, col, [padrao])` | Idem, como texto. |
| 523 | `Function ValorMatriz(m, lin, col, [padrao])` | Leitura em matriz arbitrária. |
| 533 | `Function TextoMatriz(m, lin, col, [padrao])` | Idem, como texto. |
| 534–546 | `LinhaCLS1/CLS2/CLS3/TipoAplic(lin)` | Extração de classificação por linha. |
| 553 | `Function MatInfoLinha(lin, idx)` | Info de material da linha. |
| 584 | `Function SrvInfoLinha(lin, idx)` | Info de serviço da linha. |

## 4. Catálogos (dicionários)

| Linha | Procedimento | Popula |
|------:|--------------|--------|
| 637 | `Sub CarregarCatalogoMateriais()` | `dCatMat` (MATERIAS_ATUAIS.xlsx) |
| 692 | `Sub CarregarDescServico()` | `dDescSrv` (catálogo **embutido** de descrições, `base_servi_os.xlsx`) |
| 1302 | `Function DescServico(cod)` | Consulta `dDescSrv`. |
| 1319 | `Function CatInfo(codMat, idx)` | Consulta `dCatMat`. |
| 1332 | `Sub CarregarCatalogoServicos()` | `dCatSrv` |
| 1393 | `Function SrvInfo(codSrv, idx)` | Consulta `dCatSrv`. |
| 1408 | `Sub CarregarCatalogoClasse()` | `dCatCC` |
| 1460 | `Sub CarregarClassificacaoClassesDados()` | Overrides curados de classe (42) + chama `CarregarClassesCustoAuto`. |
| 1540 | `Sub CarregarClassesCustoAuto()` | Base completa CLASSE_CUSTO_ATUAIS embutida (782 classes). |
| 1535 | `Sub AddClasseCusto(...)` | Insere classe. |
| 2287 | `Function CCInfo(codCC, idx)` | Consulta `dCatCC`. |
| 2303 | `Sub CarregarConversoesCabo()` | `dCabo` (KG→m) |
| 2338 | `Function CaboFator(codMat)` | Fator de cabo. |
| 2352 | `Sub CarregarComboServico()` | `dCombo` |
| 2403 | `Function ComboFator(codSrv)` | Fator combo. |
| 2425 | `Sub CarregarTipoClassif()` | `dTipoCls` (COM/UC/UAR) |

## 5. Helpers de classificação e cálculo

| Linha | Procedimento |
|------:|--------------|
| 575 | `Function Cls2SrvOverride(codSrv)` — overrides fixos (`COND PROT`) |
| 608 | `Function TipoPEPCodigo(pep)` |
| 617 | `Function TipoPEPANEEL(pep)` |
| 625 | `Function ClassificacaoPendente(cls1,cls2,cls3)` |
| 1309 | `Function NormCod(v)` |
| 2456 | `Function NormClassif(s)` |
| 2471 | `Function TipoDaClassif(classif, ...)` |
| 2488 | `Function FamiliaAlias(cls2)` |
| 2496 | `Function EhCabo(cls2)` |
| 2503 | `Function CobertoReligador(cls2)` |
| 2509 | `Function DentroMargem(a, b)` |
| 2524 | `Function PEP3(pep)` — PEP 3º nível |
| 2533 | `Function SegmentoPI(pep)` |
| 2542 | `Function GrupoPerc(pep)` |
| 2551 | `Function EhMaterial(classif)` |
| 2556 | `Function ToNum(v)` |

## 6. Geradores de abas

| Linha | Procedimento | Aba |
|------:|--------------|-----|
| 2564 | `Sub Gerar_RazaoCJ()` | `RAZAO CJ` |
| 2624 | `Sub Gerar_MaterialVsServico()` | `MATERIAL vs SERVICO` (+ popula `dMvSVerd/dMvSFamNC/dMvSDif`) |
| 3157 | `Sub Gerar_AnaliseCA()` | `ANALISE DE CA` |
| 3374 | `Sub Gerar_ClasseDeCusto()` | `CLASSE DE CUSTO` |
| 3423 | `Sub Gerar_Material()` | `MATERIAL` |
| 3519 | `Sub Gerar_Servico()` | `SERVICO` |
| 3587 | `Sub Gerar_AlertasCriticos()` | `ALERTAS CRITICOS` |
| 4000 | `Sub Gerar_Regras()` | `REGRAS` |
| 4237 | `Sub Gerar_PainelExecutivo()` | `PAINEL EXECUTIVO` |
| 4498 | `Sub Gerar_ServicoSemMaterial()` | `SERVICO SEM MATERIAL` |
| 4595 | `Sub Gerar_PortfolioObra()` | `PORTFOLIO OBRA` |
| 4731 | `Sub Gerar_NaoClassificados()` | `NAO CLASSIFICADOS` |
| 4814 | `Sub Gerar_RacionalizacaoCOM()` | `RACIONALIZACAO COM` |
| 5493 | `Sub Gerar_MatVsServAT()` | `MAT vs SERV AT` (módulo AT) |
| 6742 | `Sub CriarPremissas()` | `PREMISSAS` |

### Helpers de ANALISE DE CA
3261 `ValorCat` · 3266 `CategoriaAnaliseCA` · 3314 `CategoriaPorClasseCusto` · 3329 `ClasseCustoDadosOutros` · 3335 `MapCategoriaCA`

### Helpers de ALERTAS
3938 `EscreverCardAlerta` · 3960 `EscreverCabecalhoAlerta`

### Helpers de RACIONALIZACAO COM
4976 `CriarMapaNT006_RC` · 5068 `AddMatRC` · 5090 `EhPepEmergencia` · 5095 `AtvPrevista`

### Classes de viagem
4471 `EhClasseViagem` · 4482 `DescClasseViagem`

## 7. Escrita, ordenação e formatação de abas

| Linha | Procedimento |
|------:|--------------|
| 4075 | `Sub EscreverAba(nome, outp())` |
| 4113 | `Sub OrdenarAba(ws, nome, ...)` |
| 5118 | `Sub AplicarFreeze(ws, celula, ...)` |
| 5135 | `Function CategoriaVeredito(v)` |
| 5151 | `Sub ColorirColunaVeredito(ws, jc, nR)` |
| 5173 | `Sub PintarRunVeredito(ws, jc, ...)` |
| 5193 | `Sub PintarStatusRC(ws, linIni, ...)` |
| 5334 | `Function EhColunaVeredito(hh)` |
| 5341 | `Function CorAba(nome)` |
| 5359 | `Function FormatoColuna(hh)` |
| 5381 | `Sub FormatarVisualAba(ws, nome, ...)` |
| 5469 | `Sub OrganizarAbas()` |

## 8. Configuração (aba CONFIG)

| Linha | Procedimento |
|------:|--------------|
| 5213 | `Sub GarantirConfig()` |
| 5267 | `Sub CarregarConfig()` |
| 5294 | `Function CfgTxt(chave, padrao)` |
| 5305 | `Function CfgNum(chave, padrao)` |
| 5315 | `Function CaminhoCatalogo(chave, padrao)` |

## 9. Módulo AT (`MAT vs SERV AT`)

| Linha | Procedimento |
|------:|--------------|
| 5513 | `Sub CarregarDados_AT()` |
| 5571 | `Sub CarregarCorresp()` |
| 5637 | `Function AcharAbaCorresp()` |
| 5649 | `Function AchaCorrespNoWb(wb)` |
| 5667 | `Function NomeNorm(s)` |
| 5681 | `Sub AplicarRegrasPreAgrupamento()` |
| 5728 | `Sub AgruparItens()` |
| 5799 | `Sub AplicarRegrasPosAgrupamento()` |
| 5934 | `Sub PadronizarCls2()` |
| 5980 | `Sub CalcularMatSrv()` |
| 6091 | `Sub CalcularAderencia()` |
| 6299 | `Sub CalcularTipoCusto()` |
| 6315 | `Sub CalcularPctMop()` |
| 6354 | `Sub OrdenarPorGrupo()` |
| 6395 | `Sub QuickSortIdx(keys, idx, lo, hi)` |
| 6416 | `Function DeveOrdenar(a, b)` |
| 6437 | `Function TipoOrdem(a)` |
| 6447 | `Sub EscreverAbaAT()` |

### Helpers AT (códigos/serviços)
6623 `CleanCod` · 6631 `TemSaldo` · 6635 `ContemPalavra` · 6639 `EhAutoCorrespondente` · 6649 `EhNaCorresp` · 6659 `GetTipoServico` · 6674 `GetGrupoKey` · 6710 `PepExisteComSufixo` · 6720 `PepTemMob`

## 10. Helpers de PREMISSAS
6973 `SecaoTitulo` · 6985 `TabelaCabecalho` · 7000 `LinhaDados` · 7029 `AplicarBordas`

---

## Mudanças vs. versão anterior (OTIMIZADO → OTIMIZADO2)

- **Conjunto de procedimentos idêntico** (60 Subs / 71 Functions).
- Catálogo embutido `dDescSrv` (`CarregarDescServico`, linha 688) expandido em três leituras:
  1. +23 mapeamentos de `base_servi_os.xlsx`.
  2. +85 mapeamentos de `classificar_servi_os.xlsx` (colunas `Nº de serviço` / `Denominação`), sem sobreposição com os códigos já existentes.
- Novas regras de `ADERENCIA` na aba `MATERIAL` (`Gerar_Material`): `QTD=0+VALOR≠0`, sinais opostos QTD×VALOR, ou `VALOR=0+QTD≠0` → `NAO ADERENTE` (prioridade sobre a regra por tipo de PEP).

### Atualização com catálogos ATUAIS (CLASSE_CUSTO / MATERIAIS / SERVICOS)

- **Classe de custo embutida completa**: novo `CarregarClassesCustoAuto` embute as 782 classes de `CLASSE_CUSTO_ATUAIS_2.xlsx` (CLS1/2/3). Os 42 overrides curados de `CarregarClassificacaoClassesDados` rodam **depois** e mantêm prioridade (ex.: `MOP_CUSTEIO`, `EMENDA`). `ANALISE DE CA` passa a classificar corretamente mesmo sem o arquivo externo.
- **Descrições de serviço vindas do arquivo**: `CarregarCatalogoServicos` agora também popula `dDescSrv` a partir de `TEXTO BREVE` de `SERVICOS_ATUAIS_2.xlsx` (6.780 serviços), preenchendo descrições faltantes. Descrições embutidas mantêm prioridade — por isso `CarregarDescServico` passou a rodar **antes** do catálogo externo.
- **Auto-localização dos arquivos novos**: caminhos-padrão dos loaders atualizados para achar `MATERIAS_ATUAIS_4.xlsx`, `SERVICOS_ATUAIS_2.xlsx` e `CLASSE_CUSTO_ATUAIS_2.xlsx` em `Downloads` (mantendo os nomes antigos como fallback).
- Materiais (15.030) e serviços (6.780) continuam lidos de disco em runtime (grandes demais para embutir); só a classe de custo foi embutida.
