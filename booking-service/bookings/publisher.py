import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def publish_booking_event(event_type: str, booking_data: dict):

    # Publier un evenement de booking au RabbitMQ
    from django.conf import settings

    if not settings.RABBITMQ_ENABLED:
        logger.info(f'[RabbitMQ disabled] Event: {event_type} | Data: {json.dumps(booking_data)}')
        return True

    try:
        import pika
        params = pika.URLParameters(settings.RABBITMQ_URL)
        params.socket_timeout = 5
        connection = pika.BlockingConnection(params)
        channel = connection.channel()

        channel.exchange_declare(exchange='hotel_bookings', exchange_type='topic', durable=True)

        message = {
            'event': event_type,
            'timestamp': datetime.utcnow().isoformat(),
            'data': booking_data,
        }

        routing_key = f'booking.{event_type}'
        channel.basic_publish(
            exchange='hotel_bookings',
            routing_key=routing_key,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,    # persistent
                content_type='application/json',
            ),
        )
        connection.close()
        logger.info(f'[RabbitMQ] Published: {routing_key}')
        return True
    # Fall back to logging
    except Exception as e:
        logger.warning(f'[RabbitMQ] Failed to publish event: {e}. Event logged instead.')
        logger.info(f'[Event] {event_type}: {json.dumps(booking_data)}')
        return False
