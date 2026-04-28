from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('hotels', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='hotel',
            name='is_active',
        ),
        migrations.RenameField(
            model_name='hotel',
            old_name='owner_id',
            new_name='admin_id',
        ),
    ]
