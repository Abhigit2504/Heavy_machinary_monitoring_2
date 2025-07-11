

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









# from django.contrib.auth.models import User
# from django.contrib.auth import authenticate
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework_simplejwt.tokens import RefreshToken
# from rest_framework.decorators import api_view
# from rest_framework.response import Response
# from rest_framework import status
# from .models import DownloadHistory
# from .serializers import DownloadHistorySerializer

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


# class LoginView(APIView):
#     def post(self, request):
#         data = request.data
#         email_or_username = data.get("email_or_username")
#         password = data.get("password")

#         try:
#             user = User.objects.get(email=email_or_username)
#             username = user.username
#         except User.DoesNotExist:
#             username = email_or_username

#         user = authenticate(username=username, password=password)

#         if user is None:
#             return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

#         refresh = RefreshToken.for_user(user)

#         return Response({
#             "message": "Login successful",
#             "refresh": str(refresh),
#             "access": str(refresh.access_token),
#             "user": {
#                 "id": user.id,
#                 "username": user.username,
#                 "email": user.email,
#                 "first_name": user.first_name,
#                 "last_name": user.last_name,
#             }
#         }, status=status.HTTP_200_OK)




# @api_view(['POST'])
# def record_history(request):
#     data = request.data.copy()

#     # Convert userId → user
#     user_id = data.get('userId')
#     if not user_id:
#         return Response({"error": "Missing userId"}, status=status.HTTP_400_BAD_REQUEST)

#     data['user'] = user_id  # serializer expects 'user' field

#     serializer = DownloadHistorySerializer(data=data)
#     if serializer.is_valid():
#         serializer.save()
#         return Response(serializer.data, status=status.HTTP_201_CREATED)
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# @api_view(['GET'])
# def list_history(request):
#     try:
#         user_id = request.GET.get('user_id')
#         if not user_id:
#             return Response({"error": "Missing user_id"}, status=status.HTTP_400_BAD_REQUEST)

#         # Optional: Convert to int to catch bad values early
#         user_id = int(user_id)

#         history = DownloadHistory.objects.filter(user__id=user_id).order_by('-downloadedAt')
#         serializer = DownloadHistorySerializer(history, many=True)
#         return Response(serializer.data)

#     except ValueError:
#         return Response({"error": "Invalid user_id"}, status=status.HTTP_400_BAD_REQUEST)
#     except Exception as e:
#         return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# @api_view(['DELETE'])
# def clear_history(request):
#     DownloadHistory.objects.all().delete()
#     return Response({'message': 'History cleared'})

# @api_view(['DELETE'])
# def delete_history_record(request, id):
#     try:
#         record = DownloadHistory.objects.get(id=id)
#         record.delete()
#         return Response({'message': 'Record deleted'})
#     except DownloadHistory.DoesNotExist:
#         return Response({'error': 'Record not found'}, status=404)