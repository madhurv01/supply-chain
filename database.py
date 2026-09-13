"""
Local SQLite data layer for the Agri-Chain OS app.

Replaces the previous Supabase-only implementation, which only covered the
AI-forecast history feature and left every other page (Farm Management,
Inventory, Logistics, Finance & Sales, Market Analysis) importing functions
that did not exist anywhere in the project. Everything now lives in a single
local SQLite database file (analysis_results.db) so the app runs with zero
cloud accounts.
"""

import hashlib
import json
import sqlite3
from datetime import datetime, date

DB_PATH = "analysis_results.db"

# Fixed "warehouse" origin used as the starting point for every shipment.
WAREHOUSE_LAT, WAREHOUSE_LON = 21.1458, 79.0882  # Nagpur, roughly central India


def _get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create all tables if they don't exist yet. Safe to call repeatedly."""
    conn = _get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            created_at TEXT NOT NULL,
            query_data TEXT NOT NULL,
            report_data TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS farm_plots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity TEXT NOT NULL,
            plot_id TEXT NOT NULL,
            quantity_planted REAL NOT NULL,
            date_planted TEXT NOT NULL,
            expected_harvest_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'GROWING'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity TEXT NOT NULL UNIQUE,
            quantity REAL NOT NULL DEFAULT 0,
            unit TEXT NOT NULL DEFAULT 'KG'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            truck_id TEXT NOT NULL,
            commodity TEXT NOT NULL,
            quantity REAL NOT NULL,
            destination_market TEXT NOT NULL,
            origin_lat REAL NOT NULL,
            origin_lon REAL NOT NULL,
            destination_lat REAL NOT NULL,
            destination_lon REAL NOT NULL,
            current_lat REAL NOT NULL,
            current_lon REAL NOT NULL,
            progress REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'IN_TRANSIT',
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity TEXT NOT NULL,
            quantity REAL NOT NULL,
            price_per_unit REAL NOT NULL,
            total_revenue REAL NOT NULL,
            market TEXT NOT NULL,
            sold_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def _market_to_latlon(market_name: str):
    """
    Deterministically map a market name to a plausible lat/lon within India's
    bounding box. Avoids depending on a live geocoding API (rate limits /
    network access), while still giving each destination a stable, distinct
    position on the map.
    """
    digest = hashlib.md5(market_name.encode("utf-8")).hexdigest()
    frac_lat = int(digest[:8], 16) / 0xFFFFFFFF
    frac_lon = int(digest[8:16], 16) / 0xFFFFFFFF
    lat = 8.0 + frac_lat * (35.0 - 8.0)
    lon = 68.0 + frac_lon * (97.0 - 68.0)
    return lat, lon


# --- AI Forecast results (used by page 1) ---------------------------------

def save_result(user_id, query_details, report):
    conn = _get_conn()
    conn.execute(
        "INSERT INTO results (user_id, created_at, query_data, report_data) VALUES (?, ?, ?, ?)",
        (user_id, datetime.utcnow().isoformat(), json.dumps(query_details), report),
    )
    conn.commit()
    conn.close()


