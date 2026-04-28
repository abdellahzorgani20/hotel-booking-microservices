#!/bin/bash
set -e

python manage.py migrate --noinput
gunicorn hotel_service.wsgi:application \
  --bind 0.0.0.0:${PORT:-8002} \
  --workers 2 \
  --timeout 120 &

sleep 5
python consul_register.py

wait -n