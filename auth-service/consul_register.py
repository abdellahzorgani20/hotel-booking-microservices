import requests
import os

CONSUL_HOST = os.getenv('CONSUL_HOST', 'localhost')
CONSUL_PORT = int(os.getenv('CONSUL_PORT', 8500))
SERVICE_PORT = int(os.getenv('PORT', 8001))
SERVICE_NAME = 'auth-service'


def register():
    payload = {
        'Name': SERVICE_NAME,
        'ID': f'{SERVICE_NAME}-1',
        'Address': SERVICE_NAME,
        'Port': SERVICE_PORT,
        'Tags': ['microservice', 'auth'],
        'Check': {
            'HTTP': f'http://{SERVICE_NAME}:{SERVICE_PORT}/api/auth/health/',
            'Interval': '10s',
            'Timeout': '5s',
        },
    }
    url = f'http://{CONSUL_HOST}:{CONSUL_PORT}/v1/agent/service/register'
    try:
        r = requests.put(url, json=payload, timeout=5)
        if r.status_code == 200:
            print(f'[Consul] {SERVICE_NAME} registered on port {SERVICE_PORT}')
        else:
            print(f'[Consul] Registration failed: {r.status_code} - {r.text}')
    except requests.exceptions.ConnectionError:
        print(f'[Consul] Could not connect to Consul at {CONSUL_HOST}:{CONSUL_PORT}. Skipping.')


if __name__ == '__main__':
    register()
