import streamlit as st
import pandas as pd  # <-- THIS LINE WAS ADDED
from pathlib import Path
from app_utils import add_bg_from_local
import database as db

# --- Page Config and Setup ---
st.set_page_config(page_title="Warehouse Inventory", page_icon="📦", layout="wide")
db.init_db()
image_path = Path(__file__).parent.parent / "assets/background.jpg"
if image_path.exists():
    add_bg_from_local(str(image_path))

st.title("📦 Warehouse Inventory")
st.markdown("View your current stock of harvested commodities.")

inventory_df = db.get_inventory()

if inventory_df.empty:
    st.warning("Your warehouse is empty. Harvest some crops from the Farm Management page to see them here.")
else:
    # --- Metric Cards Dashboard ---
    st.subheader("Inventory at a Glance")
    cols = st.columns(4)
    col_index = 0
    for index, row in inventory_df.iterrows():
        with cols[col_index % 4]:
            st.metric(label=row['commodity'], value=f"{row['quantity']} {row['unit']}")
        col_index += 1

    # --- Detailed Inventory Table ---
    st.write("---")
    st.subheader("Detailed Stock Report")
    st.dataframe(inventory_df, use_container_width=True)