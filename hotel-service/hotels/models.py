from django.db import models


class Hotel(models.Model):
    STARS_CHOICES = [(i, f'{i} Star{"s" if i > 1 else ""}') for i in range(1, 6)]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=300)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    stars = models.PositiveSmallIntegerField(choices=STARS_CHOICES, default=3)
    image_url = models.URLField(blank=True)
    amenities = models.JSONField(default=list, blank=True)  # ex: ["Wifi", "Piscine"]
    admin_id = models.IntegerField(null=True, blank=True)   # Lié à user_id du auth-service via JWT
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.city}, {self.stars} étoiles)'


class Room(models.Model):
    TYPE_CHOICES = [
        ('single', 'Single'),
        ('double', 'Double'),
        ('twin', 'Twin'),
        ('suite', 'Suite'),
        ('deluxe', 'Deluxe'),
        ('family', 'Family'),
    ]

    hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE, related_name='rooms')
    number = models.CharField(max_length=10)
    room_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='double')
    price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    capacity = models.PositiveSmallIntegerField(default=2)
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=list, blank=True)
    images = models.JSONField(default=list, blank=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['hotel', 'number']
        ordering = ['room_type', 'price_per_night']

    def __str__(self):
        return f'Room {self.number} ({self.room_type}) - {self.hotel.name}'