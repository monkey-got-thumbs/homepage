#!/usr/bin/env bash
# Regenerate the self-hosted in-browser model stack under homepage/vendor/.
# vendor/ is gitignored (it's large + regenerable); it ships to S3 via `aws s3 sync`, not git.
# Run from homepage/:  bash scripts/build-vendor.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"; TMP="$(mktemp -d)"

echo "1/4  npm: fetch transformers.js + web-llm…"
( cd "$TMP" && npm init -y >/dev/null 2>&1 && npm install @huggingface/transformers@3 @mlc-ai/web-llm >/dev/null 2>&1 )

echo "2/4  vendor JS runtimes + ORT wasm…"
mkdir -p vendor/transformers vendor/web-llm/lib vendor/web-llm/libs
cp "$TMP/node_modules/@huggingface/transformers/dist/transformers.min.js" vendor/transformers/         # fully-bundled (NOT .web.min.js — that externalises ORT)
cp "$TMP/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep."* vendor/transformers/
cp "$TMP/node_modules/@mlc-ai/web-llm/lib/index.js" vendor/web-llm/lib/

echo "3/4  embeddings model (MiniLM, quantized)…"
EB=https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main
MM=vendor/models/Xenova/all-MiniLM-L6-v2; mkdir -p "$MM/onnx"
for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json; do curl -fsSL "$EB/$f" -o "$MM/$f"; done
curl -fsSL "$EB/onnx/model_quantized.onnx" -o "$MM/onnx/model_quantized.onnx"

echo "4/4  Qwen2.5-1.5B MLC weights + model-lib (WebLLM expects them under resolve/main/)…"
QB=https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main
QM=vendor/models/qwen2.5-1.5b/resolve/main; mkdir -p "$QM"
for f in mlc-chat-config.json tensor-cache.json ndarray-cache.json tokenizer.json tokenizer_config.json; do curl -fsSL "$QB/$f" -o "$QM/$f"; done
# shards listed in tensor-cache.json (mapfile avoids the trailing-newline read bug)
mapfile -t SHARDS < <(node -e 'const m=require("./'"$QM"'/tensor-cache.json");const s=new Set();(m.records||[]).forEach(r=>r.dataPath&&s.add(r.dataPath));console.log([...s].join("\n"))')
for sh in "${SHARDS[@]}"; do [ -n "$sh" ] && curl -fsSL "$QB/$sh" -o "$QM/$sh"; done
curl -fsSL "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm" \
  -o vendor/web-llm/libs/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm

rm -rf "$TMP"
echo "done — vendor/ is $(du -sh vendor | cut -f1). Deploy with: aws s3 sync . s3://mgt-prod-site/ (vendor/ included)"
