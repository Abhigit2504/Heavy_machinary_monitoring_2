

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

