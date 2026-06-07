import json
from datetime import datetime
from jyotishganit import calculate_birth_chart, get_birth_chart_json


def compute_chart(name, dob, time_str, lat, lon, tz_offset, location_name=""):
    """
    dob: 'YYYY-MM-DD', time_str: 'HH:MM', lat/lon: float, tz_offset: float (IST=5.5)
    Returns: dict (full jyotishganit JSON including d1Chart, divisionalCharts, dashas, panchanga)
    """
    dt = datetime.strptime(f"{dob} {time_str}", "%Y-%m-%d %H:%M")
    chart = calculate_birth_chart(
        birth_date=dt,
        latitude=lat,
        longitude=lon,
        timezone_offset=tz_offset,
        location_name=location_name,
        name=name,
    )
    return get_birth_chart_json(chart)


def compute_chart_json(name, dob, time_str, lat, lon, tz_offset, location_name=""):
    """Returns JSON string — use this when calling from Pyodide JS."""
    return json.dumps(
        compute_chart(name, dob, time_str, lat, lon, tz_offset, location_name),
        default=str,
    )