def get_all_results_for_user(user_id):
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM results WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_results():
    """Used by the Market Analysis page (not tied to a specific user)."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, created_at, query_data, report_data FROM results ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    # Returned as tuples to match positional access (res[1], res[2], res[3]) used by pages.
    return [tuple(row) for row in rows]


# --- Farm Management --------------------------------------------------------

def add_farm_plot(commodity, plot_id, quantity, date_planted, expected_harvest):
    conn = _get_conn()
    conn.execute(
        "INSERT INTO farm_plots (commodity, plot_id, quantity_planted, date_planted, expected_harvest_date, status) "
        "VALUES (?, ?, ?, ?, ?, 'GROWING')",
        (
            commodity,
            plot_id,
            quantity,
            date_planted.isoformat() if isinstance(date_planted, date) else str(date_planted),
            expected_harvest.isoformat() if isinstance(expected_harvest, date) else str(expected_harvest),
        ),
    )
    conn.commit()
    conn.close()


def get_farm_plots(status=None):
    import pandas as pd
    conn = _get_conn()
    if status:
        df = pd.read_sql_query("SELECT * FROM farm_plots WHERE status = ?", conn, params=(status,))
    else:
        df = pd.read_sql_query("SELECT * FROM farm_plots", conn)
    conn.close()
    return df


def harvest_plot(plot_row_id, commodity, quantity):
    conn = _get_conn()
    conn.execute("UPDATE farm_plots SET status = 'HARVESTED' WHERE id = ?", (plot_row_id,))

    existing = conn.execute("SELECT quantity FROM inventory WHERE commodity = ?", (commodity,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE inventory SET quantity = quantity + ? WHERE commodity = ?", (quantity, commodity)
        )
    else:
        conn.execute(
            "INSERT INTO inventory (commodity, quantity, unit) VALUES (?, ?, 'KG')", (commodity, quantity)
        )
    conn.commit()
    conn.close()


# --- Inventory ---------------------------------------------------------------

def get_inventory():
    import pandas as pd
    conn = _get_conn()
    df = pd.read_sql_query("SELECT * FROM inventory WHERE quantity > 0", conn)
    conn.close()
    return df


# --- Logistics -----------------------------------------------------------

def create_shipment(truck_id, commodity, quantity, destination_market):
    dest_lat, dest_lon = _market_to_latlon(destination_market)

    conn = _get_conn()
    row = conn.execute("SELECT quantity FROM inventory WHERE commodity = ?", (commodity,)).fetchone()
    if not row or row["quantity"] < quantity:
        conn.close()
        return False

    conn.execute("UPDATE inventory SET quantity = quantity - ? WHERE commodity = ?", (quantity, commodity))
    conn.execute(
        """INSERT INTO shipments
           (truck_id, commodity, quantity, destination_market, origin_lat, origin_lon,
            destination_lat, destination_lon, current_lat, current_lon, progress, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'IN_TRANSIT', ?)""",
        (
            truck_id, commodity, quantity, destination_market,
            WAREHOUSE_LAT, WAREHOUSE_LON, dest_lat, dest_lon,
            WAREHOUSE_LAT, WAREHOUSE_LON, datetime.utcnow().isoformat(),
        ),
    )
    conn.commit()
    conn.close()
    return True


def get_active_shipments():
    import pandas as pd
    conn = _get_conn()
    df = pd.read_sql_query(
        "SELECT * FROM shipments WHERE status IN ('IN_TRANSIT', 'ARRIVED') ORDER BY created_at DESC", conn
    )
    conn.close()
    return df


def update_all_shipment_locations(step_progress=0.02):
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM shipments WHERE status = 'IN_TRANSIT'").fetchall()
    for row in rows:
        new_progress = min(1.0, row["progress"] + step_progress)
        new_lat = row["origin_lat"] + (row["destination_lat"] - row["origin_lat"]) * new_progress
        new_lon = row["origin_lon"] + (row["destination_lon"] - row["origin_lon"]) * new_progress
        new_status = "ARRIVED" if new_progress >= 1.0 else "IN_TRANSIT"
        conn.execute(
            "UPDATE shipments SET progress = ?, current_lat = ?, current_lon = ?, status = ? WHERE id = ?",
            (new_progress, new_lat, new_lon, new_status, row["id"]),
        )
    conn.commit()
    conn.close()


def deliver_shipment(shipment_id):
    conn = _get_conn()
    conn.execute("UPDATE shipments SET status = 'SOLD' WHERE id = ?", (shipment_id,))
    conn.commit()
    conn.close()


# --- Finance & Sales -------------------------------------------------------

def log_sale(commodity, quantity, price_per_unit, market):
    total_revenue = float(quantity) * float(price_per_unit)
    conn = _get_conn()
    conn.execute(
        "INSERT INTO sales (commodity, quantity, price_per_unit, total_revenue, market, sold_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (commodity, quantity, price_per_unit, total_revenue, market, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


def get_sales_data():
    import pandas as pd
    conn = _get_conn()
    df = pd.read_sql_query("SELECT * FROM sales ORDER BY sold_at DESC", conn)
    conn.close()
    return df
