import os
import json
from pathlib import Path
from dotenv import load_dotenv
import streamlit as st
from database import init_db, get_all_results_for_user, save_result
from agents import run_prediction_workflow
from app_utils import add_bg_from_local, load_data

load_dotenv()
init_db()

# --- Page Configuration and Setup ---
st.set_page_config(page_title="AI Agri-Forecast Model", page_icon="🔮", layout="wide")
df = load_data()
image_path = Path("assets/background.jpg")
if image_path.exists():
    add_bg_from_local(str(image_path))

st.title("🔮 AI Agri-Forecast Model")

# --- Simple .env-based login ---
# Set APP_USERNAME / APP_PASSWORD in your .env file. Defaults to a demo
# account if unset, so the app is usable out of the box.
APP_USERNAME = os.getenv("APP_USERNAME", "demo")
APP_PASSWORD = os.getenv("APP_PASSWORD", "demo123")

if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if not st.session_state.authenticated:
    with st.form("login_form"):
        st.subheader("Login")
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Log in")
        if submitted:
            if username == APP_USERNAME and password == APP_PASSWORD:
                st.session_state.authenticated = True
                st.session_state.username = username
                st.rerun()
            else:
                st.error("Username/password is incorrect")
    st.caption("Demo credentials: `demo` / `demo123` (override via APP_USERNAME / APP_PASSWORD in .env)")
    st.stop()

username = st.session_state.username

# --- MAIN APP LOGIC (only runs after successful login) ---
st.sidebar.title(f"Welcome *{username}*")
if st.sidebar.button("Logout"):
    st.session_state.authenticated = False
    st.rerun()

st.markdown("Enter a commodity and optionally narrow by region to generate a predictive market analysis.")

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
                user_query = {"type": "AI Forecast", "commodity": commodity, "state": state, "market": "All"}

                with col_ai_output:
                    st.header("Prediction & Forecast Report")
                    with st.container(height=600, border=True):
                        with st.spinner("🧠 AI agent is generating your forecast..."):
                            final_report = run_prediction_workflow(user_query, st)

                        if final_report:
                            save_result(username, user_query, final_report)
                            st.toast("✅ Forecast complete and saved to your personal history!")
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

# --- PERSONALIZED AI FORECAST HISTORY ---
st.write("---")
st.header(f"📜 {username}'s Forecast History")
past_results = get_all_results_for_user(username)
if not past_results:
    st.info("You have no past AI forecasts saved.")
else:
    for res in past_results:
        query_details = json.loads(res['query_data'])
        title_str = f"Forecast for **{query_details.get('commodity', 'N/A')}** in **{query_details.get('state', 'All')}** (on {res['created_at'].split('T')[0]})"
        with st.expander(title_str):
            st.markdown(res['report_data'], unsafe_allow_html=True)
