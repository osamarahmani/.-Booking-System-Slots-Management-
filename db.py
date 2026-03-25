import psycopg2

def get_connection():
    conn = psycopg2.connect(
        database="appointment_db",
        user="postgres",
        password="Srisam@1005",  # change this
        host="localhost",
        port="5432"
    )
    return conn