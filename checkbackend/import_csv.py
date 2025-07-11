# import psycopg2
# import csv
# import json

# conn = psycopg2.connect(
#     dbname="machine_csv",
#     user="postgres",
#     password="@Abhi1432",
#     host="localhost",
#     port="5432"
# )
# cur = conn.cursor()

# with open(r"C:\Users\USER\Downloads\data.csv", 'r', encoding='utf-8') as f:
#     reader = csv.DictReader(f)
#     for i, row in enumerate(reader):
#         try:
#             # Safely handle NULLs and JSON parsing
#             gfrid = int(row["GFRID"]) if row["GFRID"] != "NULL" else None
#             alertNotify_id = int(row["alertNotify_id"]) if row["alertNotify_id"] != "NULL" else None
#             ts_off_bigint = int(row["TS_OFF_BigInt"]) if row["TS_OFF_BigInt"] != "NULL" else None

#             json_value = row["jsonFile"]
#             if isinstance(json_value, str):
#                 try:
#                     json_value = json.loads(json_value)
#                 except Exception as e:
#                     print(f"⚠️ JSON parsing error in row {i+1}: {e}")
#                     continue
#             json_str = json.dumps(json_value)  # Convert to string
#             cur.execute("""
#                     INSERT INTO checkapp_machineevent (
#                         alert, status, "GFRID", "TS", "TS_OFF",
#                         "TS_BigInt", "TS_OFF_BigInt", "jsonFile", "last_modified", "alertNotify_id"
#                     ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
#                 """, (
#                     row["alert"],
#                     int(row["status"]),
#                     gfrid,
#                     row["TS"],
#                     None if row["TS_OFF"] in ("NULL", "", None) else row["TS_OFF"],
#                     int(row["TS_BigInt"]),
#                     ts_off_bigint,
#                     json_str,
#                     row["last_modified"],
#                     alertNotify_id,
#                 ))




#         except Exception as e:
#             conn.rollback()  # 🔥 this is the fix
#             print(f"❌ Row {i+1} skipped due to error: {e}")
#         else:
#             conn.commit()  # ✅ only commit if no error

# cur.close()
# conn.close()

# print("✅ Safe import finished.")



import psycopg2
import csv
import json

# Connect to PostgreSQL
conn = psycopg2.connect(
    dbname="machine_csv",
    user="postgres",
    password="@Abhi1432",
    host="localhost",
    port="5432"
)
cur = conn.cursor()

# Path to your updated CSV file
file_path = r"C:\Users\USER\Downloads\updated_machine_data_sorted_by_id.csv"

with open(file_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        try:
            # Handle GFRID and alertNotify_id
            gfrid = int(row["GFRID"]) if row["GFRID"] not in ("NULL", "", None) else None
            alertNotify_id = int(row["alertNotify_id"]) if row["alertNotify_id"] not in ("NULL", "", None) else None

            # Handle TS_BigInt and TS_OFF_BigInt with float fallback
            ts_bigint = int(float(row["TS_BigInt"])) if row["TS_BigInt"] not in ("NULL", "", None) else None
            ts_off_bigint = int(float(row["TS_OFF_BigInt"])) if row["TS_OFF_BigInt"] not in ("NULL", "", None) else None

            # Parse JSON safely
            json_value = row["jsonFile"]
            if isinstance(json_value, str):
                try:
                    json_value = json.loads(json_value)
                except Exception as e:
                    print(f"⚠️ JSON parsing error in row {i+1}: {e}")
                    continue
            json_str = json.dumps(json_value)

            # Insert into database
            cur.execute("""
                INSERT INTO checkapp_machineevent (
                    alert, status, "GFRID", "TS", "TS_OFF",
                    "TS_BigInt", "TS_OFF_BigInt", "jsonFile", "last_modified", "alertNotify_id"
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """, (
                row["alert"],
                int(row["status"]),
                gfrid,
                row["TS"],
                None if row["TS_OFF"] in ("NULL", "", None) else row["TS_OFF"],
                ts_bigint,
                ts_off_bigint,
                json_str,
                row["last_modified"],
                alertNotify_id,
            ))

        except Exception as e:
            conn.rollback()  # Roll back the transaction for this row only
            print(f"❌ Row {i+1} skipped due to error: {e}")
        else:
            conn.commit()  # Commit only if successful

# Clean up
cur.close()
conn.close()
print("✅ Safe import finished.")
