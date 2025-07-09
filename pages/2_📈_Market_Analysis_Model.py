import streamlit as st
import pandas as pd
import json
from pathlib import Path
from app_utils import add_bg_from_local, load_data, display_correlation_heatmap
from database import init_db, get_all_results, save_result

# --- Page Configuration and Setup ---
st.set_page_config(page_title="Market Analysis Model", page_icon="📈", layout="wide")
init_db()
df = load_data()
image_path = Path(__file__).parent.parent / "assets/background.jpg"
if image_path.exists():
    add_bg_from_local(str(image_path))

# --- Main Page Content ---
st.title("📈 Market Analysis Model")
st.markdown("Use this tool for fast, data-driven insights. This feature does not use AI. All analyses are saved to history.")

col1, col2 = st.columns([2, 3])

with col1:
    analysis_type = st.radio(
        "Choose your analysis:",
        ["Best Market for a Commodity", "Best Commodity for a Market"],
        horizontal=True, key="ml_radio"
    )

    if analysis_type == "Best Market for a Commodity":
        st.subheader("Find the Best Market to Sell...")
        commodities_list = [""] + sorted(df['Commodity'].unique().tolist())
        selected_commodity = st.selectbox("Select a Commodity:", options=commodities_list, key="ml_commodity")
        
        if st.button("Analyze Commodity", use_container_width=True):
            if selected_commodity:
                commodity_df = df[df['Commodity'] == selected_commodity]
                if not commodity_df.empty:
                    best_market_analysis = commodity_df.groupby('Market')['Modal_Price'].mean().nlargest(5).reset_index()
                    best_market = best_market_analysis.iloc[0]
                    
                    st.session_state.ml_result = {
                        "type": "Market Analysis",
                        "analysis_type": "Best Market for Commodity",
                        "query_value": selected_commodity,
                        "top_recommendation": best_market['Market'],
                        "top_price": f"₹{best_market['Modal_Price']:.2f}",
                        "chart_data": best_market_analysis.set_index('Market')
                    }
                    
                    query_for_db = st.session_state.ml_result.copy()
                    query_for_db.pop("chart_data")
                    
                    report_for_db = (
                        f"### Top Recommendation for '{selected_commodity}'\n"
                        f"- **Best Market to Sell:** {best_market['Market']}\n"
                        f"- **Expected Average Price:** ₹{best_market['Modal_Price']:.2f}"
                    )
                    
                    save_result(query_for_db, report_for_db)
                    st.toast("✅ Analysis saved to history!")
                    st.rerun()

    elif analysis_type == "Best Commodity for a Market":
        st.subheader("Find the Best Commodity to Sell in...")
        markets_list = [""] + sorted(df['Market'].unique().tolist())
        selected_market = st.selectbox("Select a Market:", options=markets_list, key="ml_market")
        
        if st.button("Analyze Market", use_container_width=True):
            if selected_market:
                market_df = df[df['Market'] == selected_market]
                if not market_df.empty:
                    best_commodity_analysis = market_df.groupby('Commodity')['Modal_Price'].mean().nlargest(5).reset_index()
                    best_commodity = best_commodity_analysis.iloc[0]

                    st.session_state.ml_result = {
                        "type": "Market Analysis",
                        "analysis_type": "Best Commodity for Market",
                        "query_value": selected_market,
                        "top_recommendation": best_commodity['Commodity'],
                        "top_price": f"₹{best_commodity['Modal_Price']:.2f}",
                        "chart_data": best_commodity_analysis.set_index('Commodity')
                    }
                    
                    query_for_db = st.session_state.ml_result.copy()
                    query_for_db.pop("chart_data")

                    report_for_db = (
                        f"### Top Recommendation for '{selected_market}' Market\n"
                        f"- **Best Commodity to Sell:** {best_commodity['Commodity']}\n"
                        f"- **Expected Average Price:** ₹{best_commodity['Modal_Price']:.2f}"
                    )
                    
                    save_result(query_for_db, report_for_db)
                    st.toast("✅ Analysis saved to history!")
                    st.rerun()

with col2:
    st.header("Analysis Results")
    if 'ml_result' in st.session_state and st.session_state.ml_result:
        res = st.session_state.ml_result
        st.metric(label=f"🏆 Top Recommendation for '{res['query_value']}'", value=res['top_recommendation'])
        st.metric(label="💰 Expected Avg. Price", value=res['top_price'])
        
        st.subheader("Price Analysis Graph")
        st.bar_chart(res['chart_data']['Modal_Price'])
        
        # The heatmap needs the original numeric columns, not just the grouped result.
        # We filter the main dataframe based on the markets/commodities in our chart data.
        if res['analysis_type'] == "Best Market for Commodity":
            heatmap_df = df[df['Market'].isin(res['chart_data'].index)]
        else: # Best Commodity for Market
            heatmap_df = df[df['Commodity'].isin(res['chart_data'].index)]
        display_correlation_heatmap(heatmap_df)

    else:
        st.info("Select parameters and click 'Analyze' to see results here.")


# --- MARKET ANALYSIS HISTORY ---
st.write("---")
st.header("📜 Market Analysis History")
past_results = [res for res in get_all_results() if json.loads(res[2]).get("type") == "Market Analysis"]
if not past_results:
    st.info("No past market analyses have been saved yet.")
else:
    for res in past_results:
        query_details = json.loads(res[2])
        title_str = f"**{query_details.get('analysis_type', 'Analysis')}** for **'{query_details.get('query_value', 'N/A')}'** (on {res[1].split(' ')[0]})"
        with st.expander(title_str):
            st.markdown(res[3], unsafe_allow_html=True)