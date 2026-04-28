from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class JWTUser:
    def __init__(self, payload):
        self.id = payload.get('user_id')
        self.pk = self.id
        self.role = payload.get('role', 'client')
        self.email = payload.get('email', '')
        self.username = payload.get('username', '')
        self.is_authenticated = True
        self.is_active = True

    def __str__(self):
        return self.email


class MicroserviceJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            return JWTUser(validated_token.payload)
        except Exception:
            raise AuthenticationFailed('Invalid token payload.')