# Generated by Django 5.2.1 on 2025-06-23 07:25

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('checkapp', '0002_machineevent_checkapp_ma_gfrid_6b5fc8_idx_and_more'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='machineevent',
            name='checkapp_ma_GFRID_6b5fc8_idx',
        ),
        migrations.RemoveIndex(
            model_name='machineevent',
            name='checkapp_ma_TS_a529b1_idx',
        ),
        migrations.RemoveIndex(
            model_name='machineevent',
            name='checkapp_ma_alert_c76e1b_idx',
        ),
    ]
