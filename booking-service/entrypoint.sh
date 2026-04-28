#!/bin/bash
set -e

python manage.py migrate --noinput
gunicorn booking_service.wsgi:application \
  --bind 0.0.0.0:${PORT:-8003} \
  --workers 2 \
  --timeout 120 &

sleep 5
python consul_register.py

wait -n