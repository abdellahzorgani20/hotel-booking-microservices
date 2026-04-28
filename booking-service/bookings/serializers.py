from rest_framework import serializers
from .models import Booking
from datetime import date


class BookingCreateSerializer(serializers.Serializer):
    hotel_id = serializers.IntegerField()
    room_id = serializers.IntegerField()
    check_in = serializers.DateField()
    check_out = serializers.DateField()
    guests = serializers.IntegerField(min_value=1)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['check_in'] < date.today():
            raise serializers.ValidationError({'check_in': 'Check-in cannot be in the past.'})
        if data['check_out'] <= data['check_in']:
            raise serializers.ValidationError({'check_out': 'Check-out must be after check-in.'})
        nights = (data['check_out'] - data['check_in']).days
        if nights > 30:
            raise serializers.ValidationError('Maximum stay is 30 nights.')
        return data


class BookingSerializer(serializers.ModelSerializer):
    nights = serializers.ReadOnlyField()

    class Meta:
        model = Booking
        fields = [
            'id', 'user_id', 'user_email', 'user_name',
            'hotel_id', 'hotel_name', 'room_id', 'room_number', 'room_type',
            'check_in', 'check_out', 'nights', 'guests',
            'price_per_night', 'total_price', 'status', 'description',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user_id', 'user_email', 'total_price', 'created_at', 'updated_at']