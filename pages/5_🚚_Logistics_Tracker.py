import streamlit as st
import pandas as pd
from pathlib import Path
from app_utils import add_bg_from_local, load_data
import database as db
import folium
from streamlit_folium import st_folium
import time # <-- Import the time library

# --- Page Config and Setup ---
st.set_page_config(page_title="Logistics Tracker", page_icon="🚚", layout="wide")
db.init_db()
df_master = load_data()
image_path = Path(__file__).parent.parent / "assets/background.jpg"
if image_path.exists():
    add_bg_from_local(str(image_path))

st.title("🚚 Live Logistics Tracker")
st.markdown("Dispatch shipments and monitor their real-time progress.")

# --- Form to Create New Shipment ---
with st.expander("📦 Create New Shipment"):
    inventory_df = db.get_inventory()
    if inventory_df.empty:
        st.warning("No inventory available to ship.")
    else:
        with st.form("new_shipment_form", clear_on_submit=True):
            commodity = st.selectbox("Select Commodity from Inventory", options=inventory_df['commodity'])
            available_qty = inventory_df[inventory_df['commodity'] == commodity]['quantity'].iloc[0]
            
            quantity = st.number_input(f"Quantity to Ship (Available: {available_qty})", min_value=0.1, max_value=available_qty)
            destination = st.selectbox("Destination Market", options=sorted(df_master['Market'].unique()))
            truck_id = st.text_input("Truck ID", f"TRUCK-{pd.Timestamp.now().strftime('%H%M%S')}")
            
            submitted = st.form_submit_button("Dispatch Shipment")
            if submitted:
                if quantity <= 0:
                    st.error("Cannot dispatch a shipment with zero quantity.")
                elif db.create_shipment(truck_id, commodity, quantity, destination):
                    st.success("Shipment dispatched and inventory updated!")
                    st.rerun()
                else:
                    st.error(f"Could not dispatch to '{destination}'. Location not found.")

# --- Map and Shipment List ---
st.header("Live Shipment Map")

# Use a checkbox to control the auto-refresh feature
auto_refresh = st.checkbox("Enable Live Monitoring (refreshes every 10 seconds)")

# The map and dataframe will be placed inside a placeholder
# so they can be updated smoothly during the refresh loop.
map_placeholder = st.empty()
dataframe_placeholder = st.empty()

# --- Main Display and Auto-Refresh Loop ---
while auto_refresh:
    # 1. Update the data
    db.update_all_shipment_locations(step_progress=0.02) # Smaller steps for smoother movement
    active_shipments_df = db.get_active_shipments()

    # 2. Redraw the map
    with map_placeholder.container():
        m = folium.Map(location=[20.5937, 78.9629], zoom_start=5)
        if not active_shipments_df.empty:
            for index, row in active_shipments_df.iterrows():
                icon_color = 'green' if row['status'] == 'ARRIVED' else 'blue'
                popup_text = f"Truck: {row['truck_id']}<br>Status: {row['status']}<br>Progress: {row['progress']*100:.0f}%"
                folium.Marker([row['current_lat'], row['current_lon']], popup=popup_text, tooltip=row['truck_id'], icon=folium.Icon(color=icon_color, icon='truck', prefix='fa')).add_to(m)
                folium.Marker([row['destination_lat'], row['destination_lon']], tooltip=f"Destination: {row['destination_market']}", icon=folium.Icon(color='red', icon='flag')).add_to(m)
        
        st_folium(m, width=1200, height=500, key="map1") # Using a key helps maintain state

    # 3. Redraw the dataframe
    with dataframe_placeholder.container():
        st.subheader("Active Shipment Details")
        st.dataframe(active_shipments_df, use_container_width=True)
    
    # 4. Wait and rerun
    time.sleep(10) # Wait for 10 seconds
    st.rerun()

# --- Static Display (if auto-refresh is OFF) ---
# This part of the code only runs if the checkbox is not ticked
if not auto_refresh:
    active_shipments_df = db.get_active_shipments()
    with map_placeholder.container():
        m = folium.Map(location=[20.5937, 78.9629], zoom_start=5)
        if not active_shipments_df.empty:
            for index, row in active_shipments_df.iterrows():
                icon_color = 'green' if row['status'] == 'ARRIVED' else 'blue'
                popup_text = f"Truck: {row['truck_id']}<br>Status: {row['status']}<br>Progress: {row['progress']*100:.0f}%"
                folium.Marker([row['current_lat'], row['current_lon']], popup=popup_text, tooltip=row['truck_id'], icon=folium.Icon(color=icon_color, icon='truck', prefix='fa')).add_to(m)
                folium.Marker([row['destination_lat'], row['destination_lon']], tooltip=f"Destination: {row['destination_market']}", icon=folium.Icon(color='red', icon='flag')).add_to(m)
        st_folium(m, width=1200, height=500, key="map2")
    
    with dataframe_placeholder.container():
        st.subheader("Active Shipment Details")
        st.dataframe(active_shipments_df, use_container_width=True)