from datetime import datetime, timedelta, timezone


def today_moscow():
    return datetime.now(timezone(timedelta(hours=3))).date()
