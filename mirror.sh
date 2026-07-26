#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://sismedonline.com.br/dashboard.php?visitante=1}"
DESTINO="${2:-meu_site}"

wget \
  --mirror \
  --page-requisites \
  --adjust-extension \
  --convert-links \
  --no-parent \
  --directory-prefix="$DESTINO" \
  --user-agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36' \
  "$URL"

printf 'Arquivos públicos salvos em: %s\n' "$DESTINO"
printf 'Observação: PHP, banco, sessões e APIs privadas não são incluídos pelo wget.\n'
