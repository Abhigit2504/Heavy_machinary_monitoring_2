








from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count

from .models import DownloadHistory, UserSessionLog, PageVisitLog
from .serializers import DownloadHistorySerializer, UserSessionLogSerializer
from .utils import get_client_ip

# ------------------ Registration ------------------ #
class RegisterView(APIView):
    def post(self, request):
        data = request.data
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        confirm_password = data.get("confirm_password")

        if password != confirm_password:
            return Response({"error": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "User registered successfully",
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        }, status=status.HTTP_201_CREATED)

# ------------------ Login (multi-device supported) ------------------ #
class LoginView(APIView):
    def post(self, request):
        data = request.data
        email_or_username = data.get("email_or_username")
        password = data.get("password")

        # Resolve username from email or direct username
        try:
            user = User.objects.get(email=email_or_username)
            username = user.username
        except User.DoesNotExist:
            username = email_or_username

        user = authenticate(username=username, password=password)

        if user is None:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        # Get device and IP
        ip = get_client_ip(request)
        device = request.META.get('HTTP_USER_AGENT', 'Unknown')

        # Optional: close old active sessions before new login
        # UserSessionLog.objects.filter(user=user, is_active=True).update(is_active=False, logout_time=timezone.now())

        # Create a new active session
        session = UserSessionLog.objects.create(
    user=user,
    ip_address=ip,
    device_info=device,
    is_active=True
)

        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "Login successful",
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "session_id": session.id,  # ✅ Add this
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        })

# ------------------ Logout & End Session ------------------ #




@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_user(request):
    print("📩 Logout API called")
    print("📥 Data:", request.data)
    print("🔐 User:", request.user)

    session_id = request.data.get("session_id")

    if session_id:
        try:
            session = UserSessionLog.objects.get(id=session_id, user=request.user)
            session.logout_time = timezone.now()
            session.is_active = False  # ✅ CORRECT (matches your model field)
            session.save()
            print("✅ Session marked inactive")
            return Response({"message": "Logout successful."})
        except UserSessionLog.DoesNotExist:
            print("❌ Session not found")
            return Response({"error": "Session not found."}, status=404)

    print("❌ No session ID provided")
    return Response({"error": "Missing session_id"}, status=400)





# ------------------ Log page visits ------------------ #
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_page(request):
    user = request.user
    page = request.data.get("page_name")
    filters = request.data.get("filters", {})

    session = UserSessionLog.objects.filter(user=user, is_active=True).last()

    if not session:
        return Response({"error": "No active session"}, status=400)

    PageVisitLog.objects.create(
        session=session,
        page_name=page,
        filters_applied=filters
    )

    return Response({"message": "Page visit logged"})


# ------------------ View session logs (last 30 days) ------------------ #

from collections import defaultdict

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_logs(request):
    user = request.user
    since = timezone.now() - timedelta(days=30)

    logs = UserSessionLog.objects.filter(user=user, login_time__gte=since) \
                                 .prefetch_related('visits') \
                                 .order_by('-login_time')

    grouped = defaultdict(list)
    for log in logs:
        log_data = UserSessionLogSerializer(log).data
        log_data['status'] = "Continuing" if log.is_active else "Ended"
        grouped[log.login_time.date().isoformat()].append(log_data)

    return Response(grouped)




# ---------------------------------delete logs-----------------------------------#

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_log_by_id(request, log_id):
    try:
        log = UserSessionLog.objects.get(id=log_id)
        log.delete()
        return Response({'message': 'Log deleted successfully'})
    except UserSessionLog.DoesNotExist:
        return Response({'error': 'Log not found'}, status=404)






