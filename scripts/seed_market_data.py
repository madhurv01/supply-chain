"""
Seeds market_prices from agriculture.csv using a signed-in Supabase user (SEED_USER_EMAIL /
SEED_USER_PASSWORD env vars) and the anon key.

NOTE: as applied, the market_prices table's RLS only has a SELECT policy for authenticated
users -- there is no INSERT policy, so this script's inserts will fail with a permission error
until scripts/seed_market_data.sql (which adds an authenticated INSERT policy) has been applied
to the database. Prefer running seed_market_data.sql directly via the Supabase SQL editor /
migration tool -- it's the primary, more reliable path. This script is kept as a convenience for
re-seeding once that policy exists.
"""
import os
import sys
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SEED_USER_EMAIL = os.getenv("SEED_USER_EMAIL")
SEED_USER_PASSWORD = os.getenv("SEED_USER_PASSWORD")

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "agriculture.csv")


def main():
    if not (SEED_USER_EMAIL and SEED_USER_PASSWORD):
        print("Set SEED_USER_EMAIL and SEED_USER_PASSWORD env vars to run this script.")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    auth_response = client.auth.sign_in_with_password(
        {"email": SEED_USER_EMAIL, "password": SEED_USER_PASSWORD}
    )
    client.postgrest.auth(auth_response.session.access_token)

    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.replace("_x0020_", "_", regex=True)
    for col in ["Min_Price", "Max_Price", "Modal_Price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df.dropna(subset=["Modal_Price", "Commodity", "Market"], inplace=True)

    rows = []
    for _, r in df.iterrows():
        try:
            price_date = datetime.strptime(str(r["Arrival_Date"]).strip(), "%d/%m/%Y").date().isoformat()
        except ValueError:
            continue
        rows.append(
            {
                "commodity": r["Commodity"],
                "state": r["State"],
                "market": r["Market"],
                "min_price": float(r["Min_Price"]),
                "max_price": float(r["Max_Price"]),
                "modal_price": float(r["Modal_Price"]),
                "price_date": price_date,
            }
        )

    BATCH = 500
    inserted = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        try:
            client.table("market_prices").insert(chunk).execute()
            inserted += len(chunk)
        except Exception as exc:
            print(f"Insert failed at batch {i}: {exc}")
            print(
                "This is expected if the authenticated INSERT policy hasn't been applied yet. "
                "Run scripts/seed_market_data.sql via the Supabase SQL editor / migration tool instead."
            )
            sys.exit(1)

    print(f"Inserted {inserted} rows into market_prices.")


if __name__ == "__main__":
    main()
