from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0002_rename_notes_to_description'),
    ]

    operations = [
        migrations.AlterField(
            model_name='booking',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'En attente'),
                    ('accepted', 'Accepté'),
                    ('cancelled', 'Annulée'),
                    ('refused', 'Refusé'),
                ],
                default='pending',
                max_length=15,
            ),
        ),
        migrations.RunSQL(
            "UPDATE bookings_booking SET status = 'accepted' WHERE status IN ('confirmed', 'completed');",
            reverse_sql="UPDATE bookings_booking SET status = 'confirmed' WHERE status = 'accepted';",
        ),
    ]
