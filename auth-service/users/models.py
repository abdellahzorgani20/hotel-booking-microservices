from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [('admin', 'Admin'), ('client', 'Client')]

    first_name = None
    last_name = None

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f'{self.email} ({self.role})'

    @property
    def is_admin_user(self):
        return self.role == 'admin'