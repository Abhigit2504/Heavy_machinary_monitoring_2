




from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import datetime, timedelta
from .models import MachineEvent
import pandas as pd
from reportlab.graphics.shapes import Drawing, Rect
import json
import pytz
import traceback
from django.utils.timezone import make_aware, is_naive, now

MOVEMENT_CODES = {
    "0x00020000": "up",
    "0x00010000": "down",
    "0x00040000": "forward",
    "0x00080000": "reverse"
}

def load_machine_data(gfrid=None, from_date=None, to_date=None):
    qs = MachineEvent.objects.all()
    if gfrid:
        qs = qs.filter(GFRID=gfrid)

    current_time = timezone.now()
    tz = pytz.timezone("Asia/Kolkata")

    try:
        from_date = pd.to_datetime(from_date, utc=True, errors='coerce') if from_date else None
        to_date = pd.to_datetime(to_date, utc=True, errors='coerce') if to_date else None

        if from_date is None or pd.isna(from_date):
            from_date = current_time - timedelta(hours=1)
        if to_date is None or pd.isna(to_date):
            to_date = current_time

        from_date = from_date.tz_convert('Asia/Kolkata').to_pydatetime() if from_date.tzinfo else tz.localize(from_date).to_pydatetime()
        to_date = to_date.tz_convert('Asia/Kolkata').to_pydatetime() if to_date.tzinfo else tz.localize(to_date).to_pydatetime()

        if from_date >= to_date:
            to_date = from_date + timedelta(minutes=1)

    except Exception as e:
        print(f"Date parse error: {e}")
        from_date = current_time - timedelta(days=1)
        to_date = current_time

    qs = qs.filter(TS__range=[from_date, to_date])

    if not qs.exists():
        return pd.DataFrame()

    df = pd.DataFrame(list(qs.values()))

    if df.empty:
        return df

    df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
    df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce').fillna(current_time)
    df['TS_BigInt'] = pd.to_datetime(df['TS_BigInt'], unit='s', errors='coerce')
    df['TS_OFF_BigInt'] = pd.to_datetime(df['TS_OFF_BigInt'], unit='s', errors='coerce').fillna(current_time)

    df['TS'] = df['TS'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
    df['TS_OFF'] = df['TS_OFF'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
    df['TS_BigInt'] = df['TS_BigInt'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
    df['TS_OFF_BigInt'] = df['TS_OFF_BigInt'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)

    df['duration'] = (df['TS_OFF'] - df['TS']).dt.total_seconds()

    return df





@csrf_exempt
def all_machines_view(request):
    try:
        gfrid_param = request.GET.get("gfrid")
        queryset = MachineEvent.objects.all()

        if gfrid_param:
            queryset = queryset.filter(GFRID=gfrid_param)

        gfrids = queryset.order_by('GFRID').values_list('GFRID', flat=True).distinct()
        result = []

        for gfrid in gfrids:
            latest_event = MachineEvent.objects.filter(GFRID=gfrid).order_by('-TS').first()
            result.append({
                "gfrid": gfrid,
                "status": int(latest_event.status) if latest_event and latest_event.status is not None else None,
                "last_alert": latest_event.alert if latest_event else None,
                "last_seen": latest_event.TS.strftime('%Y-%m-%d %H:%M:%S') if latest_event and latest_event.TS else None,
                "telemetry": latest_event.jsonFile if latest_event and latest_event.jsonFile else {}
            })

        return JsonResponse(result, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)
    
    
@csrf_exempt
def machine_detail_view(request, gfrid):
    try:
        events = MachineEvent.objects.filter(GFRID=gfrid).order_by('-TS')
        data = []

        for e in events:
            json_data = e.jsonFile or {}

            data.append({
                "id": e.id,
                "alert": e.alert,
                "status": e.status,
                "timestamp": e.TS.astimezone(pytz.utc).isoformat() if e.TS else None,
                "timestamp_off": e.TS_OFF.astimezone(pytz.utc).isoformat() if e.TS_OFF else None,
                "json_data": json_data,  # Full sensor data
                "telemetry_keys": list(json_data.keys()),  # Dynamic list of available keys
            })

        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)






from django.db import models
# If not already imported at the top of the file
import traceback


@csrf_exempt
def machine_status(request):
    try:
        gfrid = request.GET.get("gfrid")
        if not gfrid:
            return JsonResponse({'error': 'gfrid is required'}, status=400)

        from_date_raw = request.GET.get("from_date")
        to_date_raw = request.GET.get("to_date")
        tz = pytz.timezone("Asia/Kolkata")
        now_dt = now()

        from_date = pd.to_datetime(from_date_raw, errors='coerce') if from_date_raw else now_dt - timedelta(hours=1)
        to_date = pd.to_datetime(to_date_raw, errors='coerce') if to_date_raw else now_dt

        if is_naive(from_date): from_date = tz.localize(from_date)
        if is_naive(to_date): to_date = tz.localize(to_date)
        if from_date >= to_date:
            to_date = from_date + timedelta(minutes=1)

        # ✅ Include events overlapping with selected window
        qs = MachineEvent.objects.filter(
            GFRID=gfrid
        ).filter(
            TS__lte=to_date
        ).filter(
            models.Q(TS_OFF__isnull=True) | models.Q(TS_OFF__gte=from_date)
        )

        df = pd.DataFrame(list(qs.values('id', 'status', 'TS', 'TS_OFF')))
        if df.empty:
            return JsonResponse({'on_time_sec': 0, 'off_time_sec': 0, 'status_records': []})

        df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
        df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce')
        df['end_time'] = df['TS_OFF'].combine_first(df['TS'].shift(-1))
        df['end_time'] = df['end_time'].fillna(to_date)

        records = []
        total_on = 0
        total_off = 0
        prev_end = from_date

        for _, row in df.iterrows():
            if pd.isna(row['TS']) or pd.isna(row['end_time']):
                continue

            ts = row['TS'].astimezone(pytz.utc)
            te = row['end_time'].astimezone(pytz.utc)

            if prev_end and ts > prev_end:
                gap_duration = (ts - prev_end).total_seconds()
                total_off += gap_duration
                records.append({
                    'id': None,
                    'status': 0,
                    'start_time': prev_end.astimezone(pytz.utc).isoformat(),
                    'end_time': ts.isoformat(),
                    'duration_sec': gap_duration
                })

            overlap_start = max(ts, from_date.astimezone(pytz.utc))
            overlap_end = min(te, to_date.astimezone(pytz.utc))

            if overlap_start >= overlap_end:
                prev_end = te
                continue

            duration = (overlap_end - overlap_start).total_seconds()
            if row['status'] == 1:
                total_on += duration
            else:
                total_off += duration

            records.append({
                'id': row['id'],
                'status': int(row['status']),
                'start_time': overlap_start.isoformat(),
                'end_time': overlap_end.isoformat(),
                'duration_sec': duration
            })

            prev_end = te

        if prev_end < to_date:
            gap_duration = (to_date.astimezone(pytz.utc) - prev_end).total_seconds()
            total_off += gap_duration
            records.append({
                'id': None,
                'status': 0,
                'start_time': prev_end.isoformat(),
                'end_time': to_date.astimezone(pytz.utc).isoformat(),
                'duration_sec': gap_duration
            })
 # ✅ Extract telemetry keys and latest value in time range
        telemetry_events = MachineEvent.objects.filter(
            GFRID=gfrid,
            TS__range=(from_date, to_date)
        ).order_by('-TS')

        telemetry_keys_set = set()
        latest_telemetry = {}

        for event in telemetry_events:
            json_data = event.jsonFile or {}
            telemetry_keys_set.update(json_data.keys())

            # capture the first (latest) non-empty
            if not latest_telemetry:
                latest_telemetry = json_data

        return JsonResponse({
            'on_time_sec': total_on,
            'off_time_sec': total_off,
            'status_records': records,
            'telemetry_keys': sorted(list(telemetry_keys_set)),
            'latest_telemetry': latest_telemetry
        })

    except Exception as e:
        print("❌ ERROR:", e)
        print(traceback.format_exc())
        return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)


@csrf_exempt
def movement_analysis(request):
    try:
        gfrid = request.GET.get("gfrid")
        if not gfrid:
            return JsonResponse({'error': 'gfrid is required'}, status=400)

        from_date = request.GET.get("from_date")
        to_date = request.GET.get("to_date")
        df = load_machine_data(gfrid, from_date, to_date)

        if df.empty:
            return JsonResponse({'movements': []})

        df['movement'] = df['alert'].map(MOVEMENT_CODES)

        movement_records = []
        for _, row in df.iterrows():
            if pd.isna(row['TS_BigInt']) or pd.isna(row['TS_OFF_BigInt']):
                continue

            start_utc = row['TS_BigInt'].astimezone(pytz.utc)
            end_utc = row['TS_OFF_BigInt'].astimezone(pytz.utc)

            movement_label = row.get('movement')
            if not isinstance(movement_label, str) or movement_label.strip() == "":
                movement_label = f"alert_{int(row.get('alertNotify_id') or 0)}" if pd.notna(row.get('alertNotify_id')) else f"alert_{row['alert']}"

            movement_records.append({
                'id': row['id'],
                'alert': row['alert'],
                'movement': movement_label,
                'start_time': start_utc.isoformat(),
                'end_time': end_utc.isoformat(),
                'duration': (end_utc - start_utc).total_seconds(),
                'alertNotify_id': row.get('alertNotify_id')
            })

        return JsonResponse({'movements': movement_records})
    except Exception as e:
        return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

@csrf_exempt
def cumulative_analysis(request):
    try:
        gfrid = request.GET.get("gfrid")
        if not gfrid:
            return JsonResponse({'error': 'gfrid is required'}, status=400)

        from_date = request.GET.get("from_date")
        to_date = request.GET.get("to_date")

        tz = pytz.timezone("Asia/Kolkata")
        now_dt = now()

        from_dt = pd.to_datetime(from_date, errors='coerce') if from_date else now_dt - timedelta(hours=1)
        to_dt = pd.to_datetime(to_date, errors='coerce') if to_date else now_dt

        if is_naive(from_dt): from_dt = tz.localize(from_dt)
        if is_naive(to_dt): to_dt = tz.localize(to_dt)
        if from_dt >= to_dt:
            to_dt = from_dt + timedelta(minutes=1)

        qs = MachineEvent.objects.filter(
            GFRID=gfrid
        ).filter(
            TS__lte=to_dt
        ).filter(
            models.Q(TS_OFF__isnull=True) | models.Q(TS_OFF__gte=from_dt)
        ).order_by('TS')

        df = pd.DataFrame(list(qs.values('id', 'status', 'TS', 'TS_OFF')))

        total_on_sec = 0
        total_off_sec = 0
        on_off_records = []

        if not df.empty:
            df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
            df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce')
            df['end_time'] = df['TS_OFF'].combine_first(df['TS'].shift(-1))
            df['end_time'] = df['end_time'].fillna(to_dt)

            prev_end = from_dt
            for _, row in df.iterrows():
                if pd.isna(row['TS']) or pd.isna(row['end_time']):
                    continue

                ts = row['TS'].astimezone(pytz.utc)
                te = row['end_time'].astimezone(pytz.utc)

                if prev_end and ts > prev_end:
                    gap = (ts - prev_end).total_seconds()
                    total_off_sec += gap
                    on_off_records.append({
                        'status': 0,
                        'start_time': prev_end.astimezone(pytz.utc).isoformat(),
                        'end_time': ts.isoformat(),
                        'duration_sec': gap
                    })

                overlap_start = max(ts, from_dt.astimezone(pytz.utc))
                overlap_end = min(te, to_dt.astimezone(pytz.utc))
                if overlap_start < overlap_end:
                    duration = (overlap_end - overlap_start).total_seconds()
                    if row['status'] == 1:
                        total_on_sec += duration
                    else:
                        total_off_sec += duration

                    on_off_records.append({
                        'status': int(row['status']),
                        'start_time': overlap_start.isoformat(),
                        'end_time': overlap_end.isoformat(),
                        'duration_sec': duration
                    })

                prev_end = te

            if prev_end < to_dt:
                off_gap = (to_dt.astimezone(pytz.utc) - prev_end).total_seconds()
                total_off_sec += off_gap
                on_off_records.append({
                    'status': 0,
                    'start_time': prev_end.isoformat(),
                    'end_time': to_dt.astimezone(pytz.utc).isoformat(),
                    'duration_sec': off_gap
                })

        movement_df = load_machine_data(gfrid, from_dt.isoformat(), to_dt.isoformat())
        if not movement_df.empty:
            movement_df['movement'] = movement_df['alert'].map(MOVEMENT_CODES)
            movement_df['TS_BigInt'] = pd.to_datetime(movement_df['TS_BigInt'], unit='s', errors='coerce')
            movement_df['TS_OFF_BigInt'] = pd.to_datetime(movement_df['TS_OFF_BigInt'], unit='s', errors='coerce')

            movement_df = movement_df.dropna(subset=['TS_BigInt', 'TS_OFF_BigInt'])
            movement_df['duration'] = (movement_df['TS_OFF_BigInt'] - movement_df['TS_BigInt']).dt.total_seconds()

            grouped = (
                movement_df.groupby('alertNotify_id')['duration']
                .sum()
                .reset_index()
            )

            movement_summary = [
                {
                    'alertNotify_id': int(row['alertNotify_id']) if pd.notna(row['alertNotify_id']) else None,
                    'duration_hr': round(row['duration'] / 3600, 2)
                }
                for _, row in grouped.iterrows()
            ]
        else:
            movement_summary = []

        return JsonResponse({
            'on_time_hr': round(total_on_sec / 3600, 2),
            'off_time_hr': round(total_off_sec / 3600, 2),
            'on_off_records': on_off_records,
            'movements_by_alertNotify': movement_summary
        })

    except Exception as e:
        return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)



