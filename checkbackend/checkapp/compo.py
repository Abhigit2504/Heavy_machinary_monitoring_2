from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO

def generate_machine_pdf(df, machine_id, from_date, to_date):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []

    # Styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CenterHeading', fontSize=16, alignment=1, textColor=colors.darkblue))
    styles.add(ParagraphStyle(name='SubHeading', fontSize=12, alignment=1, textColor=colors.grey))

    # Headings
    elements.append(Paragraph(f"🛠 Machine Report - ID {machine_id}", styles['CenterHeading']))
    elements.append(Paragraph(f"📅 Duration: {from_date} to {to_date}", styles['SubHeading']))
    elements.append(Spacer(1, 12))

    # Table Header
    data = [["#", "Start Time", "Stop Time", "Duration (sec)", "Status"]]
    
    for idx, row in df.iterrows():
        data.append([
            str(idx + 1),
            row['TS'].strftime("%Y-%m-%d %H:%M:%S"),
            row['TS_OFF'].strftime("%Y-%m-%d %H:%M:%S"),
            f"{row['duration_sec']:.2f}",
            "🟢 ON" if row['status'] == 1 else "🔴 OFF"
        ])

    # Table styling
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))

    elements.append(table)
    doc.build(elements)
    buffer.seek(0)
    return buffer
