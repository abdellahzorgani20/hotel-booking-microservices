import requests
import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from .models import Booking
from .serializers import BookingSerializer, BookingCreateSerializer
from .publisher import publish_booking_event

logger = logging.getLogger(__name__)


def get_room_info(room_id: int, token: str) -> dict | None:
    try:
        headers = {'Authorization': f'Bearer {token}'}
        url = f'{settings.HOTEL_SERVICE_URL}/api/rooms/{room_id}/'
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.warning(f'Could not fetch room info: {e}')
    return None


def get_hotel_info(hotel_id: int, token: str) -> dict | None:
    try:
        headers = {'Authorization': f'Bearer {token}'}
        url = f'{settings.HOTEL_SERVICE_URL}/api/hotels/{hotel_id}/'
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.warning(f'Could not fetch hotel info: {e}')
    return None


def has_accepted_overlap(room_id: int, check_in, check_out, exclude_booking_id=None) -> bool:
    # Vérifie les conflits de dates uniquement parmi les réservations acceptées
    qs = Booking.objects.filter(
        room_id=room_id,
        status='accepted',
        check_in__lt=check_out,
        check_out__gt=check_in,
    )
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)
    return qs.exists()


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        token = self.request.auth
        payload = token.payload if hasattr(token, 'payload') else {}
        if payload.get('role') == 'admin':
            return Booking.objects.all()
        return Booking.objects.filter(user_id=user.id)

    def create(self, request, *args, **kwargs):
        # L'admin ne peut pas réserver
        token_payload = request.auth.payload if hasattr(request.auth, 'payload') else {}
        if token_payload.get('role') == 'admin':
            return Response(
                {'error': 'Les administrateurs ne peuvent pas effectuer de réservation.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        token_str = str(request.auth)

        # extraire les infos de la chambre depuis hotel-service
        room = get_room_info(data['room_id'], token_str)
        if room is None:
            return Response(
                {'error': f'Room {data["room_id"]} not found or hotel-service unreachable.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if room.get('hotel') != data['hotel_id']:
            return Response(
                {'error': 'Room does not belong to the specified hotel.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # vérifier la capacité de la chambre
        room_capacity = room.get('capacity', 1)
        if data['guests'] > room_capacity:
            return Response(
                {
                    'error': (
                        f'This room accepts a maximum of {room_capacity} guest(s), '
                        f'but {data["guests"]} were requested.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # NB: la vérification des conflits de dates est désormais effectuée
        # par l'admin au moment d'accepter la réservation, pas ici.

        hotel = get_hotel_info(data['hotel_id'], token_str)
        hotel_name = hotel['name'] if hotel else f'Hotel #{data["hotel_id"]}'

        # extraire les infos utilisateur du token JWT
        user_email = token_payload.get('email', '')
        user_name = token_payload.get('username', '')

        if not user_email and hasattr(request.user, 'email'):
            user_email = request.user.email
        if not user_name and hasattr(request.user, 'username'):
            user_name = request.user.username

        # créer la réservation avec le statut "en attente"
        booking = Booking.objects.create(
            user_id=request.user.id,
            user_email=user_email,
            user_name=user_name,
            hotel_id=data['hotel_id'],
            hotel_name=hotel_name,
            room_id=data['room_id'],
            room_number=room.get('number', ''),
            room_type=room.get('room_type', ''),
            check_in=data['check_in'],
            check_out=data['check_out'],
            guests=data['guests'],
            price_per_night=room['price_per_night'],
            description=data.get('description', ''),
            status='pending',
        )

        # publier l'événement "en attente" (pas encore d'email envoyé)
        publish_booking_event('pending', {
            'booking_id': booking.id,
            'user_email': user_email,
            'user_name': user_name,
            'hotel_name': hotel_name,
            'room_number': room.get('number', ''),
            'check_in': str(data['check_in']),
            'check_out': str(data['check_out']),
            'total_price': str(booking.total_price),
        })

        out_serializer = BookingSerializer(booking)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        # Annulation par l'utilisateur
        booking = self.get_object()

        # Un admin ne peut pas utiliser cette action (il utilise refuse)
        token_payload = request.auth.payload if hasattr(request.auth, 'payload') else {}
        if token_payload.get('role') == 'admin':
            return Response(
                {'error': "L'admin doit utiliser l'action 'refuse' pour refuser une réservation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status in ('cancelled', 'refused'):
            return Response(
                {'error': f'Impossible d\'annuler une réservation avec le statut {booking.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'cancelled'
        booking.save()

        publish_booking_event('cancelled', {
            'booking_id': booking.id,
            'user_email': booking.user_email,
            'user_name': booking.user_name,
            'hotel_name': booking.hotel_name,
            'room_number': booking.room_number,
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'total_price': str(booking.total_price),
        })
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        # Acceptation d'une réservation par l'admin
        token_payload = request.auth.payload if hasattr(request.auth, 'payload') else {}
        if token_payload.get('role') != 'admin':
            return Response({'error': 'Réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

        booking = self.get_object()

        if booking.status != 'pending':
            return Response(
                {'error': f'Seules les réservations "en attente" peuvent être acceptées. Statut actuel : {booking.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Vérification des conflits de dates avec les réservations déjà acceptées
        if has_accepted_overlap(booking.room_id, booking.check_in, booking.check_out, exclude_booking_id=booking.pk):
            return Response(
                {
                    'error': (
                        'Impossible d\'accepter cette réservation : '
                        'la chambre est déjà réservée (acceptée) pour ces dates. '
                        'La demande reste en attente.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        booking.status = 'accepted'
        booking.save()

        # Envoi email asynchrone via RabbitMQ
        publish_booking_event('accepted', {
            'booking_id': booking.id,
            'user_email': booking.user_email,
            'user_name': booking.user_name,
            'hotel_name': booking.hotel_name,
            'room_number': booking.room_number,
            'room_type': booking.room_type,
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'total_price': str(booking.total_price),
        })
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def refuse(self, request, pk=None):
        # Refus d'une réservation par l'admin
        token_payload = request.auth.payload if hasattr(request.auth, 'payload') else {}
        if token_payload.get('role') != 'admin':
            return Response({'error': 'Réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

        booking = self.get_object()

        if booking.status not in ('pending',):
            return Response(
                {'error': f'Seules les réservations "en attente" peuvent être refusées. Statut actuel : {booking.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'refused'
        booking.save()

        # Envoi email asynchrone via RabbitMQ
        publish_booking_event('refused', {
            'booking_id': booking.id,
            'user_email': booking.user_email,
            'user_name': booking.user_name,
            'hotel_name': booking.hotel_name,
            'room_number': booking.room_number,
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'total_price': str(booking.total_price),
        })
        return Response(BookingSerializer(booking).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        token = request.auth
        payload = token.payload if hasattr(token, 'payload') else {}
        if payload.get('role') != 'admin':
            return Response({'error': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Sum
        qs = Booking.objects.all()
        return Response({
            'total': qs.count(),
            'pending': qs.filter(status='pending').count(),
            'accepted': qs.filter(status='accepted').count(),
            'cancelled': qs.filter(status='cancelled').count(),
            'refused': qs.filter(status='refused').count(),
            'revenue': qs.filter(status='accepted').aggregate(total=Sum('total_price'))['total'] or 0,
        })