@csrf_exempt
def prioritized_machine_usage(request):
    try:
        tz = pytz.timezone("Asia/Kolkata")
        now_dt = now()

        from_raw = request.GET.get("from_date")
        to_raw = request.GET.get("to_date")

        from_dt = pd.to_datetime(from_raw, errors='coerce', utc=True)
        to_dt = pd.to_datetime(to_raw, errors='coerce', utc=True)

        if pd.isna(from_dt):
            from_dt = now_dt - timedelta(hours=1)

        if pd.isna(to_dt):
            to_dt = now_dt

        if is_naive(from_dt):
            from_dt = make_aware(from_dt)
        if is_naive(to_dt):
            to_dt = make_aware(to_dt)

        if from_dt >= to_dt:
            to_dt = from_dt + timedelta(minutes=1)

        total_time_range_sec = (to_dt - from_dt).total_seconds()

        all_gfrids = MachineEvent.objects.values_list("GFRID", flat=True).distinct()
        result = []

        for gfrid in all_gfrids:
            events = MachineEvent.objects.filter(GFRID=gfrid).order_by("TS")
            df = pd.DataFrame(list(events.values("status", "TS", "TS_OFF")))

            if df.empty:
                result.append({
                    "gfrid": gfrid,
                    "on_sec": 0,
                    "off_sec": total_time_range_sec,
                    "on_percent": 0.0,
                    "off_percent": 100.0
                })
                continue

            df["TS"] = pd.to_datetime(df["TS"], errors="coerce")
            df["TS_OFF"] = pd.to_datetime(df["TS_OFF"], errors="coerce")
            df["end_time"] = df["TS_OFF"].combine_first(df["TS"].shift(-1))
            df["end_time"] = df["end_time"].fillna(to_dt)

            total_on = 0
            total_off = 0
            prev_end = from_dt

            for _, row in df.iterrows():
                ts = row["TS"]
                te = row["end_time"]

                if pd.isna(ts) or pd.isna(te):
                    continue

                ts = make_aware(ts) if is_naive(ts) and pd.notna(ts) else ts
                te = make_aware(te) if is_naive(te) and pd.notna(te) else te

                ts = ts.astimezone(pytz.utc)
                te = te.astimezone(pytz.utc)

                if prev_end and ts > prev_end:
                    gap = (ts - prev_end).total_seconds()
                    total_off += gap

                overlap_start = max(ts, from_dt.astimezone(pytz.utc))
                overlap_end = min(te, to_dt.astimezone(pytz.utc))
                if overlap_start < overlap_end:
                    dur = (overlap_end - overlap_start).total_seconds()
                    if row["status"] == 1:
                        total_on += dur
                    else:
                        total_off += dur

                prev_end = te

            if prev_end < to_dt:
                total_off += (to_dt.astimezone(pytz.utc) - prev_end).total_seconds()

            result.append({
                "gfrid": gfrid,
                "on_sec": round(total_on, 2),
                "off_sec": round(total_off, 2),
                "on_percent": 0.0,
                "off_percent": 0.0
            })

        total_on_sec_all = sum(m['on_sec'] for m in result) or 1

        for r in result:
            r['on_percent'] = round((r['on_sec'] / total_on_sec_all) * 100, 2)
            r['off_percent'] = round(100 - r['on_percent'], 2)

        result.sort(key=lambda x: x["on_sec"], reverse=True)

        return JsonResponse(result, safe=False)

    except Exception as e:
        return JsonResponse({
            "error": str(e),
            "trace": traceback.format_exc()
        }, status=500)




