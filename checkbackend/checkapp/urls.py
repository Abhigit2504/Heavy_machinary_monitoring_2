
# # urls.py
# from django.urls import path
# from . import views

# urlpatterns = [
#     path('durations/', views.durations_view),
#     path('hourly-usage/', views.hourly_usage_view),
#     path('movement-hourly/', views.movement_by_hour_view),
#     path('cumulative/', views.cumulative_view),
#     path('machines/', views.all_machines_view),
#     path('machine/<int:gfrid>/', views.machine_detail_view),
# ]




# checkapp/urls.py
# from django.urls import path
# from . import views

# urlpatterns = [
#     path('machines/', views.all_machines_view),
#     path('machine-status/', views.machine_status),
#     path('hourly-usage/', views.hourly_usage),
#     path('movement-analysis/', views.movement_analysis),
#     path('cumulative-analysis/', views.cumulative_analysis),
#     path('machine/<int:gfrid>/', views.machine_detail_view),  # This should match your view
#     path('movement-duration/', views.movement_duration_from_bigint),

# ]



from django.urls import path
from . import views

urlpatterns = [
    path('machines/', views.all_machines_view),
    path('machine/<int:gfrid>/', views.machine_detail_view),
    path('machine-status/', views.machine_status),
    path('movement-duration/', views.movement_analysis),
    path('cumulative-analysis/', views.cumulative_analysis),
    # path('priority-usage/', views.prioritized_machine_usage),
    path('pdf-data/', views.machine_pdf_data),
    path('download/all-machines-pdf/', views.download_all_machines_pdf),
    path('download/machine/<str:gfrid>/pdf/', views.download_single_machine_pdf),

]

