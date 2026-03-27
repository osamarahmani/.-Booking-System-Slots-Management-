"""
MediBook - Complete Appointment Booking System
Backend: Flask + MongoDB + JWT Auth + Email + CSV Export
"""

from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from functools import wraps
import pytz, bcrypt, jwt, os, csv, io, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)
CORS(app, supports_credentials=True)

# ─── CONFIG ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "medibook-super-secret-2025")
SMTP_HOST  = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT  = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER  = os.environ.get("SMTP_USER", "")   # set your Gmail here
SMTP_PASS  = os.environ.get("SMTP_PASS", "")   # Gmail App Password
IST        = pytz.timezone("Asia/Kolkata")

# ─── DB ──────────────────────────────────────────────────────────────────────
client       = MongoClient(os.environ.get("MONGO_URI", "mongodb://localhost:27017/"))
db           = client.medibook
users_col    = db.users
slots_col    = db.slots
bookings_col = db.bookings

users_col.create_index([("email", ASCENDING)], unique=True)
slots_col.create_index([("date", ASCENDING), ("start_time", ASCENDING)])
bookings_col.create_index([("slot_id", ASCENDING)])
bookings_col.create_index([("user_id", ASCENDING)])

# ─── HELPERS ─────────────────────────────────────────────────────────────────
def now_ist():
    return datetime.now(IST).isoformat()

def serialize(doc):
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

def send_email(to_email, subject, body_html):
    if not SMTP_USER or not SMTP_PASS:
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_USER
        msg["To"]      = to_email
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
    except Exception as e:
        print(f"[Email Error] {e}")

