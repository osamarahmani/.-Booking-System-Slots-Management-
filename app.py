from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/slots", methods=["GET"])
def get_slots():
    return jsonify([
        {
            "id": 1,
            "start_time": "10:00 AM",
            "end_time": "11:00 AM"
        },
        {
            "id": 2,
            "start_time": "11:00 AM",
            "end_time": "12:00 PM"
        }
    ])

if __name__ == "__main__":
    app.run(debug=True)