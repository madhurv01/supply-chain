import streamlit as st
from supabase import create_client, Client
import json

# Initialize the Supabase client only once
@st.cache_resource
def init_supabase_client():
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_ANON_KEY"]
    return create_client(url, key)

supabase: Client = init_supabase_client()

def save_result(user_id, query_details, report):
    """Saves a new result associated with a specific user to Supabase."""
    try:
        # We now include the user_id in the record
        data, count = supabase.table('results').insert({
            'user_id': user_id, 
            'query_data': json.dumps(query_details), 
            'report_data': report
        }).execute()
        print("Successfully saved to Supabase.")
    except Exception as e:
        st.error(f"Database Error: Could not save result. {e}")
        print(f"Error saving to Supabase: {e}")

def get_all_results_for_user(user_id):
    """Retrieves all past results for a specific user from Supabase."""
    try:
        data, count = supabase.table('results').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        # The actual list of records is in the 'data' attribute of the response object
        return data.data if data else []
    except Exception as e:
        st.error(f"Database Error: Could not fetch history. {e}")
        print(f"Error fetching from Supabase: {e}")
        return []