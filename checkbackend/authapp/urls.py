# authapp/urls.py

from django.urls import path
from .views import (
    RegisterView, LoginView,
    record_history, list_history,
    clear_history, delete_history_record,
    delete_log_by_id,            
    get_logs,                    
    log_page,                    
    logout_user                    
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('history/record/', record_history),
    path('history/list/', list_history),
    path('history/clear/', clear_history),
    path('history/delete/<int:id>/', delete_history_record),

    # ✅ ADD THESE ROUTES BELOW
    path('logs/', get_logs),  # For fetchLogs
    path('logs/delete/<int:log_id>/', delete_log_by_id),  # ✅ This fixes the 404
    path('logpage/', log_page),
    path('logout/', logout_user, name='logout'),  
]