@csrf_exempt
def machine_pdf_data(request):
    gfrid = request.GET.get('gfrid')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    # Reuse your load_machine_data() or custom logic
    df = load_machine_data(gfrid, from_date, to_date)

    records = df.to_dict(orient='records')
    return JsonResponse({'machine_data': records})





from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from io import BytesIO
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics.charts.piecharts import Pie
from datetime import datetime, timedelta
import pandas as pd
import pytz
import traceback

def format_duration(seconds):
    try:
        seconds = int(seconds)
        hrs, rem = divmod(seconds, 3600)
        mins, secs = divmod(rem, 60)
        return f"{hrs:02}:{mins:02}:{secs:02}"
    except:
        return "00:00:00"

@csrf_exempt
def download_single_machine_pdf(request, gfrid):
    try:
        from_date = request.GET.get("from_date")
        to_date = request.GET.get("to_date")
        if not from_date or not to_date:
            return HttpResponse("from_date and to_date are required", status=400)

        from_dt = pd.to_datetime(from_date)
        to_dt = pd.to_datetime(to_date)
        tz = pytz.timezone("Asia/Kolkata")

        df = load_machine_data(gfrid, from_dt.isoformat(), to_dt.isoformat())
        if df.empty:
            return HttpResponse("No data found for this GFRID", status=404)

        df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
        df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce')

        for col in ['TS', 'TS_OFF']:
            df[col] = df[col].apply(lambda x: x.tz_localize('UTC').tz_convert(tz) if pd.notnull(x) and x.tzinfo is None else x)

        to_dt_tz = to_dt.tz_localize(tz) if to_dt.tzinfo is None else to_dt
        df['TS_OFF'] = df['TS_OFF'].apply(lambda x: min(x, to_dt_tz) if pd.notnull(x) else to_dt_tz)

        df = df[df['TS_OFF'] > df['TS']].copy()

        df['TS'] = pd.to_datetime(df['TS'], errors='coerce', utc=True).dt.tz_convert(tz)
        df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce', utc=True).dt.tz_convert(tz)

        df['duration_sec'] = (df['TS_OFF'] - df['TS']).dt.total_seconds()
        df['status'] = df['status'].fillna(0).astype(int)
        df['date'] = df['TS'].dt.date

        # Split across days
        def split_across_days(row):
            segments = []
            start, end = row['TS'], row['TS_OFF']
            while start.date() < end.date():
                day_end = datetime.combine(start.date(), datetime.max.time()).replace(tzinfo=start.tzinfo)
                segments.append({
                    'start': start, 'end': day_end, 'status': row['status'],
                    'duration_sec': (day_end - start).total_seconds(), 'date': start.date()
                })
                start = day_end + timedelta(seconds=1)
            segments.append({
                'start': start, 'end': end, 'status': row['status'],
                'duration_sec': (end - start).total_seconds(), 'date': end.date()
            })
            return segments

        all_segments = []
        for _, row in df.iterrows():
            all_segments.extend(split_across_days(row))

        seg_df = pd.DataFrame(all_segments).drop_duplicates(subset=['start', 'end', 'status'])

        # ==== PDF Setup ====
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=25, leftMargin=25, topMargin=30, bottomMargin=30)
        styles = getSampleStyleSheet()
        elements = []

        title = Paragraph(f"<b style='font-size:18pt'>Machine Usage Report</b><br/><br/><b>GFRID:</b> {gfrid}<br/><b>From:</b> {from_date}<br/><b>To:</b> {to_date}", styles["Title"])
        elements.append(title)
        elements.append(Spacer(1, 14))

        # ==== ON/OFF Pie Chart (No Labels) ====
        summary = seg_df.groupby('status')['duration_sec'].sum()
        if not summary.empty and summary.sum() > 0:
            pie_data = [summary.get(1, 0), summary.get(0, 0)]
            colors_list = [colors.green, colors.red]
            legend_items = [("ON", format_duration(pie_data[0]), colors.green), ("OFF", format_duration(pie_data[1]), colors.red)]

            d = Drawing(300, 180)
            pie = Pie()
            pie.x = 65
            pie.y = 30
            pie.width = 120
            pie.height = 120
            pie.data = pie_data
            pie.labels = [''] * len(pie_data)
            pie.slices[0].fillColor = colors.green
            pie.slices[1].fillColor = colors.red
            d.add(pie)
            elements.append(Paragraph("<b>ON/OFF Duration Summary</b>", styles["Heading3"]))
            elements.append(d)

            # Legend
            legend_data = []
            for name, duration, color in legend_items:
                legend_data.append(['', Paragraph(f"<font size=9>{name}: {duration}</font>", styles["Normal"])])
            legend_table = Table(legend_data, colWidths=[12, 300])
            legend_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('BOX', (0, 0), (-1, -1), 0.25, colors.black),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
            ]))
            for i, (_, _, color) in enumerate(legend_items):
                legend_table._cellvalues[i][0] = Drawing(10, 10)
                legend_table._cellvalues[i][0].add(Rect(0, 0, 10, 10, fillColor=color))

            elements.append(legend_table)
            elements.append(Spacer(1, 20))

        # ==== Movement Pie Chart ====
        movement_df = df.dropna(subset=['alert', 'TS', 'TS_OFF']).copy()
        movement_df['alertNotify_id'] = movement_df['alertNotify_id'].fillna(0).astype(int)
        movement_df['duration'] = movement_df['duration_sec']
        movement_summary = movement_df.groupby('alertNotify_id')['duration'].sum().reset_index()

        if not movement_summary.empty and movement_summary['duration'].sum() > 0:
            pie_data = []
            legend_items = []
            base_colors = [colors.blue, colors.orange, colors.purple, colors.cyan, colors.magenta, colors.brown]
            for i, (_, row) in enumerate(movement_summary.iterrows()):
                pie_data.append(row['duration'])
                legend_items.append((str(row['alertNotify_id']), f"{round(row['duration'] / 3600, 2)} hr", base_colors[i % len(base_colors)]))

            d2 = Drawing(300, 180)
            pie2 = Pie()
            pie2.x = 65
            pie2.y = 30
            pie2.width = 120
            pie2.height = 120
            pie2.data = pie_data
            pie2.labels = [''] * len(pie_data)
            for i, (_, _, color) in enumerate(legend_items):
                pie2.slices[i].fillColor = color
            d2.add(pie2)

            elements.append(Paragraph("<b>Movement Duration by AlertNotify ID</b>", styles["Heading3"]))
            elements.append(d2)

            legend_data = []
            for name, duration, color in legend_items:
                legend_data.append(['', Paragraph(f"<font size=9>ID {name}: {duration}</font>", styles["Normal"])])
            legend_table = Table(legend_data, colWidths=[12, 300])
            legend_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('BOX', (0, 0), (-1, -1), 0.25, colors.black),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
            ]))
            for i, (_, _, color) in enumerate(legend_items):
                legend_table._cellvalues[i][0] = Drawing(10, 10)
                legend_table._cellvalues[i][0].add(Rect(0, 0, 10, 10, fillColor=color))

            elements.append(legend_table)
            elements.append(Spacer(1, 20))

        # ==== Daily Detail Table ====
        for date, group in seg_df.groupby('date'):
            elements.append(Paragraph(f"<b>Date: {date}</b>", styles["Heading3"]))
            rows = [["Start Time", "End Time", "Status", "Duration"]]
            for _, row in group.sort_values('start').iterrows():
                rows.append([
                    row['start'].strftime("%Y-%m-%d %H:%M:%S"),
                    row['end'].strftime("%Y-%m-%d %H:%M:%S"),
                    "ON" if row['status'] == 1 else "OFF",
                    format_duration(row['duration_sec'])
                ])
            table = Table(rows, style=[
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER')
            ])
            elements.extend([table, Spacer(1, 12)])

        doc.build(elements)
        buffer.seek(0)

        return HttpResponse(buffer, content_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename=machine_{gfrid}_report.pdf'
        })

    except Exception as e:
        print("❌ Error in download_single_machine_pdf:", traceback.format_exc())
        from django.http import JsonResponse
        return HttpResponse("No data in this time range. Try another range.", status=404)








