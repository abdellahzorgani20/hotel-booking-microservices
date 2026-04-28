import json
import logging
import os
import smtplib
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    from decouple import config
except ImportError:
    def config(key, default=None, cast=None):
        val = os.environ.get(key, default)
        return cast(val) if cast and val is not None else val

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)

RABBITMQ_URL = config('RABBITMQ_URL', default='amqp://guest:guest@localhost:5672/')
RABBITMQ_EXCHANGE = config('RABBITMQ_EXCHANGE', default='hotel_bookings')
SMTP_HOST = config('SMTP_HOST', default='')
SMTP_PORT = config('SMTP_PORT', default=587, cast=int)
SMTP_USER = config('SMTP_USER', default='')
SMTP_PASS = config('SMTP_PASS', default='')
EMAIL_FROM = config('EMAIL_FROM', default='noreply@hotelbooking.com')
PORT = config('PORT', default=10000, cast=int)

QUEUE_NAME = 'notifications'
BINDING_KEY = 'booking.*'

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

    def log_message(self, format, *args):
        pass  # silence request logs


def start_health_server():
    server = HTTPServer(('0.0.0.0', PORT), HealthHandler)
    logger.info(f'[Health] Listening on port {PORT}')
    server.serve_forever()

def send_email(to_email: str, subject: str, body: str):
    if not SMTP_USER or not SMTP_PASS:
        logger.info(f'[Email - SMTP not configured] To: {to_email} | Subject: {subject}')
        logger.info(f'Body: {body}')
        return

    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        logger.info(f'[Email sent] To: {to_email} | Subject: {subject}')
    except Exception as e:
        logger.error(f'[Email failed] {e}')


def handle_booking_accepted(data: dict):
    # Email envoyé quand l'admin accepte la réservation
    to = data.get('user_email', '')
    name = data.get('user_name', 'Client')
    subject = f'Réservation Acceptée – {data.get("hotel_name", "Hôtel")}'
    body = (
        f'Bonjour {name},\n\n'
        f'Votre réservation a été acceptée par l\'administrateur !\n\n'
        f'Hôtel : {data.get("hotel_name")}\n'
        f'Chambre : {data.get("room_number")} ({data.get("room_type", "")})\n'
        f'Arrivée : {data.get("check_in")}\n'
        f'Départ : {data.get("check_out")}\n'
        f'Total : {data.get("total_price")} EUR\n\n'
        f'Merci de votre confiance !\n'
        f'L\'équipe HotelBook'
    )
    send_email(to, subject, body)


def handle_booking_refused(data: dict):
    # Email envoyé quand l'admin refuse la réservation
    to = data.get('user_email', '')
    name = data.get('user_name', 'Client')
    subject = f'Réservation Refusée – {data.get("hotel_name", "Hôtel")}'
    body = (
        f'Bonjour {name},\n\n'
        f'Votre demande de réservation #{data.get("booking_id")} a été refusée par l\'administrateur.\n\n'
        f'Hôtel : {data.get("hotel_name")}\n'
        f'Chambre : {data.get("room_number")}\n'
        f'Dates : {data.get("check_in")} → {data.get("check_out")}\n\n'
        f'Si vous avez des questions, veuillez contacter notre support.\n\n'
        f'L\'équipe HotelBook'
    )
    send_email(to, subject, body)


def handle_booking_cancelled(data: dict):
    # Email envoyé quand l'utilisateur annule sa réservation
    to = data.get('user_email', '')
    name = data.get('user_name', 'Client')
    subject = f'Réservation Annulée – {data.get("hotel_name", "Hôtel")}'
    body = (
        f'Bonjour {name},\n\n'
        f'Votre réservation #{data.get("booking_id")} à {data.get("hotel_name")} a été annulée.\n\n'
        f'Si vous n\'êtes pas à l\'origine de cette annulation, veuillez contacter le support.\n\n'
        f'L\'équipe HotelBook'
    )
    send_email(to, subject, body)


def handle_booking_pending(data: dict):
    # Événement informatif (aucun email envoyé)
    logger.info(
        f'[Pending] Nouvelle demande de réservation #{data.get("booking_id")} '
        f'pour {data.get("user_email")} à {data.get("hotel_name")}'
    )


HANDLERS = {
    'booking.accepted': handle_booking_accepted,
    'booking.refused': handle_booking_refused,
    'booking.cancelled': handle_booking_cancelled,
    'booking.pending': handle_booking_pending,
}


def on_message(channel, method, properties, body):
    try:
        message = json.loads(body)
        data = message.get('data', {})
        routing_key = method.routing_key

        logger.info(f'[Received] {routing_key}: {json.dumps(data, indent=2)}')

        handler = HANDLERS.get(routing_key)
        if handler:
            handler(data)
        else:
            logger.warning(f'[No handler] for routing key: {routing_key}')

        channel.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f'[Error] Processing message: {e}')
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_worker():
    import pika

    retry_delay = 5
    max_retries = 12

    for attempt in range(max_retries):
        try:
            logger.info(f'[Worker] Connecting to RabbitMQ (attempt {attempt + 1})...')
            params = pika.URLParameters(RABBITMQ_URL)
            params.socket_timeout = 10
            connection = pika.BlockingConnection(params)
            channel = connection.channel()

            channel.exchange_declare(
                exchange=RABBITMQ_EXCHANGE,
                exchange_type='topic',
                durable=True,
            )
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            channel.queue_bind(
                exchange=RABBITMQ_EXCHANGE,
                queue=QUEUE_NAME,
                routing_key=BINDING_KEY,
            )
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=on_message)

            logger.info(f'[Worker] Listening on exchange={RABBITMQ_EXCHANGE} key={BINDING_KEY}')
            channel.start_consuming()
        except KeyboardInterrupt:
            logger.info('[Worker] Stopped by user.')
            break
        except Exception as e:
            logger.error(f'[Worker] Connection error: {e}')
            if attempt < max_retries - 1:
                logger.info(f'[Worker] Retrying in {retry_delay}s...')
                time.sleep(retry_delay)
            else:
                logger.error('[Worker] Max retries reached. Exiting.')


if __name__ == '__main__':
    try:
        import pika
    except ImportError:
        logger.error('[Worker] pika not installed. Run: pip install pika')
        raise

    health_thread = threading.Thread(target=start_health_server, daemon=True)
    health_thread.start()

    try:
        start_worker()
    except Exception as e:
        logger.error(f'[Worker] Fatal: {e}')