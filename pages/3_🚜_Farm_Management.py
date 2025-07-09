import streamlit as st
import pandas as pd  # <-- THIS LINE WAS ADDED
from pathlib import Path
import datetime
from app_utils import add_bg_from_local, load_data
import database as db

# --- Page Config and Setup ---
st.set_page_config(page_title="Farm Management", page_icon="🚜", layout="wide")
db.init_db()
df_master = load_data()
image_path = Path(__file__).parent.parent / "assets/background.jpg"
if image_path.exists():
    add_bg_from_local(str(image_path))

st.title("🚜 Farm Management Dashboard")
st.markdown("Track your crops from planting to harvest.")

# --- Form to Add New Plot ---
with st.expander("🌱 Add New Crop Planting", expanded=True):
    with st.form("new_plot_form", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)
        with col1:
            commodity = st.selectbox("Select Commodity", options=sorted(df_master['Commodity'].unique()))
            plot_id = st.text_input("Plot ID / Name (e.g., North Field A)")
        with col2:
            quantity = st.number_input("Quantity Planted (e.g., 500 units)", min_value=0.0, step=10.0)
            date_planted = st.date_input("Date Planted", datetime.date.today())
        with col3:
            expected_harvest = st.date_input("Expected Harvest Date", datetime.date.today() + datetime.timedelta(days=90))
        
        submitted = st.form_submit_button("Add Planting")
        if submitted:
            db.add_farm_plot(commodity, plot_id, quantity, date_planted, expected_harvest)
            st.success(f"Added {commodity} to {plot_id}!")
            st.rerun()

# --- Dashboard for Growing Crops ---
st.header("🌾 Currently Growing Crops")
growing_plots_df = db.get_farm_plots(status='GROWING')

if growing_plots_df.empty:
    st.info("No crops are currently marked as growing. Add one using the form above.")
else:
    for index, row in growing_plots_df.iterrows():
        with st.container(border=True):
            col1, col2, col3, col4 = st.columns([2, 1, 1, 1])
            with col1:
                st.subheader(f"{row['commodity']} - Plot: {row['plot_id']}")
                st.write(f"Planted on: {row['date_planted']}")
            with col2:
                st.metric("Quantity Planted", row['quantity_planted'])
            with col3:
                st.metric("Expected Harvest", row['expected_harvest_date'])
            with col4:
                st.write("")
                st.write("")
                if st.button("Harvest Now", key=f"harvest_{row['id']}"):
                    db.harvest_plot(row['id'], row['commodity'], row['quantity_planted'])
                    st.success(f"Harvested {row['commodity']} and moved to inventory!")
                    st.rerun()