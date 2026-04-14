import React, { useState, useEffect } from 'react';
import {
  getSeatsAvailability,
  createBooking,
  getMemberBookings,
  getHolidays
} from '../services/api';
import '../styles/BookingCalendar.css';

export function BookingCalendar({ member, onBookingSuccess }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [seatsAvailability, setSeatsAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, [currentDate, member]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const [availRes, bookRes, holRes] = await Promise.all([
        getSeatsAvailability(dateStr),
        getMemberBookings(member.id),
        getHolidays()
      ]);

      setSeatsAvailability(availRes.data);
      setBookings(bookRes.data);
      setHolidays(holRes.data);
    } catch (error) {
      setMessage('Error fetching data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSeat = async (seatId) => {
    try {
      setLoading(true);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      await createBooking(member.id, seatId, dateStr);
      setMessage('Booking successful!');
      setSelectedSeat(null);
      fetchData();
      onBookingSuccess?.();
    } catch (error) {
      setMessage('Booking failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isDateHoliday = (dateStr) => {
    return holidays.some(h => h.date === dateStr);
  };

  const canBookAnyMember = !isWeekend(currentDate) && !isDateHoliday(currentDate.toISOString().split('T')[0]);

  const dateStr = currentDate.toISOString().split('T')[0];
  const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))}>
          ← Previous
        </button>
        <h2>{dateStr} ({dayName})</h2>
        <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))}>
          Next →
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('failed') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {isWeekend(currentDate) && (
        <div className="warning">
          ⚠️ Weekends are not available for booking
        </div>
      )}

      {isDateHoliday(dateStr) && (
        <div className="warning">
          ⚠️ This is a holiday - no bookings available
        </div>
      )}

      {canBookAnyMember ? (
        <div className="seats-grid">
          {seatsAvailability.map(seat => {
            const isBooked = bookings.some(b => b.seatId === seat.id && b.bookingDate === dateStr);
            const isAvailable = seat.isAvailable && !isBooked;
            const statusText = isBooked ? 'Booked' : isAvailable ? 'Available' : 'Unavailable';
            
            return (
              <div
                key={seat.id}
                className={`seat-card ${isAvailable ? 'available' : 'booked'} ${seat.isFloater ? 'floater' : ''}`}
                onClick={() => isAvailable && setSelectedSeat(seat)}
              >
                <div className="seat-number">{seat.seatNumber}</div>
                <div className="seat-status">{statusText}</div>
                {seat.isFloater === 1 && <div className="floater-badge">Floater</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="info">
          Booking not available for this date
        </div>
      )}

      {selectedSeat && (
        <div className="booking-modal-overlay" onClick={() => setSelectedSeat(null)}>
          <div className="booking-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Booking</h3>
            <p>Seat: {selectedSeat.seatNumber}</p>
            <p>Date: {dateStr}</p>
            <div className="modal-actions">
              <button onClick={() => handleBookSeat(selectedSeat.id)} disabled={loading}>
                Confirm Booking
              </button>
              <button onClick={() => setSelectedSeat(null)} className="secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
