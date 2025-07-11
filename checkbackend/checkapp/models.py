
from django.db import models

class MachineEvent(models.Model):
    alert = models.CharField(max_length=20)
    status = models.IntegerField()
    GFRID = models.IntegerField()
    TS = models.DateTimeField()
    TS_OFF = models.DateTimeField(null=True, blank=True)
    TS_BigInt = models.BigIntegerField()
    TS_OFF_BigInt = models.BigIntegerField(null=True, blank=True)
    jsonFile = models.JSONField()
    last_modified = models.DateTimeField()
    alertNotify_id = models.IntegerField()

    def __str__(self):
        return f"Machine {self.GFRID} - {self.alert}"