from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from io import BytesIO
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics.charts.piecharts import Pie
from datetime import datetime, timedelta
import pandas as pd
import pytz
from .models import MachineEvent
# from .utils import load_machine_data  # Assuming you have this function

def format_duration(seconds):
    try:
        seconds = int(seconds)
        hrs, rem = divmod(seconds, 3600)
        mins, secs = divmod(rem, 60)
        return f"{hrs:02}:{mins:02}:{secs:02}"
    except:
        return "00:00:00"
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

@csrf_exempt
def download_all_machines_pdf(request):
    try:
        from_date = request.GET.get("from_date")
        to_date = request.GET.get("to_date")
        if not from_date or not to_date:
            return HttpResponse("Missing from_date or to_date", status=400)

        from_dt = pd.to_datetime(from_date)
        to_dt = pd.to_datetime(to_date)
        tz = pytz.timezone("Asia/Kolkata")

        if from_dt.tzinfo is None:
            from_dt = tz.localize(from_dt)
        if to_dt.tzinfo is None:
            to_dt = tz.localize(to_dt)

        all_gfrids = MachineEvent.objects.values_list("GFRID", flat=True).distinct()
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=40, bottomMargin=30)
        styles = getSampleStyleSheet()
        elements = []

        # Custom title style
        title_style = ParagraphStyle(
            name="CustomTitle",
            parent=styles["Title"],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=20
        )

        elements.append(Paragraph("🛠 <b>All Machines Usage Report</b>", title_style))
        elements.append(Paragraph(f"<b>Date Range:</b> {from_date} to {to_date}", styles["Normal"]))
        elements.append(Spacer(1, 12))

        all_segments = []

        for gfrid in all_gfrids:
            df = load_machine_data(gfrid, from_dt.isoformat(), to_dt.isoformat())
            if df.empty:
                continue

            df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
            df['TS'] = df['TS'].apply(lambda x: tz.localize(x) if pd.notnull(x) and x.tzinfo is None else x)

            df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce')
            df['TS_OFF'] = df['TS_OFF'].apply(lambda x: tz.localize(x) if pd.notnull(x) and x.tzinfo is None else x)
            df['TS_OFF'] = df['TS_OFF'].fillna(to_dt)
            df['TS_OFF'] = df['TS_OFF'].infer_objects(copy=False)
            df['TS_OFF'] = df['TS_OFF'].apply(lambda x: min(x, to_dt) if pd.notnull(x) else to_dt)

            df['TS'] = df['TS'].apply(lambda x: max(x, from_dt) if pd.notnull(x) else from_dt)
            df = df[df['TS_OFF'] > df['TS']].copy()
            df['status'] = df['status'].fillna(0).astype(int)

            def split_days(row):
                segments = []
                start, end = row['TS'], row['TS_OFF']
                while start.date() < end.date():
                    day_end = datetime.combine(start.date(), datetime.max.time()).replace(tzinfo=start.tzinfo)
                    segments.append({
                        'gfrid': gfrid,
                        'start': start,
                        'end': day_end,
                        'status': row['status'],
                        'duration_sec': (day_end - start).total_seconds(),
                        'date': start.date()
                    })
                    start = day_end + timedelta(seconds=1)
                segments.append({
                    'gfrid': gfrid,
                    'start': start,
                    'end': end,
                    'status': row['status'],
                    'duration_sec': (end - start).total_seconds(),
                    'date': end.date()
                })
                return segments

            for _, row in df.iterrows():
                all_segments.extend(split_days(row))

        seg_df = pd.DataFrame(all_segments)
        if seg_df.empty:
            return HttpResponse("No usage data found for any machine.", status=404)

        on_df = seg_df[seg_df['status'] == 1]
        gfrid_summary = on_df.groupby('gfrid')['duration_sec'].sum().reset_index()
        total_on = gfrid_summary['duration_sec'].sum()

        if not gfrid_summary.empty and total_on > 0:
            # Convert to hours
            gfrid_summary['duration_hr'] = gfrid_summary['duration_sec'] / 3600
            bar_data = [[round(row['duration_hr'], 2) for _, row in gfrid_summary.iterrows()]]
            gfrid_labels = [str(row['gfrid']) for _, row in gfrid_summary.iterrows()]

            d = Drawing(420, 250)
            bc = VerticalBarChart()
            bc.x = 40
            bc.y = 50
            bc.height = 150
            bc.width = 340
            bc.data = bar_data
            bc.categoryAxis.categoryNames = gfrid_labels
            bc.categoryAxis.labels.boxAnchor = 'ne'
            bc.categoryAxis.labels.angle = 45
            bc.valueAxis.valueMin = 0
            bc.valueAxis.valueMax = max(bar_data[0]) * 1.1
            bc.valueAxis.valueStep = max(bar_data[0]) // 5 or 1
            bc.barLabels.nudge = 8
            bc.barLabels.fontSize = 8
            bc.barLabelFormat = '%.2f hr'

            color_palette = [
                colors.HexColor('#4CAF50'), colors.HexColor('#2196F3'), colors.HexColor('#FF9800'),
                colors.HexColor('#9C27B0'), colors.HexColor('#00BCD4'), colors.HexColor('#FF5722'),
                colors.HexColor('#3F51B5'), colors.HexColor('#009688'), colors.HexColor('#795548'),
                colors.HexColor('#607D8B'), colors.HexColor('#FFC107'), colors.HexColor('#E91E63')
            ]

            for i in range(len(bar_data[0])):
                bc.bars[i].fillColor = color_palette[i % len(color_palette)]

            d.add(bc)
            elements.append(Paragraph("📊 <b>Machine ON Duration (hours) per GFRID</b>", styles["Heading3"]))
            elements.append(d)
            elements.append(Spacer(1, 20))

        for (gfrid, date), group in seg_df.groupby(['gfrid', 'date']):
            elements.append(Paragraph(f"<b>🖥 GFRID:</b> {gfrid} <b>📅 Date:</b> {date}", styles["Heading3"]))
            rows = [["Start Time", "End Time", "Status", "Duration (hr)"]]
            unique_rows = group.sort_values('start').drop_duplicates(
                subset=['start', 'end', 'status', 'duration_sec']
            )

            for _, row in unique_rows.iterrows():
                duration_hr = round(row['duration_sec'] / 3600, 2)
                rows.append([
                    row['start'].strftime("%Y-%m-%d %H:%M:%S"),
                    row['end'].strftime("%Y-%m-%d %H:%M:%S"),
                    "ON" if row['status'] == 1 else "OFF",
                    f"{duration_hr:.2f}"
                ])

            table = Table(rows, colWidths=[120, 120, 70, 90])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))

            elements.append(table)
            elements.append(Spacer(1, 12))

        doc.build(elements)
        buffer.seek(0)
        return HttpResponse(buffer, content_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="all_machines_report.pdf"'
        })

    except Exception as e:
        import traceback
        print("❌ Exception in download_all_machines_pdf:", traceback.format_exc())
        return HttpResponse("No data in this time range. Try another range.", status=404)




























