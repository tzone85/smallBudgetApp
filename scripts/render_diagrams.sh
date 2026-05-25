#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../docs/architecture"
plantuml -tsvg -nometadata *.puml
echo "rendered: $(ls *.svg | wc -l | tr -d ' ') svg files"
