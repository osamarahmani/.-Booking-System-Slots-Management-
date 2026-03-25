from db import get_connection

conn = get_connection()
cur = conn.cursor()

# users table
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

# slots table
cur.execute("""
CREATE TABLE IF NOT EXISTS slots (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_booked BOOLEAN DEFAULT FALSE
);
""")

# bookings table
cur.execute("""
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    slot_id INTEGER UNIQUE REFERENCES slots(id),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

conn.commit()
cur.close()
conn.close()

print("Tables created successfully")