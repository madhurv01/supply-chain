import streamlit as st
import json
from pathlib import Path
from database import init_db, get_all_results, save_result
from agents import run_prediction_workflow
from app_utils import add_bg_from_local, load_data # <-- Import from helper

# --- Page Configuration and Setup ---
st.set_page_config(page_title="AI Agri-Forecast Model", page_icon="🔮", layout="wide")
init_db()
df = load_data()
image_path = Path("assets/background.jpg")
if image_path.exists():
    add_bg_from_local(str(image_path))

# --- Main Page Content ---
st.title("🔮 AI Agri-Forecast Model")
st.markdown("Enter a commodity and optionally narrow by region to generate a predictive market analysis using a local AI agent.")

col_ai_input, col_ai_output = st.columns([2, 3])

with col_ai_input:
    st.header("Forecast Parameters")
    with st.container(border=True):
        commodities_list = [""] + sorted(df['Commodity'].unique().tolist())
        states_list = ["All"] + sorted(df['State'].unique().tolist())
        
        commodity = st.selectbox("Select Commodity (Required):", options=commodities_list)
        state = st.selectbox("Filter by State (Optional):", options=states_list)
        
        if st.button("Generate AI Forecast", type="primary", use_container_width=True):
            if commodity:
                # Add "type" to query for DB filtering
                user_query = {"type": "AI Forecast", "commodity": commodity, "state": state, "market": "All"}
                
                with col_ai_output:
                    st.header("Prediction & Forecast Report")
                    with st.container(height=600, border=True):
                        with st.spinner("🧠 AI agent is generating your forecast..."):
                            final_report = run_prediction_workflow(user_query, st)
                        
                        if final_report:
                            save_result(user_query, final_report)
                            st.toast("✅ Forecast complete and saved to history!")
                            st.rerun()
                        else:
                            st.error("The model could not generate a forecast.")
            else:
                st.warning("Please select a commodity.")

with col_ai_output:
    if 'report_placeholder' not in st.session_state:
        st.header("Prediction & Forecast Report")
        with st.container(height=600, border=True):
             st.caption("Your AI forecast will appear here...")

# --- AI FORECAST HISTORY ---
st.write("---")
st.header("📜 AI Forecast History")
# Filter history to only show AI Forecasts
past_results = [res for res in get_all_results() if json.loads(res[2]).get("type") == "AI Forecast"]
if not past_results:
    st.info("No past AI forecasts have been saved yet.")
else:
    for res in past_results:
        query_details = json.loads(res[2])
        title_str = f"Forecast for **{query_details.get('commodity', 'N/A')}** in **{query_details.get('state', 'All')}** (on {res[1].split(' ')[0]})"
        with st.expander(title_str):
            st.markdown(res[3], unsafe_allow_html=True)