import psycopg2
import json
import random
from datetime import datetime
import time
from collections import defaultdict

# ========================
# Configuration
# ========================
DB_CONFIG = {
    "dbname": "machine_csv",
    "user": "postgres",
    "password": "@Abhi1432",
    "host": "localhost",
    "port": "5432"
}

INTERVAL_SECONDS = 1  # Data generation interval

# Track active alerts
active_alerts = defaultdict(dict)

# ========================
# Database Connection
# ========================
def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return None

# ========================
# Data Generation
# ========================
def generate_random_data():
    alerts = [
        "0x00001000", "0x00004000", "0x00000010", "0x00000002", 
        "0x00000800", "0x00000040", "0x00000020", "0x00008000",
        "0x00002000", "0x00000001"
    ]
    
    current_time = datetime.now()
    ts = current_time.strftime("%Y-%m-%d %H:%M:%S+05:30")
    ts_bigint = int(current_time.timestamp())
    
    alert = random.choice(alerts)
    # gfrid = random.choice([16, 17, 18, 19, 20, 21, 22,22]),

    gfrid = "21"
    status = random.randint(0, 1)
    
    # Generate data structure
    data = {
        "alert": alert,
        "status": status,
        "GFRID": gfrid,
        "TS": ts,
        "TS_OFF": None,
        "TS_BigInt": ts_bigint,
        "TS_OFF_BigInt": None,
        "last_modified": ts,
        "alertNotify_id": random.randint(1, 12),
        "jsonFile": None
    }
    
    # Dynamic JSON generation
    json_data = {
        "TS": str(data["TS_BigInt"]),
        "ALERT": data["alert"],
        "STATUS": str(data["status"])
    }
    
    if data["alert"] == "0x00000040":
        json_data["GGSOC"] = str(random.randint(1, 100))
    elif data["alert"] == "0x00000020":
        json_data["GGVOLT"] = str(random.randint(3500, 4500))
    elif data["alert"] == "0x00000001":
        json_data["GSMSQ"] = str(random.randint(0, 5))
    
    data["jsonFile"] = json.dumps(json_data)
    return data