# from django.http import JsonResponse
# from django.views.decorators.csrf import csrf_exempt
# from django.utils import timezone
# from datetime import datetime, timedelta
# from .models import MachineEvent
# import pandas as pd
# import json
# import pytz
# import traceback
# from django.utils.timezone import make_aware, is_naive, now

# MOVEMENT_CODES = {
#     "0x00020000": "up",
#     "0x00010000": "down",
#     "0x00040000": "forward",
#     "0x00080000": "reverse"
# }

# def load_machine_data(gfrid=None, from_date=None, to_date=None):
#     qs = MachineEvent.objects.all()
#     if gfrid:
#         qs = qs.filter(GFRID=gfrid)

#     current_time = timezone.now()
#     tz = pytz.timezone("Asia/Kolkata")

#     try:
#         from_date = pd.to_datetime(from_date, utc=True, errors='coerce') if from_date else None
#         to_date = pd.to_datetime(to_date, utc=True, errors='coerce') if to_date else None

#         if from_date is None or pd.isna(from_date):
#             from_date = current_time - timedelta(days=7)
#         if to_date is None or pd.isna(to_date):
#             to_date = current_time

#         from_date = from_date.tz_convert('Asia/Kolkata').to_pydatetime() if from_date.tzinfo else tz.localize(from_date).to_pydatetime()
#         to_date = to_date.tz_convert('Asia/Kolkata').to_pydatetime() if to_date.tzinfo else tz.localize(to_date).to_pydatetime()

#         if from_date >= to_date:
#             to_date = from_date + timedelta(minutes=1)

#     except Exception as e:
#         print(f"Date parse error: {e}")
#         from_date = current_time - timedelta(days=1)
#         to_date = current_time

#     qs = qs.filter(TS__range=[from_date, to_date])

#     if not qs.exists():
#         return pd.DataFrame()

#     df = pd.DataFrame(list(qs.values()))

#     if df.empty:
#         return df

#     df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
#     df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce').fillna(current_time)
#     df['TS_BigInt'] = pd.to_datetime(df['TS_BigInt'], unit='s', errors='coerce')
#     df['TS_OFF_BigInt'] = pd.to_datetime(df['TS_OFF_BigInt'], unit='s', errors='coerce').fillna(current_time)

#     df['TS'] = df['TS'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
#     df['TS_OFF'] = df['TS_OFF'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
#     df['TS_BigInt'] = df['TS_BigInt'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
#     df['TS_OFF_BigInt'] = df['TS_OFF_BigInt'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)

#     df['duration'] = (df['TS_OFF'] - df['TS']).dt.total_seconds()

#     return df

# @csrf_exempt
# def all_machines_view(request):
#     try:
#         gfrid_param = request.GET.get("gfrid")
#         queryset = MachineEvent.objects.all()

#         if gfrid_param:
#             queryset = queryset.filter(GFRID=gfrid_param)

#         gfrids = queryset.order_by('GFRID').values_list('GFRID', flat=True).distinct()
#         result = []

