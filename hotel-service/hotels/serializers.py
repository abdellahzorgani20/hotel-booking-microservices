from rest_framework import serializers
from .models import Hotel, Room


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = [
            'id', 'hotel', 'number', 'room_type', 'price_per_night',
            'capacity', 'description', 'amenities', 'images',
            'is_available', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class RoomBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'number', 'room_type', 'price_per_night', 'capacity', 'is_available']


class HotelSerializer(serializers.ModelSerializer):
    rooms = RoomBriefSerializer(many=True, read_only=True)
    rooms_count = serializers.SerializerMethodField()
    available_rooms_count = serializers.SerializerMethodField()

    class Meta:
        model = Hotel
        fields = [
            'id', 'name', 'description', 'address', 'city', 'country',
            'stars', 'image_url', 'amenities', 'admin_id',
            'rooms', 'rooms_count', 'available_rooms_count', 'created_at',
        ]
        read_only_fields = ['id', 'admin_id', 'created_at']

    def get_rooms_count(self, obj):
        return obj.rooms.count()

    def get_available_rooms_count(self, obj):
        return obj.rooms.filter(is_available=True).count()


class HotelListSerializer(serializers.ModelSerializer):
    rooms_count = serializers.SerializerMethodField()
    available_rooms_count = serializers.SerializerMethodField()
    min_price = serializers.SerializerMethodField()

    class Meta:
        model = Hotel
        fields = [
            'id', 'name', 'city', 'country', 'stars', 'image_url',
            'rooms_count', 'available_rooms_count', 'min_price', 'created_at',
        ]

    def get_rooms_count(self, obj):
        return obj.rooms.count()

    def get_available_rooms_count(self, obj):
        return obj.rooms.filter(is_available=True).count()

    def get_min_price(self, obj):
        room = obj.rooms.filter(is_available=True).order_by('price_per_night').first()
        return str(room.price_per_night) if room else None