def booking_email_html(b, action="confirmed"):
    colors = {"confirmed": "#10b981", "cancelled": "#ef4444", "rescheduled": "#f59e0b"}
    c = colors.get(action, "#4f46e5")
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:{c};padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0">🏥 MediBook</h1>
        <p style="color:#fff;margin:6px 0 0">Appointment {action.capitalize()}</p>
      </div>
      <div style="padding:28px">
        <p>Dear <b>{b.get('name','Patient')}</b>,</p>
        <p>Your appointment has been <b>{action}</b>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280">Doctor</td><td style="padding:8px;font-weight:600">{b.get('doctor','General')}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px;font-weight:600">{b.get('date','—')}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Time</td><td style="padding:8px;font-weight:600">{b.get('start_time','')}–{b.get('end_time','')}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Reason</td><td style="padding:8px">{b.get('reason','—')}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px">Please arrive 10 minutes early. Thank you for using MediBook.</p>
      </div>
    </div>"""

# ─── AUTH DECORATORS ─────────────────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = data
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if data.get("role") != "admin":
                return jsonify({"error": "Admin access required"}), 403
            request.user = data
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

# ══════════════════════════════════════════════════════════════════════════════
#  AUTH
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/auth/register", methods=["POST"])
def register():
    data  = request.json or {}
    name  = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    pwd   = data.get("password", "").strip()
    role  = data.get("role", "user")

    if not name or not email or not pwd:
        return jsonify({"error": "Name, email and password required"}), 400
    if len(pwd) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if users_col.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    hashed = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
    user   = {"name": name, "email": email, "password": hashed,
              "role": role, "created_at": now_ist()}
    result = users_col.insert_one(user)
    uid    = str(result.inserted_id)

    token = jwt.encode({
        "user_id": uid, "email": email, "role": role, "name": name,
        "exp": datetime.utcnow() + timedelta(days=7)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({"message": "Registered!", "token": token,
                    "user": {"id": uid, "name": name, "email": email, "role": role}}), 201


@app.route("/auth/login", methods=["POST"])
def login():
    data  = request.json or {}
    email = data.get("email", "").strip().lower()
    pwd   = data.get("password", "").strip()

    user = users_col.find_one({"email": email})
    if not user or not bcrypt.checkpw(pwd.encode(), user["password"].encode()):
        return jsonify({"error": "Invalid email or password"}), 401

    token = jwt.encode({
        "user_id": str(user["_id"]), "email": email,
        "role": user["role"], "name": user["name"],
        "exp": datetime.utcnow() + timedelta(days=7)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({"message": "Login successful!", "token": token,
                    "user": {"id": str(user["_id"]), "name": user["name"],
                             "email": email, "role": user["role"]}})


@app.route("/auth/me", methods=["GET"])
@token_required
def me():
    return jsonify(request.user)

# ══════════════════════════════════════════════════════════════════════════════
#  USERS  (Admin)
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/users", methods=["GET"])
@admin_required
def get_users():
    users = [serialize(u) for u in users_col.find({}, {"password": 0})]
    return jsonify(users)

# ══════════════════════════════════════════════════════════════════════════════
#  SLOTS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/slots", methods=["GET"])
def get_slots():
    query  = {}
    date   = request.args.get("date")
    doctor = request.args.get("doctor")
    avail  = request.args.get("available_only")
    if date:            query["date"]      = date
    if doctor:          query["doctor"]    = {"$regex": doctor, "$options": "i"}
    if avail == "true": query["is_booked"] = False
    slots = [serialize(s) for s in slots_col.find(query).sort([("date", 1), ("start_time", 1)])]
    return jsonify(slots)


@app.route("/slots", methods=["POST"])
@admin_required
def add_slot():
    data = request.json or {}
    start_time = data.get("start_time", "").strip()
    end_time   = data.get("end_time", "").strip()
    date       = data.get("date", "").strip()
    doctor     = data.get("doctor", "General").strip()
    if not start_time or not end_time or not date:
        return jsonify({"error": "start_time, end_time and date required"}), 400
    slot = {"start_time": start_time, "end_time": end_time,
            "date": date, "doctor": doctor, "is_booked": False, "created_at": now_ist()}
    result = slots_col.insert_one(slot)
    slot["_id"] = str(result.inserted_id)
    return jsonify({"message": "Slot added!", "slot": slot}), 201


@app.route("/slots/bulk", methods=["POST"])
@admin_required
def add_recurring_slots():
    """Create recurring daily slots across a date range."""
    data          = request.json or {}
    doctor        = data.get("doctor", "General").strip()
    times         = data.get("times", [])          # [{start_time, end_time}]
    from_date_str = data.get("from_date", "")
    to_date_str   = data.get("to_date", "")
    skip_weekends = data.get("skip_weekends", False)

    if not times or not from_date_str or not to_date_str:
        return jsonify({"error": "times, from_date, to_date required"}), 400
    try:
        from_date = datetime.strptime(from_date_str, "%Y-%m-%d").date()
        to_date   = datetime.strptime(to_date_str,   "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Dates must be YYYY-MM-DD"}), 400

    new_slots, current = [], from_date
    while current <= to_date:
        if skip_weekends and current.weekday() >= 5:
            current += timedelta(days=1); continue
        for t in times:
            new_slots.append({
                "start_time": t["start_time"], "end_time": t["end_time"],
                "date": str(current), "doctor": doctor,
                "is_booked": False, "created_at": now_ist()
            })
        current += timedelta(days=1)

    if new_slots:
        slots_col.insert_many(new_slots)
    return jsonify({"message": f"{len(new_slots)} slots created!", "count": len(new_slots)}), 201


@app.route("/slots/<slot_id>", methods=["DELETE"])
@admin_required
def delete_slot(slot_id):
    slot = slots_col.find_one({"_id": ObjectId(slot_id)})
    if not slot:
        return jsonify({"error": "Slot not found"}), 404
    if slot.get("is_booked"):
        return jsonify({"error": "Cannot delete a booked slot"}), 400
    slots_col.delete_one({"_id": ObjectId(slot_id)})
    return jsonify({"message": "Slot deleted!"})


@app.route("/doctors", methods=["GET"])
def get_doctors():
    return jsonify(slots_col.distinct("doctor"))

# ══════════════════════════════════════════════════════════════════════════════
#  BOOKINGS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/book/<slot_id>", methods=["POST"])
@token_required
def book_slot(slot_id):
    data   = request.json or {}
    reason = data.get("reason", "").strip()
    user   = request.user

    result = slots_col.find_one_and_update(
        {"_id": ObjectId(slot_id), "is_booked": False},
        {"$set": {"is_booked": True, "booked_by": user["name"]}}
    )
    if not result:
        return jsonify({"error": "Slot already taken or not found!"}), 400

    booking = {
        "slot_id": slot_id, "user_id": user["user_id"],
        "name": user["name"], "email": user["email"],
        "reason": reason, "status": "confirmed",
        "booked_at": now_ist(),
        "doctor":     result.get("doctor", "General"),
        "date":       result.get("date", ""),
        "start_time": result["start_time"],
        "end_time":   result["end_time"],
    }
    ins = bookings_col.insert_one(booking)
    booking["_id"] = str(ins.inserted_id)
    send_email(user["email"], "✅ Appointment Confirmed — MediBook",
               booking_email_html(booking, "confirmed"))
    return jsonify({"message": "Appointment booked! 🎉", "booking": booking}), 201


@app.route("/bookings", methods=["GET"])
@admin_required
def get_bookings():
    query  = {}
    search = request.args.get("search", "").strip()
    status = request.args.get("status")
    date   = request.args.get("date")
    doctor = request.args.get("doctor")
    if search: query["$or"] = [{"name": {"$regex": search, "$options": "i"}},
                                {"email": {"$regex": search, "$options": "i"}}]
    if status: query["status"] = status
    if date:   query["date"]   = date
    if doctor: query["doctor"] = {"$regex": doctor, "$options": "i"}
    bookings = [serialize(b) for b in bookings_col.find(query).sort("booked_at", -1)]
    return jsonify(bookings)


@app.route("/bookings/mine", methods=["GET"])
@token_required
def my_bookings():
    bookings = [serialize(b) for b in
                bookings_col.find({"user_id": request.user["user_id"]}).sort("booked_at", -1)]
    return jsonify(bookings)


@app.route("/bookings/<booking_id>/cancel", methods=["POST"])
@token_required
def cancel_booking(booking_id):
    booking = bookings_col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if request.user["role"] != "admin" and booking["user_id"] != request.user["user_id"]:
        return jsonify({"error": "Not authorized"}), 403
    if booking["status"] == "cancelled":
        return jsonify({"error": "Already cancelled"}), 400

    slots_col.update_one({"_id": ObjectId(booking["slot_id"])},
                         {"$set": {"is_booked": False, "booked_by": None}})
    bookings_col.update_one({"_id": ObjectId(booking_id)},
                            {"$set": {"status": "cancelled", "cancelled_at": now_ist()}})
    booking["status"] = "cancelled"
    send_email(booking["email"], "❌ Appointment Cancelled — MediBook",
               booking_email_html(booking, "cancelled"))
    return jsonify({"message": "Booking cancelled."})


@app.route("/bookings/<booking_id>/reschedule", methods=["POST"])
@token_required
def reschedule_booking(booking_id):
    data        = request.json or {}
    new_slot_id = data.get("new_slot_id", "").strip()
    if not new_slot_id:
        return jsonify({"error": "new_slot_id required"}), 400

    booking = bookings_col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if request.user["role"] != "admin" and booking["user_id"] != request.user["user_id"]:
        return jsonify({"error": "Not authorized"}), 403
    if booking["status"] == "cancelled":
        return jsonify({"error": "Cannot reschedule a cancelled booking"}), 400

    new_slot = slots_col.find_one_and_update(
        {"_id": ObjectId(new_slot_id), "is_booked": False},
        {"$set": {"is_booked": True, "booked_by": booking["name"]}}
    )
    if not new_slot:
        return jsonify({"error": "New slot not available"}), 400

    slots_col.update_one({"_id": ObjectId(booking["slot_id"])},
                         {"$set": {"is_booked": False, "booked_by": None}})
    updated = {
        "slot_id": new_slot_id, "status": "rescheduled",
        "rescheduled_at": now_ist(),
        "start_time": new_slot["start_time"], "end_time": new_slot["end_time"],
        "date": new_slot.get("date", ""), "doctor": new_slot.get("doctor", "General"),
    }
    bookings_col.update_one({"_id": ObjectId(booking_id)}, {"$set": updated})
    booking.update(updated)
    send_email(booking["email"], "📅 Appointment Rescheduled — MediBook",
               booking_email_html(booking, "rescheduled"))
    return jsonify({"message": "Appointment rescheduled! 📅"})

# ══════════════════════════════════════════════════════════════════════════════
#  EXPORT & STATS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/export/bookings", methods=["GET"])
@admin_required
def export_bookings_csv():
    bookings = list(bookings_col.find().sort("booked_at", -1))
    output   = io.StringIO()
    writer   = csv.writer(output)
    writer.writerow(["ID","Patient","Email","Doctor","Date","Start","End","Reason","Status","Booked At"])
    for b in bookings:
        writer.writerow([str(b["_id"]), b.get("name",""), b.get("email",""),
                         b.get("doctor",""), b.get("date",""),
                         b.get("start_time",""), b.get("end_time",""),
                         b.get("reason",""), b.get("status",""), b.get("booked_at","")])
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=bookings.csv"
    response.headers["Content-Type"] = "text/csv"
    return response


@app.route("/stats", methods=["GET"])
@admin_required
def get_stats():
    total_slots  = slots_col.count_documents({})
    booked_slots = slots_col.count_documents({"is_booked": True})
    pipeline     = [{"$group": {"_id": "$doctor", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    by_doctor    = [{"doctor": r["_id"], "count": r["count"]} for r in bookings_col.aggregate(pipeline)]
    return jsonify({
        "total_slots":     total_slots,
        "available_slots": total_slots - booked_slots,
        "booked_slots":    booked_slots,
        "total_bookings":  bookings_col.count_documents({}),
        "cancelled":       bookings_col.count_documents({"status": "cancelled"}),
        "rescheduled":     bookings_col.count_documents({"status": "rescheduled"}),
        "total_users":     users_col.count_documents({"role": "user"}),
        "by_doctor":       by_doctor,
    })


if __name__ == "__main__":
    app.run(debug=True , port=5000)