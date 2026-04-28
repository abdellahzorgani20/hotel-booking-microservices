from django.contrib import admin
from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_email', 'hotel_name', 'room_number',
        'check_in', 'check_out', 'total_price', 'status', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['user_email', 'hotel_name', 'room_number']
    readonly_fields = ['total_price', 'created_at', 'updated_at']
    ordering = ['-created_at']