# ========================
# Database Operations
# ========================
def update_previous_alert(alert_key, new_ts_bigint):
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            # Get the most recent active alert of this type
            cur.execute("""
                SELECT id, "TS_BigInt" FROM checkapp_machineevent
                WHERE "GFRID" = %s AND alert = %s AND status = 1
                ORDER BY "TS_BigInt" DESC LIMIT 1
            """, (alert_key.split('_')[0], alert_key.split('_')[1]))
            
            result = cur.fetchone()
            if result:
                alert_id, old_ts_bigint = result
                ts_off_bigint = new_ts_bigint - 1  # Set OFF timestamp 1 second before new occurrence
                ts_off = datetime.fromtimestamp(ts_off_bigint).strftime("%Y-%m-%d %H:%M:%S+05:30")
                
                # Update the previous record
                cur.execute("""
                    UPDATE checkapp_machineevent 
                    SET "TS_OFF" = %s, "TS_OFF_BigInt" = %s, status = 0
                    WHERE id = %s
                """, (ts_off, ts_off_bigint, alert_id))
                
                conn.commit()
                print(f"✅ Updated previous alert {alert_id} with TS_OFF")
                return True
    except Exception as e:
        print(f"❌ Error updating previous alert: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def insert_data(data):
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            # First handle any active alerts of the same type
            alert_key = f"{data['GFRID']}_{data['alert']}"
            if data['status'] == 1 and alert_key in active_alerts:
                update_previous_alert(alert_key, data['TS_BigInt'])
            
            # Insert the new record
            cur.execute("""
                INSERT INTO checkapp_machineevent (
                    alert, status, "GFRID", "TS", "TS_OFF",
                    "TS_BigInt", "TS_OFF_BigInt", "jsonFile", "last_modified", "alertNotify_id"
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                RETURNING id
            """, (
                data["alert"], data["status"], data["GFRID"], data["TS"],
                data["TS_OFF"], data["TS_BigInt"], data["TS_OFF_BigInt"],
                data["jsonFile"], data["last_modified"], data["alertNotify_id"]
            ))
            
            new_id = cur.fetchone()[0]
            conn.commit()
            
            print(f"\n⏰ [{datetime.now().strftime('%H:%M:%S')}] New Data Inserted (ID: {new_id}):")
            print(json.dumps(data, indent=2))
            
            # Update active alerts tracking
            if data['status'] == 1:
                active_alerts[alert_key] = {
                    'id': new_id,
                    'ts_bigint': data['TS_BigInt']
                }
            else:
                active_alerts.pop(alert_key, None)
            
            return True
    except Exception as e:
        print(f"❌ Error inserting data: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def verify_data_insertion():
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Get the last 5 entries
            cur.execute("""
                SELECT id, alert, status, "TS", "TS_OFF", "TS_BigInt", "TS_OFF_BigInt"
                FROM checkapp_machineevent
                ORDER BY id DESC
                LIMIT 5
            """)
            
            results = cur.fetchall()
            if results:
                print("\n🔍 Last 5 Database Entries:")
                for row in results:
                    print(f"ID: {row[0]}, Alert: {row[1]}, Status: {row[2]}, TS: {row[3]}, TS_OFF: {row[4]}")
            else:
                print("⚠️ No entries found in database")
    except Exception as e:
        print(f"❌ Error verifying data: {e}")
    finally:
        conn.close()

# ========================
# Main Execution
# ========================
def main():
    print("🚀 Starting Machine Data Simulator")
    print(f"📊 Generating data every {INTERVAL_SECONDS} seconds")
    print("Press Ctrl+C to stop\n")
    
    while True:
        try:
            data = generate_random_data()
            if insert_data(data):
                verify_data_insertion()
            time.sleep(INTERVAL_SECONDS)
        except KeyboardInterrupt:
            print("\n🛑 Script stopped by user")
            break
        except Exception as e:
            print(f"⚠️ Unexpected error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()













# import psycopg2
# import csv
# import json

# # Connect to PostgreSQL
# conn = psycopg2.connect(
#     dbname="machine_csv",
#     user="postgres",
#     password="@Abhi1432",
#     host="localhost",
#     port="5432"
# )
# cur = conn.cursor()

# # Path to your updated CSV file
# file_path = r"C:\Users\USER\Downloads\updated_machine_data_sorted_by_id.csv"

# with open(file_path, 'r', encoding='utf-8') as f:
#     reader = csv.DictReader(f)
#     for i, row in enumerate(reader):
#         try:
#             # Handle GFRID and alertNotify_id
#             gfrid = int(row["GFRID"]) if row["GFRID"] not in ("NULL", "", None) else None
#             alertNotify_id = int(row["alertNotify_id"]) if row["alertNotify_id"] not in ("NULL", "", None) else None

#             # Handle TS_BigInt and TS_OFF_BigInt with float fallback
#             ts_bigint = int(float(row["TS_BigInt"])) if row["TS_BigInt"] not in ("NULL", "", None) else None
#             ts_off_bigint = int(float(row["TS_OFF_BigInt"])) if row["TS_OFF_BigInt"] not in ("NULL", "", None) else None

#             # Parse JSON safely
#             json_value = row["jsonFile"]
#             if isinstance(json_value, str):
#                 try:
#                     json_value = json.loads(json_value)
#                 except Exception as e:
#                     print(f"⚠️ JSON parsing error in row {i+1}: {e}")
#                     continue
#             json_str = json.dumps(json_value)

#             # Insert into database
#             cur.execute("""
#                 INSERT INTO checkapp_machineevent (
#                     alert, status, "GFRID", "TS", "TS_OFF",
#                     "TS_BigInt", "TS_OFF_BigInt", "jsonFile", "last_modified", "alertNotify_id"
#                 ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
#             """, (
#                 row["alert"],
#                 int(row["status"]),
#                 gfrid,
#                 row["TS"],
#                 None if row["TS_OFF"] in ("NULL", "", None) else row["TS_OFF"],
#                 ts_bigint,
#                 ts_off_bigint,
#                 json_str,
#                 row["last_modified"],
#                 alertNotify_id,
#             ))

#         except Exception as e:
#             conn.rollback()  # Roll back the transaction for this row only
#             print(f"❌ Row {i+1} skipped due to error: {e}")
#         else:
#             conn.commit()  # Commit only if successful

# # Clean up
# cur.close()
# conn.close()
# print("✅ Safe import finished.")









# import psycopg2
# import json
# import random
# from datetime import datetime
# import time
# from threading import Thread

# # ========================
# # Configuration
# # ========================
# DB_CONFIG = {
#     "dbname": "machine_csv",
#     "user": "postgres",
#     "password": "@Abhi1432",
#     "host": "localhost",
#     "port": "5432"
# }

# INTERVAL_SECONDS = 5  # Data generation every 20 seconds

# # ========================
# # Data Generation
# # ========================
# def generate_random_data():
#     alerts = [
#         "0x00001000", "0x00004000", "0x00000010", "0x00000002", 
#         "0x00000800", "0x00000040", "0x00000020", "0x00008000",
#         "0x00002000", "0x00000001"
#     ]
    
#     current_time = datetime.now()
#     ts = current_time.strftime("%Y-%m-%d %H:%M:%S+05:30")
    
#     data = {
#         "alert": random.choice(alerts),
#         "status": random.randint(0, 1),
#         # "GFRID": random.choice([16, 17, 18, 19, 20, 21, 22]),
#         "GFRID": "17",

#         "TS": ts,
#         "TS_OFF": None,
#         "TS_BigInt": int(current_time.timestamp()),
#         "TS_OFF_BigInt": None,
#         "last_modified": ts,
#         "alertNotify_id": random.randint(1, 12)
#     }
    
#     # Dynamic JSON generation
#     json_data = {
#         "TS": str(data["TS_BigInt"]),
#         "ALERT": data["alert"],
#         "STATUS": str(data["status"])
#     }
    
#     if data["alert"] == "0x00000040":
#         json_data["GGSOC"] = str(random.randint(1, 100))  # Random battery charge (1-100%)
#     elif data["alert"] == "0x00000020":
#         json_data["GGVOLT"] = str(random.randint(3500, 4500))  # Random voltage (3500-4500mV)
#     elif data["alert"] == "0x00000001":
#         json_data["GSMSQ"] = str(random.randint(0, 5))  # Random GSM signal (0-5)
    
#     data["jsonFile"] = json.dumps(json_data)
#     return data

# # ========================
# # Database Operations
# # ========================
# def db_operation(query, params=None, fetch=False):
#     """Generic database operation handler"""
#     conn = None
#     try:
#         conn = psycopg2.connect(**DB_CONFIG)
#         cur = conn.cursor()
#         cur.execute(query, params)
#         if fetch:
#             return cur.fetchall()
#         conn.commit()
#     except Exception as e:
#         print(f"❌ DB Error: {e}")
#         if conn:
#             conn.rollback()
#         return None
#     finally:
#         if conn:
#             conn.close()

# def insert_data(data):
#     print(f"\n⏰ [{datetime.now().strftime('%H:%M:%S')}] New Data Generated:")
#     print(json.dumps(data, indent=2))
    
#     db_operation("""
#         INSERT INTO checkapp_machineevent (
#             alert, status, "GFRID", "TS", "TS_OFF",
#             "TS_BigInt", "TS_OFF_BigInt", "jsonFile", "last_modified", "alertNotify_id"
#         ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
#     """, (
#         data["alert"], data["status"], data["GFRID"], data["TS"],
#         data["TS_OFF"], data["TS_BigInt"], data["TS_OFF_BigInt"],
#         data["jsonFile"], data["last_modified"], data["alertNotify_id"]
#     ))
    
#     verify_last_entry()

# def verify_last_entry():
#     result = db_operation("""
#         SELECT "alert", "TS", "jsonFile" 
#         FROM checkapp_machineevent 
#         ORDER BY "TS" DESC 
#         LIMIT 1
#     """, fetch=True)
    
#     if result:
#         print("✅ Verification - Last DB Entry:")
#         print(f"Alert: {result[0][0]}")
#         print(f"Timestamp: {result[0][1]}")
#         print(f"Data: {result[0][2]}")
#     else:
#         print("⚠️ No entries found in database")

# # ========================
# # Main Execution
# # ========================
# def main():
#     print("🚀 Starting Machine Data Simulator (20-second intervals)")
#     print("Press Ctrl+C to stop\n")
    
#     while True:
#         try:
#             data = generate_random_data()
#             insert_data(data)
#             time.sleep(INTERVAL_SECONDS)
#         except KeyboardInterrupt:
#             print("\n🛑 Script stopped by user")
#             break
#         except Exception as e:
#             print(f"⚠️ Unexpected error: {e}")
#             time.sleep(5)  # Wait before retrying

# if __name__ == "__main__":
#     main()