#         for gfrid in gfrids:
#             latest_event = MachineEvent.objects.filter(GFRID=gfrid).order_by('-TS').first()
#             result.append({
#                 "gfrid": gfrid,
#                 "last_alert": latest_event.alert if latest_event else None,
#                 "last_seen": latest_event.TS.strftime('%Y-%m-%d %H:%M:%S') if latest_event and latest_event.TS else None,
#             })

#         return JsonResponse(result, safe=False)
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def machine_detail_view(request, gfrid):
#     try:
#         events = MachineEvent.objects.filter(GFRID=gfrid).order_by('-TS')
#         data = []
#         for e in events:
#             data.append({
#                 "alert": e.alert,
#                 "status": e.status,
#                 "timestamp": e.TS.strftime('%Y-%m-%d %H:%M:%S') if e.TS else None,
#                 "timestamp_off": e.TS_OFF.strftime('%Y-%m-%d %H:%M:%S') if e.TS_OFF else None,
#                 "json_data": e.jsonFile
#             })
#         return JsonResponse(data, safe=False)
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def machine_status(request):
#     try:
#         gfrid = request.GET.get("gfrid")
#         if not gfrid:
#             return JsonResponse({'error': 'gfrid is required'}, status=400)

#         from_date_raw = request.GET.get("from_date")
#         to_date_raw = request.GET.get("to_date")

#         tz = pytz.timezone("Asia/Kolkata")
#         now_dt = now()

#         from_date = pd.to_datetime(from_date_raw, errors='coerce') if from_date_raw else None
#         to_date = pd.to_datetime(to_date_raw, errors='coerce') if to_date_raw else None

#         if from_date is None or pd.isna(from_date):
#             from_date = now_dt - timedelta(days=1)
#         if to_date is None or pd.isna(to_date):
#             to_date = now_dt

#         if is_naive(from_date):
#             from_date = tz.localize(from_date)
#         if is_naive(to_date):
#             to_date = tz.localize(to_date)

#         if from_date >= to_date:
#             to_date = from_date + timedelta(minutes=1)

#         qs = MachineEvent.objects.filter(GFRID=gfrid).order_by('TS')
#         df = pd.DataFrame(list(qs.values('id', 'status', 'TS', 'TS_OFF')))

#         if df.empty:
#             return JsonResponse({'message': 'No data found for this GFRID.'})

#         df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
#         df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce')
#         df['end_time'] = df['TS_OFF'].combine_first(df['TS'].shift(-1))
#         df['end_time'] = df['end_time'].fillna(now_dt)

#         records = []
#         total_on = 0
#         total_off = 0
#         prev_end = from_date

#         for _, row in df.iterrows():
#             if pd.isna(row['TS']) or pd.isna(row['end_time']):
#                 continue
#             ts = row['TS'].astimezone(tz)
#             te = row['end_time'].astimezone(tz)

#             if prev_end and ts > prev_end:
#                 gap_duration = (ts - prev_end).total_seconds()
#                 total_off += gap_duration
#                 records.append({
#                     'id': None,
#                     'status': 0,
#                     'start_time': prev_end.strftime('%Y-%m-%d %H:%M:%S'),
#                     'end_time': ts.strftime('%Y-%m-%d %H:%M:%S'),
#                     'duration_sec': gap_duration
#                 })

#             overlap_start = max(ts, from_date)
#             overlap_end = min(te, to_date)

#             if overlap_start >= overlap_end:
#                 prev_end = te
#                 continue

#             duration = (overlap_end - overlap_start).total_seconds()
#             if row['status'] == 1:
#                 total_on += duration
#             else:
#                 total_off += duration

#             records.append({
#                 'id': row['id'],
#                 'status': int(row['status']),
#                 'start_time': overlap_start.strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': overlap_end.strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_sec': duration
#             })

#             prev_end = te

#         if prev_end < to_date:
#             gap_duration = (to_date - prev_end).total_seconds()
#             total_off += gap_duration
#             records.append({
#                 'id': None,
#                 'status': 0,
#                 'start_time': prev_end.strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': to_date.strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_sec': gap_duration
#             })

#         return JsonResponse({
#             'on_time_sec': total_on,
#             'off_time_sec': total_off,
#             'status_records': records
#         })
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def movement_analysis(request):
#     try:
#         gfrid = request.GET.get("gfrid")
#         if not gfrid:
#             return JsonResponse({'error': 'gfrid is required'}, status=400)

#         from_date = request.GET.get("from_date")
#         to_date = request.GET.get("to_date")
#         df = load_machine_data(gfrid, from_date, to_date)

#         if df.empty:
#             return JsonResponse({'movements': []})

#         # Map known alerts to movement names
#         df['movement'] = df['alert'].map(MOVEMENT_CODES)

#         movement_records = []
#         for _, row in df.iterrows():
#             if pd.isna(row['TS_BigInt']) or pd.isna(row['TS_OFF_BigInt']):
#                 continue

#             # Fallback to alertNotify_id or alert if movement is missing/invalid
#             movement_label = row.get('movement')
#             if not isinstance(movement_label, str) or movement_label.strip() == "":
#                 movement_label = f"alert_{int(row.get('alertNotify_id') or 0)}" if pd.notna(row.get('alertNotify_id')) else f"alert_{row['alert']}"

#             movement_records.append({
#                 'id': row['id'],
#                 'alert': row['alert'],
#                 'movement': movement_label,
#                 'start_time': row['TS_BigInt'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': row['TS_OFF_BigInt'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration': (row['TS_OFF_BigInt'] - row['TS_BigInt']).total_seconds(),
#                 'alertNotify_id': row.get('alertNotify_id')
#             })

#         return JsonResponse({'movements': movement_records})
#     except Exception as e:
#         import traceback
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)





# @csrf_exempt
# def cumulative_analysis(request):
#     try:
#         gfrid = request.GET.get("gfrid")
#         if not gfrid:
#             return JsonResponse({'error': 'gfrid is required'}, status=400)

#         from_date = request.GET.get("from_date")
#         to_date = request.GET.get("to_date")
#         df = load_machine_data(gfrid, from_date, to_date)

#         if df.empty:
#             return JsonResponse({
#                 'status': {'labels': [], 'data': [], 'periods': []},
#                 'movement': {'labels': [], 'data': [], 'periods': []},
#                 'voltage_SOC_info': []
#             })

#         df['movement'] = df['alert'].map(MOVEMENT_CODES).fillna('other')
#         df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce').fillna(now())
#         df['TS'] = pd.to_datetime(df['TS'], errors='coerce')

#         status_data = df.groupby('status')['duration'].sum().reset_index()
#         status_data['label'] = status_data['status'].map({1: 'ON', 0: 'OFF'}).fillna('Unknown')
#         status_data['duration'] = pd.to_numeric(status_data['duration'], errors='coerce').fillna(0)

#         status_periods = []
#         tz = pytz.timezone("Asia/Kolkata")

#         for _, row in df.iterrows():
#             if pd.isna(row['TS']) or pd.isna(row['TS_OFF']):
#                 continue

#             ts = row['TS']
#             te = row['TS_OFF']
#             if ts.tzinfo is None:
#                 ts = tz.localize(ts)
#             if te.tzinfo is None:
#                 te = tz.localize(te)

