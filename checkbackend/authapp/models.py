# authapp/models.py

from django.db import models
from django.contrib.auth.models import User

class DownloadHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    type = models.CharField(max_length=100)
    fromDate = models.DateTimeField()
    toDate = models.DateTimeField()
    downloadedAt = models.DateTimeField(auto_now_add=True)


class UserSessionLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    ip_address = models.GenericIPAddressField()
    device_info = models.TextField()
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username} ({self.ip_address}) - {'Active' if self.is_active else 'Ended'}"



class PageVisitLog(models.Model):
    session = models.ForeignKey(UserSessionLog, on_delete=models.CASCADE, related_name='visits')
    page_name = models.CharField(max_length=100)
    visited_at = models.DateTimeField(auto_now_add=True)
    filters_applied = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.page_name} by {self.session.user.username} at {self.visited_at}"
