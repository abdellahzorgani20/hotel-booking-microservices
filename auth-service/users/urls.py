from django.urls import path
from .views import (
    LoginView, RegisterView, ProfileView, UserListView,
    UserDetailView, ValidateTokenView, LogoutView, ChangePasswordView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('validate/', ValidateTokenView.as_view(), name='validate-token'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]