#             period = {
#                 'status': int(row['status']),
#                 'label': 'ON' if row['status'] == 1 else 'OFF',
#                 'start_time': ts.strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': te.strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_hr': round(pd.to_numeric(row['duration'], errors='coerce') / 3600, 2)
#             }

#             if row['status'] == 1:
#                 movements = []
#                 for _, move_row in df[df['status'] == 1].iterrows():
#                     move_start = pd.to_datetime(move_row['TS'])
#                     move_end = pd.to_datetime(move_row['TS_OFF'])

#                     if move_start.tzinfo is None:
#                         move_start = tz.localize(move_start)
#                     if move_end.tzinfo is None:
#                         move_end = tz.localize(move_end)

#                     if move_start >= ts and move_end <= te:
#                         dur_hr = pd.to_numeric(move_row['duration'], errors='coerce') / 3600
#                         movements.append({
#                             'movement': move_row['movement'],
#                             'start_time': move_start.strftime('%Y-%m-%d %H:%M:%S'),
#                             'end_time': move_end.strftime('%Y-%m-%d %H:%M:%S'),
#                             'duration_hr': round(dur_hr, 2) if pd.notnull(dur_hr) else 0
#                         })
#                 period['movements'] = movements

#             status_periods.append(period)

#         movement_df = df[df['status'] == 1]
#         movement_data = movement_df.groupby('movement')['duration'].sum().reset_index() if not movement_df.empty else pd.DataFrame(columns=['movement', 'duration'])
#         movement_data['duration'] = pd.to_numeric(movement_data['duration'], errors='coerce').fillna(0)

#         voltage_soc = []
#         for _, row in df.iterrows():
#             try:
#                 js = json.loads(row['jsonFile']) if row.get('jsonFile') else {}
#                 voltage = js.get('voltage')
#                 soc = js.get('SOC')
#                 if voltage is not None or soc is not None:
#                     voltage_soc.append({
#                         'timestamp': row['TS'].strftime('%Y-%m-%d %H:%M:%S') if row['TS'] else None,
#                         'voltage': voltage,
#                         'soc': soc
#                     })
#             except Exception:
#                 continue

#         return JsonResponse({
#             'status': {
#                 'labels': status_data['label'].tolist(),
#                 'data': (status_data['duration'] / 3600).round(2).tolist(),
#                 'periods': status_periods
#             },
#             'movement': {
#                 'labels': movement_data['movement'].tolist(),
#                 'data': (movement_data['duration'] / 3600).round(2).tolist(),
#                 'periods': []  # Already embedded inside status_periods
#             },
#             'voltage_SOC_info': voltage_soc
#         })

#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)











# plkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk



# from django.http import JsonResponse
# from django.views.decorators.csrf import csrf_exempt
# from django.utils import timezone
# from datetime import datetime, timedelta
# from .models import MachineEvent
# import pandas as pd
# import json
# import pytz
# import traceback
# from django.utils.timezone import make_aware, is_naive, now

# MOVEMENT_CODES = {
#     "0x00020000": "up",
#     "0x00010000": "down",
#     "0x00040000": "forward",
#     "0x00080000": "reverse"
# }

# def load_machine_data(gfrid=None, from_date=None, to_date=None):
#     qs = MachineEvent.objects.all()
#     if gfrid:
#         qs = qs.filter(GFRID=gfrid)

#     current_time = timezone.now()

#     try:
#         from_date = pd.to_datetime(from_date, utc=True, errors='coerce') if from_date else current_time - timedelta(days=7)
#         to_date = pd.to_datetime(to_date, utc=True, errors='coerce') if to_date else current_time

#         if isinstance(from_date, pd.Timestamp) and not pd.isna(from_date):
#             from_date = from_date.tz_convert('Asia/Kolkata').to_pydatetime()
#         else:
#             from_date = current_time - timedelta(days=7)

#         if isinstance(to_date, pd.Timestamp) and not pd.isna(to_date):
#             to_date = to_date.tz_convert('Asia/Kolkata').to_pydatetime()
#         else:
#             to_date = current_time

#     except Exception as e:
#         print(f"Date parse error: {e}")
#         from_date = current_time - timedelta(days=1)
#         to_date = current_time

#     qs = qs.filter(TS__range=[from_date, to_date])

#     if not qs.exists():
#         return pd.DataFrame()

#     df = pd.DataFrame(list(qs.values()))

#     if df.empty:
#         return df

#     df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
#     df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce').fillna(current_time)
#     df['TS_BigInt'] = pd.to_datetime(df['TS_BigInt'], unit='s', errors='coerce')
#     df['TS_OFF_BigInt'] = pd.to_datetime(df['TS_OFF_BigInt'], unit='s', errors='coerce').fillna(current_time)

#     df['TS'] = df['TS'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
#     df['TS_OFF'] = df['TS_OFF'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
#     df['TS_BigInt'] = df['TS_BigInt'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)
#     df['TS_OFF_BigInt'] = df['TS_OFF_BigInt'].apply(lambda x: make_aware(x) if is_naive(x) and pd.notna(x) else x)

#     df['duration'] = (df['TS_OFF'] - df['TS']).dt.total_seconds()

#     return df

# @csrf_exempt
# def all_machines_view(request):
#     try:
#         gfrid_param = request.GET.get("gfrid")
#         queryset = MachineEvent.objects.all()

#         if gfrid_param:
#             queryset = queryset.filter(GFRID=gfrid_param)

#         gfrids = queryset.order_by('GFRID').values_list('GFRID', flat=True).distinct()
#         result = []

#         for gfrid in gfrids:
#             latest_event = MachineEvent.objects.filter(GFRID=gfrid).order_by('-TS').first()
#             result.append({
#                 "gfrid": gfrid,
#                 "last_alert": latest_event.alert if latest_event else None,
#                 "last_seen": latest_event.TS.strftime('%Y-%m-%d %H:%M:%S') if latest_event and latest_event.TS else None,
#             })

#         return JsonResponse(result, safe=False)
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def machine_detail_view(request, gfrid):
#     try:
#         events = MachineEvent.objects.filter(GFRID=gfrid).order_by('-TS')
#         data = []
#         for e in events:
#             data.append({
#                 "alert": e.alert,
#                 "status": e.status,
#                 "timestamp": e.TS.strftime('%Y-%m-%d %H:%M:%S') if e.TS else None,
#                 "timestamp_off": e.TS_OFF.strftime('%Y-%m-%d %H:%M:%S') if e.TS_OFF else None,
#                 "json_data": e.jsonFile
#             })
#         return JsonResponse(data, safe=False)
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def machine_status(request):
#     try:
#         gfrid = request.GET.get("gfrid")
#         if not gfrid:
#             return JsonResponse({'error': 'gfrid is required'}, status=400)

#         from_date_raw = request.GET.get("from_date")
#         to_date_raw = request.GET.get("to_date")

#         tz = pytz.timezone("Asia/Kolkata")

#         from_date = pd.to_datetime(from_date_raw, errors='coerce')
#         to_date = pd.to_datetime(to_date_raw, errors='coerce')

#         from_date = tz.localize(from_date) if pd.notna(from_date) and is_naive(from_date) else from_date
#         to_date = tz.localize(to_date) if pd.notna(to_date) and is_naive(to_date) else to_date

