import streamlit as st
import pandas as pd
from pathlib import Path
import os
from dotenv import load_dotenv
from app_utils import add_bg_from_local, load_data
import database as db
import qrcode
from io import BytesIO

# --- Page Config and Setup ---
st.set_page_config(page_title="Finance & Sales", page_icon="💳", layout="wide")
db.init_db()
df_master = load_data()

# --- UPI ID Setup ---
load_dotenv()
MY_UPI_ID = os.getenv("MY_UPI_ID")
if not MY_UPI_ID:
    st.error("Your UPI ID is not found. Please add MY_UPI_ID to your .env file.")

# --- UI Setup ---
image_path = Path(__file__).parent.parent / "assets/background.jpg"
if image_path.exists():
    add_bg_from_local(str(image_path))

# --- Function to generate QR Code ---
def generate_upi_qr_code(payee_upi_id, payee_name, amount, transaction_note):
    upi_string = f"upi://pay?pa={payee_upi_id}&pn={payee_name.replace(' ', '%20')}&am={amount:.2f}&tn={transaction_note.replace(' ', '%20')}&cu=INR"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(upi_string)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

# --- Main Page Content ---
st.title("💳 Finance & Sales Dashboard")
st.markdown("Generate dynamic UPI QR codes for real-time, secure payments.")

with st.expander("Generate Payment QR Code for a Shipment", expanded=True):
    shipments_df = db.get_active_shipments()
    available_for_sale = shipments_df[shipments_df['status'] == 'ARRIVED']

    if available_for_sale.empty:
        st.warning("No shipments have arrived at their destination yet. Move a truck on the Logistics page first.")
    else:
        # --- STEP 1: SELECTION (Outside the form) ---
        st.subheader("Step 1: Select a Shipment")
        options = [""] + available_for_sale['id'].tolist()
        selected_shipment_id = st.selectbox(
            "Choose an arrived shipment:",
            options=options,
            format_func=lambda x: f"Shipment #{x}" if x else "Select a shipment..."
        )

        # --- STEP 2: ACTION (Inside the form) ---
        # The form is only displayed IF a shipment has been selected.
        if selected_shipment_id:
            st.subheader("Step 2: Set Price and Generate QR Code")
            
            # Get the details for the selected shipment
            shipment_details = available_for_sale[available_for_sale['id'] == selected_shipment_id].iloc[0]
            
            with st.form("payment_form"):
                # Display details as static text inside the form
                st.info(f"You are creating a payment request for Shipment #{shipment_details['id']}.")
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Commodity", shipment_details['commodity'])
                with col2:
                    st.metric("Quantity", f"{shipment_details['quantity']} KG")
                with col3:
                    st.metric("Destination", shipment_details['destination_market'])

                st.write("---")
                
                price_per_unit = st.number_input("Final Sale Price per Unit (₹)", min_value=0.01, step=0.50, format="%.2f")
                payee_name = st.text_input("Your Business Name (for QR Code)", "Agri-Chain OS Seller")

                submitted = st.form_submit_button("Generate UPI QR Code")
                if submitted:
                    if price_per_unit > 0:
                        total_amount = float(shipment_details['quantity']) * price_per_unit
                        transaction_note = f"Payment for {shipment_details['quantity']}KG {shipment_details['commodity']} Shipment #{shipment_details['id']}"
                        
                        qr_code_image = generate_upi_qr_code(MY_UPI_ID, payee_name, total_amount, transaction_note)
                        st.session_state.qr_code_details = {"image": qr_code_image, "amount": total_amount, "note": transaction_note}

                        db.log_sale(shipment_details['commodity'], shipment_details['quantity'], price_per_unit, shipment_details['destination_market'])
                        db.deliver_shipment(shipment_details['id'])
                        
                        st.toast("QR Code generated and sale logged!")
                    else:
                        st.warning("Please enter a valid price.")

# Display QR code logic
if 'qr_code_details' in st.session_state and st.session_state.qr_code_details:
    details = st.session_state.qr_code_details
    st.subheader("✅ Scan to Pay")
    st.info(f"Ask your buyer to scan the QR code to pay **₹{details['amount']:.2f}**.")
    st.image(details['image'], width=300)
    st.caption(f"Transaction Note: {details['note']}")
    if st.button("Clear QR Code & Finish"):
        del st.session_state.qr_code_details
        st.rerun()

# Financial Dashboard
st.write("---")
st.header("Financial Overview")
# ... (rest of the file is unchanged) ...
sales_df = db.get_sales_data()
if sales_df.empty:
    st.info("No sales have been logged yet.")
else:
    total_revenue = sales_df['total_revenue'].sum()
    total_sales = len(sales_df)
    avg_sale_value = sales_df['total_revenue'].mean()
    col1, col2, col3 = st.columns(3)
    col1.metric("Total Revenue", f"₹{total_revenue:,.2f}"); col2.metric("Total Sales Logged", total_sales); col3.metric("Average Sale Value", f"₹{avg_sale_value:,.2f}")
    st.subheader("Revenue by Commodity"); st.bar_chart(sales_df.groupby('commodity')['total_revenue'].sum())
    st.subheader("Recent Sales Transactions"); st.dataframe(sales_df, use_container_width=True)