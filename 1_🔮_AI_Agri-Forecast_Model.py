import streamlit as st
import json
from pathlib import Path
import streamlit_authenticator as stauth # <-- New import
from database import init_db, get_all_results_for_user, save_result # <-- Use user-specific functions
from agents import run_prediction_workflow
from app_utils import add_bg_from_local, load_data

# --- Page Configuration and Setup ---
st.set_page_config(page_title="AI Agri-Forecast Model", page_icon="🔮", layout="wide")
df = load_data()
image_path = Path("assets/background.jpg")
if image_path.exists():
    add_bg_from_local(str(image_path))

# --- USER AUTHENTICATION ---
# This would be replaced with a proper user database in a real app
# For now, we use a simple dictionary stored in secrets.
# In your Streamlit secrets, add:
# [users]
# jsmith = "John Smith"
# rdoe = "Rebecca Doe"
# [passwords]
# jsmith = "abc"  <-- HASH THIS! Run `stauth.Hasher(['abc', 'def']).generate()` locally to get hashes
# rdoe = "def"
names = list(st.secrets.users.values())
usernames = list(st.secrets.users.keys())
hashed_passwords = stauth.Hasher(list(st.secrets.passwords.values())).generate()

authenticator = stauth.Authenticate(names, usernames, hashed_passwords,
    "agri_app_cookie", "abcdef", cookie_expiry_days=30)

st.title("🔮 AI Agri-Forecast Model")

name, authentication_status, username = authenticator.login('main')

if authentication_status == False:
    st.error("Username/password is incorrect")
if authentication_status == None:
    st.warning("Please enter your username and password")

# --- MAIN APP LOGIC (only runs after successful login) ---
if authentication_status:
    authenticator.logout("Logout", "sidebar")
    st.sidebar.title(f"Welcome *{name}*")
    
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
                                # Save result with the logged-in user's username
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
    st.header(f"📜 {name}'s Forecast History")
    # Get history only for the logged-in user
    past_results = get_all_results_for_user(username)
    if not past_results:
        st.info("You have no past AI forecasts saved.")
    else:
        for res in past_results:
            query_details = json.loads(res['query_data'])
            title_str = f"Forecast for **{query_details.get('commodity', 'N/A')}** in **{query_details.get('state', 'All')}** (on {res['created_at'].split('T')[0]})"
            with st.expander(title_str):
                st.markdown(res['report_data'], unsafe_allow_html=True)