#         now_dt = now()
#         if pd.isna(from_date):
#             from_date = now_dt - timedelta(days=1)
#         if pd.isna(to_date):
#             to_date = now_dt

#         qs = MachineEvent.objects.filter(GFRID=gfrid).order_by('TS')
#         df = pd.DataFrame(list(qs.values('id', 'status', 'TS', 'TS_OFF')))

#         if df.empty:
#             return JsonResponse({'message': 'No data found for this GFRID.'})

#         df['TS'] = pd.to_datetime(df['TS'], errors='coerce')
#         df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce')
#         df['end_time'] = df['TS_OFF'].combine_first(df['TS'].shift(-1))
#         df['end_time'] = df['end_time'].fillna(now_dt)

#         records = []
#         total_on = 0
#         total_off = 0
#         prev_end = from_date

#         for _, row in df.iterrows():
#             if pd.isna(row['TS']) or pd.isna(row['end_time']):
#                 continue
#             ts = row['TS'].astimezone(tz)
#             te = row['end_time'].astimezone(tz)

#             if prev_end and ts > prev_end:
#                 gap_duration = (ts - prev_end).total_seconds()
#                 total_off += gap_duration
#                 records.append({
#                     'id': None,
#                     'status': 0,
#                     'start_time': prev_end.strftime('%Y-%m-%d %H:%M:%S'),
#                     'end_time': ts.strftime('%Y-%m-%d %H:%M:%S'),
#                     'duration_sec': gap_duration
#                 })

#             overlap_start = max(ts, from_date)
#             overlap_end = min(te, to_date)

#             if overlap_start >= overlap_end:
#                 prev_end = te
#                 continue

#             duration = (overlap_end - overlap_start).total_seconds()
#             if row['status'] == 1:
#                 total_on += duration
#             else:
#                 total_off += duration

#             records.append({
#                 'id': row['id'],
#                 'status': int(row['status']),
#                 'start_time': overlap_start.strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': overlap_end.strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_sec': duration
#             })

#             prev_end = te

#         if prev_end < to_date:
#             gap_duration = (to_date - prev_end).total_seconds()
#             total_off += gap_duration
#             records.append({
#                 'id': None,
#                 'status': 0,
#                 'start_time': prev_end.strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': to_date.strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_sec': gap_duration
#             })

#         return JsonResponse({
#             'on_time_sec': total_on,
#             'off_time_sec': total_off,
#             'status_records': records
#         })
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def movement_analysis(request):
#     try:
#         gfrid = request.GET.get("gfrid")
#         if not gfrid:
#             return JsonResponse({'error': 'gfrid is required'}, status=400)

#         from_date = request.GET.get("from_date")
#         to_date = request.GET.get("to_date")
#         df = load_machine_data(gfrid, from_date, to_date)

#         if df.empty:
#             return JsonResponse({'movements': []})

#         df = df[df['alert'].isin(MOVEMENT_CODES.keys())].copy()
#         df['movement'] = df['alert'].map(MOVEMENT_CODES)

#         movement_records = []
#         for _, row in df.iterrows():
#             if pd.isna(row['TS_BigInt']) or pd.isna(row['TS_OFF_BigInt']):
#                 continue
#             movement_records.append({
#                 'alert': row['alert'],
#                 'movement': row['movement'],
#                 'start_time': row['TS_BigInt'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': row['TS_OFF_BigInt'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration': (row['TS_OFF_BigInt'] - row['TS_BigInt']).total_seconds(),
#                 'alertNotify_id': row.get('alertNotify_id')
#             })

#         return JsonResponse({'movements': movement_records})
#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)

# @csrf_exempt
# def cumulative_analysis(request):
#     try:
#         gfrid = request.GET.get("gfrid")
#         if not gfrid:
#             return JsonResponse({'error': 'gfrid is required'}, status=400)

#         from_date = request.GET.get("from_date")
#         to_date = request.GET.get("to_date")
#         df = load_machine_data(gfrid, from_date, to_date)

#         if df.empty:
#             return JsonResponse({
#                 'status': {'labels': [], 'data': [], 'periods': []},
#                 'movement': {'labels': [], 'data': [], 'periods': []},
#                 'voltage_SOC_info': []
#             })

#         df['movement'] = df['alert'].map(MOVEMENT_CODES).fillna('other')
#         df['TS_OFF'] = pd.to_datetime(df['TS_OFF'], errors='coerce').fillna(now())

#         status_data = df.groupby('status')['duration'].sum().reset_index()
#         status_data['label'] = status_data['status'].map({1: 'ON', 0: 'OFF'}).fillna('Unknown')
#         status_data['duration'] = pd.to_numeric(status_data['duration'], errors='coerce').fillna(0)

#         status_periods = []
#         for _, row in df.iterrows():
#             if pd.isna(row['TS']) or pd.isna(row['TS_OFF']):
#                 continue
#             status_periods.append({
#                 'status': int(row['status']),
#                 'label': 'ON' if row['status'] == 1 else 'OFF',
#                 'start_time': row['TS'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': row['TS_OFF'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_hr': round(pd.to_numeric(row['duration'], errors='coerce') / 3600, 2)
#             })

#         movement_df = df[df['status'] == 1]
#         movement_data = movement_df.groupby('movement')['duration'].sum().reset_index() if not movement_df.empty else pd.DataFrame(columns=['movement', 'duration'])
#         movement_data['duration'] = pd.to_numeric(movement_data['duration'], errors='coerce').fillna(0)

#         movement_periods = []
#         for _, row in movement_df.iterrows():
#             if pd.isna(row['TS']) or pd.isna(row['TS_OFF']):
#                 continue
#             dur_hr = pd.to_numeric(row['duration'], errors='coerce') / 3600
#             dur_hr = round(dur_hr, 2) if pd.notnull(dur_hr) else 0
#             movement_periods.append({
#                 'movement': row['movement'],
#                 'start_time': row['TS'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'end_time': row['TS_OFF'].strftime('%Y-%m-%d %H:%M:%S'),
#                 'duration_hr': dur_hr
#             })

#         voltage_soc = []
#         for _, row in df.iterrows():
#             try:
#                 js = json.loads(row['jsonFile']) if row.get('jsonFile') else {}
#                 voltage = js.get('voltage')
#                 soc = js.get('SOC')
#                 if voltage is not None or soc is not None:
#                     voltage_soc.append({
#                         'timestamp': row['TS'].strftime('%Y-%m-%d %H:%M:%S') if row['TS'] else None,
#                         'voltage': voltage,
#                         'soc': soc
#                     })
#             except Exception:
#                 continue

#         return JsonResponse({
#             'status': {
#                 'labels': status_data['label'].tolist(),
#                 'data': (status_data['duration'] / 3600).round(2).tolist(),
#                 'periods': status_periods
#             },
#             'movement': {
#                 'labels': movement_data['movement'].tolist(),
#                 'data': (movement_data['duration'] / 3600).round(2).tolist(),
#                 'periods': movement_periods
#             },
#             'voltage_SOC_info': voltage_soc
#         })

#     except Exception as e:
#         return JsonResponse({'error': str(e), 'trace': traceback.format_exc()}, status=500)















