import requests
import os

CONSUL_HOST = os.getenv('CONSUL_HOST', 'localhost')
CONSUL_PORT = int(os.getenv('CONSUL_PORT', 8500))
SERVICE_PORT = int(os.getenv('PORT', 8003))
SERVICE_NAME = 'booking-service'

def register():
    payload = {
        'Name': SERVICE_NAME,
        'ID': f'{SERVICE_NAME}-1',
        'Address': SERVICE_NAME,
        'Port': SERVICE_PORT,
        'Tags': ['microservice', 'bookings'],
        'Check': {
            'HTTP': f'http://{SERVICE_NAME}:{SERVICE_PORT}/api/bookings/health/',
            'Interval': '10s',
            'Timeout': '5s',
        },
    }
    try:
        r = requests.put(
            f'http://{CONSUL_HOST}:{CONSUL_PORT}/v1/agent/service/register',
            json=payload, timeout=5
        )
        print(f'[Consul] {SERVICE_NAME} registration: {r.status_code}')
    except Exception as e:
        print(f'[Consul] Skipping: {e}')


if __name__ == '__main__':
    register()