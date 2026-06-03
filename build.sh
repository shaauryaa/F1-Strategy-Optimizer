#!/usr/bin/env bash
set -e

pip install -r requirements-api.txt

echo "Building dataset..."
python -m f1opt.data.build_dataset

echo "Training pace model..."
python -m f1opt.model.pace_model

echo "Training tyre model..."
python -m f1opt.model.tyre_model

echo "Build complete."
