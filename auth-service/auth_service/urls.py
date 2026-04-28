from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView

def health_check(request):
    return JsonResponse({'status': 'healthy'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/auth/health/', health_check, name='health-check'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
