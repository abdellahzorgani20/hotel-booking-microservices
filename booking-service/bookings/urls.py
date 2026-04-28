from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet


def health_check(request):
    return JsonResponse({'status': 'healthy'})


router = DefaultRouter()
router.register('bookings', BookingViewSet, basename='booking')

urlpatterns = [
    path('bookings/health/', health_check, name='health-check'),
    path('', include(router.urls)),
]