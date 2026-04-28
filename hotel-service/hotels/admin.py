from django.contrib import admin
from .models import Hotel, Room


class RoomInline(admin.TabularInline):
    model = Room
    extra = 1


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'country', 'stars', 'created_at']
    list_filter = ['stars', 'country']
    search_fields = ['name', 'city']
    inlines = [RoomInline]


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['number', 'hotel', 'room_type', 'price_per_night', 'capacity', 'is_available']
    list_filter = ['room_type', 'is_available', 'hotel']
