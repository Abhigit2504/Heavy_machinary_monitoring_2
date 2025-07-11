# authapp/serializers.py

from rest_framework import serializers
from .models import DownloadHistory, UserSessionLog, PageVisitLog

class DownloadHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DownloadHistory
        fields = '__all__'


class PageVisitLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageVisitLog
        fields = ['page_name', 'visited_at', 'filters_applied']

class UserSessionLogSerializer(serializers.ModelSerializer):
    visits = PageVisitLogSerializer(many=True, read_only=True)

    class Meta:
        model = UserSessionLog
        fields = '__all__'
