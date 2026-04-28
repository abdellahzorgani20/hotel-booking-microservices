from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch, MagicMock
from ..models import Booking
from datetime import date, timedelta


class MockUser:
    id = 1
    is_authenticated = True
    email = 'user@test.com'
    username = 'testuser'


class MockToken:
    payload = {'role': 'client', 'user_id': 1, 'email': 'user@test.com', 'username': 'testuser'}

    def __str__(self):
        return 'mock-token'


class BookingTests(APITestCase):
    def setUp(self):
        self.user = MockUser()

    def _make_booking(self):
        return Booking.objects.create(
            user_id=1,
            user_email='user@test.com',
            user_name='Test User',
            hotel_id=1,
            hotel_name='Test Hotel',
            room_id=1,
            room_number='101',
            room_type='double',
            check_in=date.today() + timedelta(days=5),
            check_out=date.today() + timedelta(days=8),
            guests=2,
            price_per_night='100.00',
            status='confirmed',
        )

    def test_list_my_bookings(self):
        booking = self._make_booking()
        self.client.force_authenticate(user=self.user, token=MockToken())
        response = self.client.get(reverse('booking-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cancel_booking(self):
        booking = self._make_booking()
        self.client.force_authenticate(user=self.user, token=MockToken())
        url = reverse('booking-cancel', args=[booking.pk])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'cancelled')

    def test_cannot_cancel_already_cancelled(self):
        booking = self._make_booking()
        booking.status = 'cancelled'
        booking.save()
        self.client.force_authenticate(user=self.user, token=MockToken())
        url = reverse('booking-cancel', args=[booking.pk])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
