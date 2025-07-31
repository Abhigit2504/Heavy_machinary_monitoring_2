








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
import json
import logging
from datetime import datetime
from django.http import HttpResponse
from django.db.models import Q
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import UserSessionLog, PageVisitLog

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_user_logs_pdf(request):
    user = request.user
    kolkata_tz = pytz.timezone("Asia/Kolkata")
    
    try:
        session_id = request.GET.get('session_id')
        start_datetime_str = request.GET.get('start_datetime')
        end_datetime_str = request.GET.get('end_datetime')

        logger.info(
            f"PDF download requested by user {user.id}. "
            f"Params: session_id={session_id}, "
            f"start={start_datetime_str}, end={end_datetime_str}"
        )

        def parse_datetime(dt_str):
            if not dt_str:
                return None
            try:
                dt = datetime.strptime(dt_str, '%Y-%m-%dT%H:%M')
                return kolkata_tz.localize(dt)
            except ValueError:
                logger.warning(f"Invalid datetime format: {dt_str}")
                raise ValueError("Invalid datetime format. Expected YYYY-MM-DDTHH:MM")

        start_datetime = parse_datetime(start_datetime_str)
        end_datetime = parse_datetime(end_datetime_str)

        if start_datetime and end_datetime and start_datetime > end_datetime:
            return Response(
                {"error": "Start datetime must be before end datetime"},
                status=status.HTTP_400_BAD_REQUEST,
                content_type='application/json'
            )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()

        elements.append(Paragraph("USER ACTIVITY REPORT", styles['Heading1']))
        elements.append(Spacer(1, 12))

        filter_info = []
        if session_id:
            filter_info.append(f"Session ID: {session_id}")
        if start_datetime:
            filter_info.append(f"From: {start_datetime.strftime('%I:%M %p IST %d %b %Y')}")
        if end_datetime:
            filter_info.append(f"To: {end_datetime.strftime('%I:%M %p IST %d %b %Y')}")

        if filter_info:
            elements.append(Paragraph(f"<b>Filters:</b> {', '.join(filter_info)}", styles['Normal']))

        elements.append(Paragraph(
            f"<b>Generated:</b> {datetime.now().astimezone(kolkata_tz).strftime('%I:%M %p IST %d %b %Y')}",
            styles['Normal']
        ))
        elements.append(Spacer(1, 15))

        sessions = UserSessionLog.objects.filter(user=user)
        if session_id:
            sessions = sessions.filter(id=session_id)
        if start_datetime:
            sessions = sessions.filter(login_time__gte=start_datetime)
        if end_datetime:
            sessions = sessions.filter(
                Q(logout_time__lte=end_datetime) |
                Q(logout_time__isnull=True, login_time__lte=end_datetime)
            )

        sessions = sessions.order_by('-login_time')[:100]
        logger.info(f"Found {sessions.count()} sessions matching criteria")

        if not sessions.exists():
            elements.append(Paragraph("No sessions found matching the criteria.", styles['Italic']))
        else:
            for session in sessions:
                login_time = session.login_time.astimezone(kolkata_tz)
                login_str = login_time.strftime('%I:%M %p IST %d %b %Y')

                if session.logout_time:
                    logout_time = session.logout_time.astimezone(kolkata_tz)
                    logout_str = logout_time.strftime('%I:%M %p IST %d %b %Y')
                    duration = str(session.logout_time - session.login_time).split('.')[0]
                else:
                    logout_str = 'Active'
                    duration = 'Active'

                session_data = [
                    ["Session ID:", str(session.id)],
                    ["Login Time:", login_str],
                    ["Logout Time:", logout_str],
                    ["Duration:", duration],
                    ["IP Address:", session.ip_address or 'N/A'],
                    ["Device:", session.device_info or 'Unknown Device']
                ]

                session_table = Table(session_data, colWidths=[120, 400])
                session_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ]))
                elements.append(session_table)
                elements.append(Spacer(1, 15))

                visits = PageVisitLog.objects.filter(session=session)
                if start_datetime:
                    visits = visits.filter(visited_at__gte=start_datetime)
                if end_datetime:
                    visits = visits.filter(visited_at__lte=end_datetime)

                visits = visits.order_by('visited_at')
                logger.debug(f"Found {visits.count()} visits for session {session.id}")

                if visits.exists():
                    table_data = [
                        ["Page Name", "Visit Time", "Filters Applied"]
                    ]

                    for visit in visits:
                        visit_time = visit.visited_at.astimezone(kolkata_tz)
                        filters = visit.filters_applied

                        if isinstance(filters, dict):
                            filters_str = ", ".join(f"{k}: {v}" for k, v in filters.items())
                        elif isinstance(filters, str):
                            try:
                                filters_dict = json.loads(filters)
                                filters_str = ", ".join(f"{k}: {v}" for k, v in filters_dict.items())
                            except:
                                filters_str = filters
                        else:
                            filters_str = str(filters)

                        table_data.append([
                            Paragraph(visit.page_name or 'N/A', styles['Normal']),
                            Paragraph(visit_time.strftime('%I:%M %p IST %d %b %Y'), styles['Normal']),
                            Paragraph(filters_str[:300] + "..." if len(filters_str) > 300 else filters_str, styles['Normal']),
                        ])

                    visits_table = Table(table_data, colWidths=[130, 110, 270], repeatRows=1)
                    visits_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4A6FA5')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                        ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('WORDWRAP', (0, 0), (-1, -1), 'CJK'),
                    ]))
                    elements.append(visits_table)
                else:
                    elements.append(Paragraph("No visits recorded in this timeframe", styles['Italic']))

                elements.append(Spacer(1, 30))

        doc.build(elements)
        pdf_content = buffer.getvalue()
        buffer.seek(0)

        if not pdf_content:
            logger.error("Generated PDF is empty")
            raise ValueError("PDF generation failed - empty content")

        logger.info(f"Successfully generated PDF ({len(pdf_content)} bytes)")

        response = HttpResponse(
            pdf_content,
            content_type='application/pdf',
            status=status.HTTP_200_OK
        )
        response['Content-Disposition'] = (
            f'attachment; filename="user_activity_'
            f'{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
        )
        response['Content-Length'] = len(pdf_content)
        return response

    except ValueError as e:
        logger.warning(f"Validation error: {str(e)}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
            content_type='application/json'
        )
    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}", exc_info=True)
        return Response(
            {"error": "Failed to generate PDF. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content_type='application/json'
        )

  

