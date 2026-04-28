from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Hotel, Room
from .serializers import HotelSerializer, HotelListSerializer, RoomSerializer
from .permissions import IsAdminOrReadOnly, IsOwnerOrAdminOrReadOnly


class HotelViewSet(viewsets.ModelViewSet):
    queryset = Hotel.objects.all().prefetch_related('rooms')
    permission_classes = [IsOwnerOrAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['city', 'country', 'stars']
    search_fields = ['name', 'city', 'country', 'description']
    ordering_fields = ['stars', 'created_at', 'name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return HotelListSerializer
        return HotelSerializer

    def perform_create(self, serializer):
        # Store the user_id from JWT as admin
        user_id = self.request.user.id if self.request.user.is_authenticated else None
        serializer.save(admin_id=user_id)

    @action(detail=True, methods=['get', 'post'])
    def rooms(self, request, pk=None):
        hotel = self.get_object()

        if request.method == 'GET':
            rooms = hotel.rooms.all()
            serializer = RoomSerializer(rooms, many=True)
            return Response(serializer.data)

        data = request.data.copy()
        data['hotel'] = hotel.pk

        serializer = RoomSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def cities(self, request):
        cities = Hotel.objects.values_list('city', flat=True).distinct()
        return Response(sorted(cities))


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.select_related('hotel').all()
    serializer_class = RoomSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['hotel', 'room_type', 'is_available', 'capacity']
    ordering_fields = ['price_per_night', 'capacity', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        if min_price:
            qs = qs.filter(price_per_night__gte=min_price)
        if max_price:
            qs = qs.filter(price_per_night__lte=max_price)
        return qs