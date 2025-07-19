
from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/',include('checkapp.urls')),
    path('api/auth/', include('authapp.urls')),
]

