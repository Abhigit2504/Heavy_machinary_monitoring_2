# Generated by Django 5.2.1 on 2025-06-23 07:24

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('checkapp', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='machineevent',
            index=models.Index(fields=['GFRID'], name='checkapp_ma_GFRID_6b5fc8_idx'),
        ),
        migrations.AddIndex(
            model_name='machineevent',
            index=models.Index(fields=['TS'], name='checkapp_ma_TS_a529b1_idx'),
        ),
        migrations.AddIndex(
            model_name='machineevent',
            index=models.Index(fields=['alert'], name='checkapp_ma_alert_c76e1b_idx'),
        ),
    ]
