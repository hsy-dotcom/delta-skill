#!/bin/sh
# 소스 조각을 하나의 HTML로 합친다: head.html + <script>(src/*.js 알파벳순)</script>
cd "$(dirname "$0")"
{
  cat src/head.html
  printf '<script>\n(() => {\n"use strict";\n'
  for f in src/*.js; do printf '\n/* ═════ %s ═════ */\n' "$(basename "$f")"; cat "$f"; done
  printf '\n})();\n</script>\n'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
