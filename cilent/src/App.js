import { useEffect, useState } from "react";

function App() {
  const [slots, setSlots] = useState([]);

  // 👇 INGA dhaan podanum
  useEffect(() => {
    fetch("http://127.0.0.1:5000/slots")
      .then((res) => res.json())
      .then((data) => setSlots(data))
      .catch((err) => console.log(err));
  }, []);

  // 👇 UI part
  return (
    <div>
      <h1>Slot Booking System 🔥</h1>

      <h2>Available Slots</h2>

      {slots.length === 0 ? (
        <p>No slots available</p>
      ) : (
        slots.map((slot) => (
          <div key={slot.id}>
            <p>{slot.start_time} - {slot.end_time}</p>
            <button>Book</button>
          </div>
        ))
      )}
    </div>
  );
}

export default App;