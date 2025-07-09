import sqlite3
import json
import datetime
import pandas as pd
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

DB_NAME = "analysis_results.db"

# ==============================================================================
# INITIALIZATION
# ==============================================================================
def init_db():
    """Initializes the database and creates all necessary tables for the entire application."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. For AI Forecasts and ML Analysis History
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_query TEXT,
            generated_report TEXT
        )
    ''')

    # 2. For Farm Management
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS farm_plots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity TEXT NOT NULL,
            plot_id TEXT,
            quantity_planted REAL,
            date_planted DATE,
            expected_harvest_date DATE,
            status TEXT DEFAULT 'GROWING' -- Can be 'GROWING' or 'HARVESTED'
        )
    ''')

    # 3. For Warehouse Inventory (UNIQUE constraint on commodity is crucial)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity TEXT UNIQUE,
            quantity REAL,
            unit TEXT DEFAULT 'KG',
            last_updated DATE
        )
    ''')
    
    # 4. For Logistics Tracking (with geocoding fields)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            truck_id TEXT,
            commodity TEXT,
            quantity REAL,
            destination_market TEXT,
            start_lat REAL,
            start_lon REAL,
            destination_lat REAL,
            destination_lon REAL,
            current_lat REAL,
            current_lon REAL,
            progress REAL DEFAULT 0.0, -- Progress from 0.0 (start) to 1.0 (end)
            status TEXT DEFAULT 'IN_TRANSIT' -- Can be 'IN_TRANSIT', 'ARRIVED', or 'DELIVERED'
        )
    ''')
    
    # 5. For Financial Transactions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity TEXT,
            quantity_sold REAL,
            sale_price_per_unit REAL,
            total_revenue REAL,
            market_sold_at TEXT,
            sale_date DATE DEFAULT CURRENT_DATE
        )
    ''')
    
    conn.commit()
    conn.close()

# ==============================================================================
# AI & ML HISTORY FUNCTIONS
# ==============================================================================
def save_result(query_details, report):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO results (user_query, generated_report) VALUES (?, ?)', 
                   (json.dumps(query_details), report))
    conn.commit()
    conn.close()

def get_all_results():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT id, query_timestamp, user_query, generated_report FROM results ORDER BY query_timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return rows

# ==============================================================================
# FARM MANAGEMENT FUNCTIONS
# ==============================================================================
def add_farm_plot(commodity, plot_id, quantity, date_planted, expected_harvest):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO farm_plots (commodity, plot_id, quantity_planted, date_planted, expected_harvest_date) VALUES (?, ?, ?, ?, ?)',
                   (commodity, plot_id, quantity, date_planted, expected_harvest))
    conn.commit()
    conn.close()

def get_farm_plots(status='GROWING'):
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query(f"SELECT * FROM farm_plots WHERE status = '{status}'", conn)
    conn.close()
    return df

def harvest_plot(plot_id, commodity, quantity):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Mark plot as harvested
    cursor.execute("UPDATE farm_plots SET status = 'HARVESTED' WHERE id = ?", (plot_id,))
    # Add or update inventory using ON CONFLICT for robustness
    cursor.execute("""
        INSERT INTO inventory (commodity, quantity, last_updated) 
        VALUES (?, ?, ?) 
        ON CONFLICT(commodity) DO UPDATE SET 
        quantity = quantity + excluded.quantity, 
        last_updated = excluded.last_updated
    """, (commodity, quantity, datetime.date.today()))
    conn.commit()
    conn.close()

# ==============================================================================
# INVENTORY FUNCTIONS
# ==============================================================================
def get_inventory():
    conn = sqlite3.connect(DB_NAME)
    try:
        df = pd.read_sql_query("SELECT * FROM inventory WHERE quantity > 0", conn)
    except pd.io.sql.DatabaseError: # Handles case where table is empty
        df = pd.DataFrame(columns=['id', 'commodity', 'quantity', 'unit', 'last_updated'])
    conn.close()
    return df

# ==============================================================================
# LOGISTICS FUNCTIONS (WITH GEOPY)
# ==============================================================================
def geocode_location(location_name):
    """Converts a location name (e.g., 'Delhi, India') to latitude and longitude."""
    try:
        # Using a custom user_agent is a good practice
        geolocator = Nominatim(user_agent="agri-chain-os-app/1.0")
        location = geolocator.geocode(f"{location_name}, India", timeout=10)
        if location:
            return location.latitude, location.longitude
    except (GeocoderTimedOut, GeocoderUnavailable) as e:
        print(f"Geocoding service error: {e}. Please try again.")
    return None, None

def create_shipment(truck_id, commodity, quantity, destination):
    """Creates a new shipment, geocodes the destination, and updates inventory."""
    dest_lat, dest_lon = geocode_location(destination)
    if dest_lat is None or dest_lon is None:
        print(f"Could not find coordinates for {destination}. Shipment not created.")
        return False

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    start_lat, start_lon = 20.5937, 78.9629 # Generic central start point in India
    
    cursor.execute(
        "INSERT INTO shipments (truck_id, commodity, quantity, destination_market, start_lat, start_lon, destination_lat, destination_lon, current_lat, current_lon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (truck_id, commodity, quantity, destination, start_lat, start_lon, dest_lat, dest_lon, start_lat, start_lon)
    )
    # Atomically decrease inventory
    cursor.execute("UPDATE inventory SET quantity = quantity - ? WHERE commodity = ?", (quantity, commodity))
    conn.commit()
    conn.close()
    return True

def update_all_shipment_locations(step_progress=0.15):
    """Simulates trucks moving a fixed percentage closer to their destination."""
    conn = sqlite3.connect(DB_NAME)
    shipments_df = pd.read_sql_query("SELECT * FROM shipments WHERE status = 'IN_TRANSIT'", conn)
    
    for index, row in shipments_df.iterrows():
        new_progress = min(row['progress'] + step_progress, 1.0)
        
        # Linear interpolation to find the new position
        new_lat = row['start_lat'] + new_progress * (row['destination_lat'] - row['start_lat'])
        new_lon = row['start_lon'] + new_progress * (row['destination_lon'] - row['start_lon'])
        
        status = 'ARRIVED' if new_progress >= 1.0 else 'IN_TRANSIT'
        
        cursor = conn.cursor()
        cursor.execute("UPDATE shipments SET progress = ?, current_lat = ?, current_lon = ?, status = ? WHERE id = ?",
                       (new_progress, new_lat, new_lon, status, row['id']))
    
    conn.commit()
    conn.close()

def get_active_shipments():
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query("SELECT * FROM shipments WHERE status IN ('IN_TRANSIT', 'ARRIVED')", conn)
    conn.close()
    return df

def deliver_shipment(shipment_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE shipments SET status = 'DELIVERED' WHERE id = ?", (shipment_id,))
    conn.commit()
    conn.close()

# ==============================================================================
# FINANCE & SALES FUNCTIONS
# ==============================================================================
def log_sale(commodity, quantity, price, market):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    total_revenue = float(quantity) * float(price)
    cursor.execute("INSERT INTO sales (commodity, quantity_sold, sale_price_per_unit, total_revenue, market_sold_at) VALUES (?, ?, ?, ?, ?)",
                   (commodity, quantity, price, total_revenue, market))
    conn.commit()
    conn.close()

def get_sales_data():
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query("SELECT * FROM sales ORDER BY sale_date DESC", conn)
    conn.close()
    return df