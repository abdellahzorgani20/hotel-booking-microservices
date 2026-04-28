from django.db import models
from decimal import Decimal


class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('accepted', 'Accepté'),
        ('cancelled', 'Annulée'),
        ('refused', 'Refusé'),
    ]

    # les id sont dans autre services distante
    user_id = models.IntegerField()
    user_email = models.EmailField()
    user_name = models.CharField(max_length=200)
    hotel_id = models.IntegerField()
    hotel_name = models.CharField(max_length=200)
    room_id = models.IntegerField()
    room_number = models.CharField(max_length=10)
    room_type = models.CharField(max_length=20)

    check_in = models.DateField()
    check_out = models.DateField()
    guests = models.PositiveSmallIntegerField(default=1)
    price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Booking #{self.pk} - {self.user_email} @ {self.hotel_name}'

    @property
    def nights(self):
        return (self.check_out - self.check_in).days

    def save(self, *args, **kwargs):
        if self.check_in and self.check_out and self.price_per_night:
            nights = (self.check_out - self.check_in).days
            self.total_price = Decimal(str(self.price_per_night)) * nights
        super().save(*args, **kwargs)
