from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch, MagicMock
from ..models import Hotel, Room


class HotelTests(APITestCase):
    def setUp(self):
        self.hotel = Hotel.objects.create(
            name='Test Hotel', city='Algiers', country='Algeria',
            stars=4, address='1 Test St'
        )

    def test_list_hotels_public(self):
        url = reverse('hotel-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hotel_detail_public(self):
        url = reverse('hotel-detail', args=[self.hotel.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Test Hotel')

    def test_filter_by_city(self):
        Hotel.objects.create(name='Paris Hotel', city='Paris', country='France', stars=3, address='2 Test')
        url = reverse('hotel-list') + '?city=Paris'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_search_hotels(self):
        url = reverse('hotel-list') + '?search=Test'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)