# ------------------ Download History APIs ------------------ #
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_history(request):
    data = request.data.copy()
    user_id = data.get('userId')
    if not user_id:
        return Response({"error": "Missing userId"}, status=400)
    data['user'] = user_id
    serializer = DownloadHistorySerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_history(request):
    try:
        user_id = request.GET.get('user_id')
        if not user_id:
            return Response({"error": "Missing user_id"}, status=400)

        user_id = int(user_id)
        history = DownloadHistory.objects.filter(user__id=user_id).order_by('-downloadedAt')
        serializer = DownloadHistorySerializer(history, many=True)
        return Response(serializer.data)

    except ValueError:
        return Response({"error": "Invalid user_id"}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def clear_history(request):
    DownloadHistory.objects.all().delete()
    return Response({'message': 'History cleared'})

from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import authentication_classes
from rest_framework_simplejwt.authentication import JWTAuthentication




@csrf_exempt
@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_history_record(request, id):
    try:
        record = DownloadHistory.objects.get(id=id, user=request.user)
        record.delete()
        return Response({'message': 'Record deleted'})
    except DownloadHistory.DoesNotExist:
        return Response({'error': 'Record not found or unauthorized'}, status=404)
    

# -------------------------------------dowload logs-----------------------------
# views.py
import io
import pytz
from django.http import FileResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from .models import UserSessionLog, PageVisitLog
from django.shortcuts import get_object_or_404
from datetime import datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_user_logs_pdf(request):
    user = request.user
    session_id = request.GET.get('session_id', None)
    kolkata_tz = pytz.timezone("Asia/Kolkata")

    # Prepare PDF buffer
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # ===== HEADER SECTION =====
    p.setFillColor(colors.HexColor('#4A6FA5'))
    p.rect(0, height - 80, width, 80, fill=True, stroke=False)
    p.setFont("Helvetica-Bold", 20)
    p.setFillColor(colors.white)
    p.drawString(40, height - 50, "USER ACTIVITY REPORT")
    p.setFont("Helvetica", 10)
    p.drawString(width - 150, height - 40, f"Generated: {datetime.now().strftime('%d-%m-%Y %H:%M')}")

    y = height - 100

    # Fetch logs
    if session_id:
        sessions = [get_object_or_404(UserSessionLog, id=session_id, user=user)]
    else:
        sessions = UserSessionLog.objects.filter(user=user).order_by('-login_time')[:50]

    for session in sessions:
        login = session.login_time.astimezone(kolkata_tz).strftime('%d-%m-%Y %H:%M:%S')
        logout = session.logout_time.astimezone(kolkata_tz).strftime('%d-%m-%Y %H:%M:%S') if session.logout_time else 'Active'
        duration = str(session.logout_time - session.login_time).split('.')[0] if session.logout_time else 'Active'
        device = session.device_info or 'Unknown Device'
        ip = session.ip_address or 'N/A'

        # Session Info
        p.setFont("Helvetica-Bold", 12)
        p.setFillColor(colors.black)
        p.drawString(40, y, f"Session ID: {session.id}")
        y -= 16
        p.setFont("Helvetica", 10)
        p.drawString(60, y, f"Login Time: {login}")
        y -= 14
        p.drawString(60, y, f"Logout Time: {logout}")
        y -= 14
        p.drawString(60, y, f"Duration: {duration}")
        y -= 14
        p.drawString(60, y, f"IP Address: {ip}")
        y -= 14
        p.drawString(60, y, f"Device: {device}")
        y -= 20

        # Page visits
        visits = PageVisitLog.objects.filter(session=session).order_by('visited_at')
        if visits.exists():
            p.setFont("Helvetica-Bold", 11)
            p.drawString(60, y, f"Pages Visited: {len(visits)}")
            y -= 16
            p.setFont("Helvetica", 9)
            for visit in visits:
                timestamp = visit.visited_at.astimezone(kolkata_tz).strftime('%H:%M:%S')
                page = visit.page_name
                p.drawString(80, y, f"[{timestamp}] {page}")
                y -= 12
                if visit.filters_applied:
                    p.drawString(100, y, f"Filters: {str(visit.filters_applied)}")
                    y -= 12

                if y < 100:
                    p.showPage()
                    y = height - 100
        else:
            p.setFont("Helvetica-Italic", 9)
            p.drawString(60, y, "No page visits recorded.")
            y -= 20

        y -= 20
        if y < 100:
            p.showPage()
            y = height - 100

    p.save()
    buffer.seek(0)

    filename = f"user_logs_{user.username}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return FileResponse(buffer, as_attachment=True, filename=filename)





# from django.contrib.auth.models import User
# from django.contrib.auth import authenticate
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework_simplejwt.tokens import RefreshToken
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from django.utils import timezone
# from datetime import timedelta
# from django.db.models import Count

# from .models import DownloadHistory, UserSessionLog, PageVisitLog
# from .serializers import DownloadHistorySerializer, UserSessionLogSerializer
# from .utils import get_client_ip

# # ------------------ Registration ------------------ #
# class RegisterView(APIView):
#     def post(self, request):
#         data = request.data
#         first_name = data.get("first_name")
#         last_name = data.get("last_name")
#         username = data.get("username")
#         email = data.get("email")
#         password = data.get("password")
#         confirm_password = data.get("confirm_password")

#         if password != confirm_password:
#             return Response({"error": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST)

#         if User.objects.filter(username=username).exists():
#             return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

#         if User.objects.filter(email=email).exists():
#             return Response({"error": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

#         user = User.objects.create_user(
#             username=username,
#             email=email,
#             password=password,
#             first_name=first_name,
#             last_name=last_name
#         )

#         refresh = RefreshToken.for_user(user)

#         return Response({
#             "message": "User registered successfully",
#             "refresh": str(refresh),
#             "access": str(refresh.access_token),
#             "user": {
#                 "id": user.id,
#                 "username": user.username,
#                 "email": user.email,
#                 "first_name": user.first_name,
#                 "last_name": user.last_name,
#             }
#         }, status=status.HTTP_201_CREATED)

# # ------------------ Login (multi-device supported) ------------------ #
# class LoginView(APIView):
#     def post(self, request):
#         data = request.data
#         email_or_username = data.get("email_or_username")
#         password = data.get("password")

#         # Resolve username from email or direct username
#         try:
#             user = User.objects.get(email=email_or_username)
#             username = user.username
#         except User.DoesNotExist:
#             username = email_or_username

#         user = authenticate(username=username, password=password)

#         if user is None:
#             return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

#         # Get device and IP
#         ip = get_client_ip(request)
#         device = request.META.get('HTTP_USER_AGENT', 'Unknown')

#         # Optional: close old active sessions before new login
#         # UserSessionLog.objects.filter(user=user, is_active=True).update(is_active=False, logout_time=timezone.now())

#         # Create a new active session
#         session = UserSessionLog.objects.create(
#     user=user,
#     ip_address=ip,
#     device_info=device,
#     is_active=True
# )

#         refresh = RefreshToken.for_user(user)

#         return Response({
#             "message": "Login successful",
#             "refresh": str(refresh),
#             "access": str(refresh.access_token),
#             "session_id": session.id,  # ✅ Add this
#             "user": {
#                 "id": user.id,
#                 "username": user.username,
#                 "email": user.email,
#                 "first_name": user.first_name,
#                 "last_name": user.last_name,
#             }
#         })

# # ------------------ Logout & End Session ------------------ #




# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def logout_user(request):
#     print("📩 Logout API called")
#     print("📥 Data:", request.data)
#     print("🔐 User:", request.user)

#     session_id = request.data.get("session_id")

#     if session_id:
#         try:
#             session = UserSessionLog.objects.get(id=session_id, user=request.user)
#             session.logout_time = timezone.now()
#             session.is_active = False  # ✅ CORRECT (matches your model field)
#             session.save()
#             print("✅ Session marked inactive")
#             return Response({"message": "Logout successful."})
#         except UserSessionLog.DoesNotExist:
#             print("❌ Session not found")
#             return Response({"error": "Session not found."}, status=404)

#     print("❌ No session ID provided")
#     return Response({"error": "Missing session_id"}, status=400)





# # ------------------ Log page visits ------------------ #
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def log_page(request):
#     user = request.user
#     page = request.data.get("page_name")
#     filters = request.data.get("filters", {})

#     session = UserSessionLog.objects.filter(user=user, is_active=True).last()

#     if not session:
#         return Response({"error": "No active session"}, status=400)

#     PageVisitLog.objects.create(
#         session=session,
#         page_name=page,
#         filters_applied=filters
#     )

#     return Response({"message": "Page visit logged"})


# # ------------------ View session logs (last 30 days) ------------------ #

# from collections import defaultdict

# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def get_logs(request):
#     user = request.user
#     since = timezone.now() - timedelta(days=30)

#     logs = UserSessionLog.objects.filter(user=user, login_time__gte=since) \
#                                  .prefetch_related('visits') \
#                                  .order_by('-login_time')

#     grouped = defaultdict(list)
#     for log in logs:
#         log_data = UserSessionLogSerializer(log).data
#         log_data['status'] = "Continuing" if log.is_active else "Ended"
#         grouped[log.login_time.date().isoformat()].append(log_data)

#     return Response(grouped)




# # ---------------------------------delete logs-----------------------------------#

# @api_view(['DELETE'])
# @permission_classes([IsAuthenticated])
# def delete_log_by_id(request, log_id):
#     try:
#         log = UserSessionLog.objects.get(id=log_id)
#         log.delete()
#         return Response({'message': 'Log deleted successfully'})
#     except UserSessionLog.DoesNotExist:
#         return Response({'error': 'Log not found'}, status=404)






# # ------------------ Download History APIs ------------------ #
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def record_history(request):
#     data = request.data.copy()
#     user_id = data.get('userId')
#     if not user_id:
#         return Response({"error": "Missing userId"}, status=400)
#     data['user'] = user_id
#     serializer = DownloadHistorySerializer(data=data)
#     if serializer.is_valid():
#         serializer.save()
#         return Response(serializer.data, status=201)
#     return Response(serializer.errors, status=400)

# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def list_history(request):
#     try:
#         user_id = request.GET.get('user_id')
#         if not user_id:
#             return Response({"error": "Missing user_id"}, status=400)

#         user_id = int(user_id)
#         history = DownloadHistory.objects.filter(user__id=user_id).order_by('-downloadedAt')
#         serializer = DownloadHistorySerializer(history, many=True)
#         return Response(serializer.data)

#     except ValueError:
#         return Response({"error": "Invalid user_id"}, status=400)
#     except Exception as e:
#         return Response({"error": str(e)}, status=500)

# @api_view(['DELETE'])
# @permission_classes([IsAuthenticated])
# def clear_history(request):
#     DownloadHistory.objects.all().delete()
#     return Response({'message': 'History cleared'})

# from django.views.decorators.csrf import csrf_exempt
# from rest_framework.decorators import authentication_classes
# from rest_framework_simplejwt.authentication import JWTAuthentication




# @csrf_exempt
# @api_view(['DELETE'])
# @authentication_classes([JWTAuthentication])
# @permission_classes([IsAuthenticated])
# def delete_history_record(request, id):
#     try:
#         record = DownloadHistory.objects.get(id=id, user=request.user)
#         record.delete()
#         return Response({'message': 'Record deleted'})
#     except DownloadHistory.DoesNotExist:
#         return Response({'error': 'Record not found or unauthorized'}, status=404)
    

# # -------------------------------------dowload logs-----------------------------

# import io
# import pytz
# from datetime import datetime
# from django.http import HttpResponse
# from reportlab.lib.pagesizes import A4
# from reportlab.lib.units import inch
# from reportlab.lib import colors
# from reportlab.pdfgen import canvas
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.decorators import api_view, permission_classes
# from .models import UserSessionLog, PageVisitLog

# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def download_user_logs_pdf(request):
#     user = request.user
#     buffer = io.BytesIO()
#     p = canvas.Canvas(buffer, pagesize=A4)
#     width, height = A4
#     kolkata_tz = pytz.timezone("Asia/Kolkata")

#     try:
#         device_ip = request.META.get('REMOTE_ADDR')
#         device_name = request.META.get('HTTP_USER_AGENT', 'Unknown Device')

#         # Header
#         p.setFillColor(colors.darkblue)
#         p.setFont("Helvetica-Bold", 20)
#         p.drawString(50, height - 50, "📄 User Activity Report")

#         p.setFillColor(colors.black)
#         p.setFont("Helvetica", 12)
#         p.drawString(50, height - 80, f"👤 Username: {user.username}")
#         p.drawString(50, height - 100, f"📱 Device: {device_name}")
#         p.drawString(50, height - 120, f"🌐 IP Address: {device_ip}")

#         y = height - 160

#         # SESSION LOGS
#         p.setFillColor(colors.darkgreen)
#         p.setFont("Helvetica-Bold", 14)
#         p.drawString(50, y, "🟢 Session Logs")
#         y -= 20

#         p.setFont("Helvetica", 11)
#         p.setFillColor(colors.black)
#         session_logs = UserSessionLog.objects.filter(user=user).order_by('-login_time')[:10]
#         for log in session_logs:
#             login_time = log.login_time.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M %p')
#             logout_time = log.logout_time.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M %p') if log.logout_time else 'N/A'
#             p.drawString(60, y, f"🔓 Login: {login_time}   🔒 Logout: {logout_time}")
#             y -= 18
#             if y < 100:
#                 p.showPage()
#                 y = height - 50

#         y -= 10

#         # PAGE VISIT LOGS
#         p.setFillColor(colors.darkred)
#         p.setFont("Helvetica-Bold", 14)
#         p.drawString(50, y, "📑 Page Visit Logs")
#         y -= 20

#         p.setFont("Helvetica", 11)
#         p.setFillColor(colors.black)
#         visit_logs = PageVisitLog.objects.filter(session__user=user).order_by('-visited_at')[:10]
#         for log in visit_logs:
#             visited_at = log.visited_at.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M %p')
#             p.drawString(60, y, f"📌 {log.page_name} — {visited_at}")
#             y -= 18
#             if y < 100:
#                 p.showPage()
#                 y = height - 50

#         # Final Save
#         p.save()
#         buffer.seek(0)

#         response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
#         response['Content-Disposition'] = 'attachment; filename="user_logs.pdf"'
#         return response

#     except Exception as e:
#         print("❌ PDF generation error:", e)
#         return Response({"error": "Could not generate PDF"}, status=500)



