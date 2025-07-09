import streamlit as st
import pandas as pd
import base64
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns

def add_bg_from_local(image_file):
    # (code is unchanged from before)
    with open(image_file, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode()
    st.markdown(
        f"""
        <style>
        .stApp {{
            background-image: url(data:image/{"jpg"};base64,{encoded_string});
            background-size: cover; background-attachment: fixed;
        }}
        .stApp::before {{
            content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background-image: inherit; background-size: cover; filter: blur(8px); z-index: -1;
        }}
        .st-emotion-cache-16txtl3, .st-emotion-cache-1y4p8pa, .st-emotion-cache-1d3w5bk, [data-testid="stExpander"], .st-emotion-cache-6qob1r {{
            background-color: rgba(255, 255, 255, 0.85); border-radius: 10px;
            padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }}
        [data-testid="stHeader"], h1 {{ text-shadow: 2px 2px 4px rgba(0,0,0,0.3); color: #2c3e50 !important; }}
        </style>
        """,
        unsafe_allow_html=True
    )


@st.cache_data
def load_data():
    # (code is unchanged from before)
    df_path = "agriculture.csv"
    if not Path(df_path).exists():
        st.error(f"Dataset not found at {df_path}")
        return pd.DataFrame()
    df = pd.read_csv(df_path)
    df.columns = df.columns.str.replace('_x0020_', '_', regex=True)
    for col in ['Min_Price', 'Max_Price', 'Modal_Price']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.dropna(subset=['Modal_Price', 'Commodity', 'Market'], inplace=True)
    return df

def display_correlation_heatmap(df):
    # (code is unchanged from before)
    st.subheader("Correlation Heatmap")
    numeric_df = df[['Min_Price', 'Max_Price', 'Modal_Price']]
    if not numeric_df.empty and len(numeric_df) > 1:
        corr = numeric_df.corr()
        fig, ax = plt.subplots()
        sns.heatmap(corr, annot=True, cmap='coolwarm', fmt=".2f", ax=ax)
        st.pyplot(fig)
    else:
        st.warning("Not enough data to generate a correlation heatmap.")