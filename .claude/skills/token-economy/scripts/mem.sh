#!/usr/bin/env bash
# Memória de trabalho em disco (LLM-OS: contexto = RAM cara; disco = barato).
# Destila fatos/decisões para .claude/MEMORY.md em vez de re-derivar no contexto.
# Uso: mem.sh add "fato curto"   | mem.sh get [filtro] | mem.sh clear
set -euo pipefail
M="${MEM_FILE:-.claude/MEMORY.md}"
case "${1:-get}" in
  add)  shift; printf -- "- %s\n" "$*" >> "$M";;
  get)  [ -f "$M" ] && { [ -n "${2:-}" ] && grep -i "$2" "$M" || cat "$M"; } || echo "(vazia)";;
  clear) : > "$M";;
  *) echo "uso: mem.sh add|get|clear" >&2; exit 1;;
esac
