from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        token = request.auth
        if token is None:
            return False
        payload = token.payload if hasattr(token, 'payload') else {}
        return payload.get('role') == 'admin'


class IsOwnerOrAdminOrReadOnly(BasePermission):

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        token = request.auth
        if token is None:
            return False
        payload = token.payload if hasattr(token, 'payload') else {}
        return payload.get('role') == 'admin'

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        token = request.auth
        if token is None:
            return False
        payload = token.payload if hasattr(token, 'payload') else {}
        if payload.get('role') == 'admin':
            return True
        return obj.admin_id == request.user.id