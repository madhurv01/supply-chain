import os
import pandas as pd
from dotenv import load_dotenv
import autogen
from autogen import ConversableAgent, UserProxyAgent
import streamlit as st

# --- Configuration and Data Loading ---
load_dotenv()
try:
    df = pd.read_csv("agriculture.csv")
    df.columns = df.columns.str.replace('_x0020_', '_', regex=True)
    for col in ['Min_Price', 'Max_Price', 'Modal_Price']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.dropna(subset=['Modal_Price', 'Commodity', 'Market'], inplace=True)
except FileNotFoundError:
    print("Error: agriculture.csv not found. Please place it in the project directory.")
    exit()

# --- THE ONLY CHANGE: SWITCHING TO GROQ FOR CLOUD DEPLOYMENT ---
# This configuration uses the Groq cloud API.
config_list = [{
    "model": "llama3-8b-8192",  # Fast and efficient model
    "api_key": st.secrets.get("GROQ_API_KEY"), # Use .get() for safety
    "base_url": "https://api.groq.com/openai/v1" # Groq's API endpoint
}]


# --- (The rest of the file is IDENTICAL to your last working version) ---

def calculate_predictive_metrics(commodity: str, state: str = "All", market: str = "All") -> str:
    filtered_df = df[df['Commodity'].str.contains(commodity, case=False, na=False)]
    if state != "All":
        filtered_df = filtered_df[filtered_df['State'].str.contains(state, case=False, na=False)]
    if market != "All":
        filtered_df = filtered_df[filtered_df['Market'].str.contains(market, case=False, na=False)]
    if filtered_df.empty:
        return f"No data found for '{commodity}' in the specified region. Cannot generate a forecast."
    avg_modal_price = filtered_df['Modal_Price'].mean()
    price_std_dev = filtered_df['Modal_Price'].std()
    volatility = (price_std_dev / avg_modal_price) * 100 if avg_modal_price > 0 else 0
    best_market_row = filtered_df.loc[filtered_df['Modal_Price'].idxmax()]
    highest_price_market = f"{best_market_row['Market']}, {best_market_row['State']}"
    highest_price_value = best_market_row['Modal_Price']
    demand_indicator = filtered_df['Market'].nunique()
    return (
        f"Data for {commodity}:\n"
        f"- Avg Price: {avg_modal_price:.2f}\n"
        f"- Volatility: {volatility:.2f}%\n"
        f"- Top Market: {highest_price_market} at ₹{highest_price_value:.2f}\n"
        f"- Demand Indicator: {demand_indicator} markets"
    )

def run_prediction_workflow(user_query_details, st_container):
    llm_config = {"config_list": config_list}
    forecasting_agent = ConversableAgent(
        name="Forecasting_Agent",
        system_message=(
            "You are a forecast generator. You will be given data. Your task is to turn it into a 3-part report. "
            "Use these exact headings: '### Price Forecast', '### Market-Risk Forecast', '### Strategic Opportunity Forecast'. "
            "Under the last heading, provide exactly 5 short tips. "
            "When the report is done, you MUST respond with the single word: TERMINATE."
        ),
        llm_config=llm_config,
        code_execution_config={"use_docker": False}
    )
    user_proxy = UserProxyAgent(name="UserProxy", human_input_mode="NEVER", code_execution_config=False)
    forecasting_agent.register_function(
        function_map={"calculate_predictive_metrics": calculate_predictive_metrics}
    )
    commodity = user_query_details.get('commodity', '')
    state = user_query_details.get('state', 'All')
    market = user_query_details.get('market', 'All')
    initial_message = (
        "Use the `calculate_predictive_metrics` tool for this query: "
        f"commodity='{commodity}', state='{state}', market='{market}'.\n"
        "Then, generate the 3-part report as instructed."
    )
    user_proxy.initiate_chat(forecasting_agent, message=initial_message)
    final_report_message = user_proxy.last_message(agent=forecasting_agent)
    final_report = ""
    if final_report_message:
        final_report = final_report_message.get("content", "").replace("TERMINATE", "").strip()
    return final_report