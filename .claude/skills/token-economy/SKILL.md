---
name: token-economy
description: Modo de máxima economia de tokens do Claude Code. Use quando o usuário pedir respostas curtas, economizar tokens/custo, "modo econômico", reduzir contexto, ou quando trabalhar em arquivos muito grandes (como vba/AnaliseCKCP_OTIMIZADO.bas, 6k+ linhas). Corta verbosidade de saída e ensina padrões de leitura/busca que evitam carregar arquivos inteiros no contexto.
---

# Token Economy — economize ~70% dos tokens

Ative este modo para reduzir drasticamente o consumo de tokens sem perder qualidade.

## 1. Comportamento de resposta

- Menor tamanho que resolve. Sem intro, sem resumo final, sem repetir a pergunta.
- Sem listas/negrito/cabeçalhos, salvo indispensável.
- Não ofereça ajuda extra, não narre o que vai fazer — faça.
- Ambíguo? UMA pergunta curta, nunca respostas por hipótese.

## 2. Leitura de arquivos (a maior fonte de gasto)

NUNCA leia um arquivo grande inteiro para "entender". Custa milhares de tokens.

- Localize antes com `Grep` (`output_mode:"content"`, `-n`, `head_limit`) e só então `Read` com `offset`/`limit` na faixa exata.
- Para o índice de Subs/Functions do `.bas`, use `scripts/vba_index.sh` (retorna nome + linha, ~30x mais barato que ler o arquivo).
- Nunca re-leia um arquivo que você acabou de editar para "conferir": Edit falha se não casar.
- Ao citar código, mostre só o trecho + 1 linha de contexto.

## 3. Busca

- `Grep` com `files_with_matches` primeiro; só abra o conteúdo do candidato certo.
- `type`/`glob` para filtrar em vez de varrer tudo.
- Prefira uma query precisa a várias amplas.

## 4. Ferramentas

- Chamadas independentes em paralelo (um bloco), não sequenciais.
- Não rode `cat`/`head`/`tail`/`find`/`grep` via Bash — os tools dedicados dão saída menor e paginada.
- Bash: use `| head` / filtros para não despejar saída gigante no contexto.

## 5. Edições

- `Edit` cirúrgico (old/new mínimos, únicos). Nunca reescreva o arquivo inteiro por uma linha.
- `replace_all` para renomeações repetidas em vez de N edições.

## 6. Delegação

- Busca ampla e incerta em muitos arquivos → subagente `Explore`, que devolve só a conclusão em vez de encher seu contexto com dumps.

## Medindo

`scripts/vba_index.sh` para navegar o `.bas` grande. Regra: se você está prestes a ler >200 linhas de uma vez, pare e busque primeiro.
