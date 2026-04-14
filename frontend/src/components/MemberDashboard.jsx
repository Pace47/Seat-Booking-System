import React, { useState, useEffect } from 'react';
import { getMemberStats, cancelBooking } from '../services/api';
import '../styles/Dashboard.css';

export function MemberDashboard({ member, onRefresh }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStats();
  }, [member, onRefresh]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await getMemberStats(member.id);
      setStats(res.data);
    } catch (error) {
      setMessage('Error fetching stats: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await cancelBooking(bookingId);
      setMessage('Booking cancelled successfully');
      fetchStats();
    } catch (error) {
      setMessage('Error cancelling booking: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const getBookingDaysText = () => {
    if (!stats?.bookingDays) return '';
    const { week1Days, week2Days } = stats.bookingDays;
    const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return `Week 1: ${week1Days.map(d => dayNames[d]).join(', ')} | Week 2: ${week2Days.map(d => dayNames[d]).join(', ')}`;
  };

  return (
    <div className="dashboard">
      <div className="member-info">
        <h2>{member.name}</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Batch:</span>
            <span className="value">Batch {member.batch}</span>
          </div>
          <div className="info-item">
            <span className="label">Squad:</span>
            <span className="value">Squad {member.squad}</span>
          </div>
          <div className="info-item">
            <span className="label">Email:</span>
            <span className="value">{member.email}</span>
          </div>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {stats && (
        <>
          <div className="stats-card">
            <h3>📅 Booking Period Stats</h3>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">Bookings This Cycle</div>
                <div className="stat-value">{stats.currentCycleBookings}</div>
                <div className="stat-subtext">of {stats.requiredBookings} required</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Attendance %</div>
                <div className="stat-value">{stats.bookingPercentage}%</div>
                <div className={`progress-bar ${stats.bookingPercentage >= 100 ? 'complete' : ''}`}>
                  <div className="progress" style={{ width: `${Math.min(100, stats.bookingPercentage)}%` }}></div>
                </div>
              </div>
            </div>
            <div className="booking-days">
              <strong>Your Booking Days:</strong> {getBookingDaysText()}
            </div>
          </div>

          <div className="bookings-section">
            <h3>📍 Your Bookings (Next 30 Days)</h3>
            {stats.bookings && stats.bookings.length > 0 ? (
              <div className="bookings-table">
                <div className="table-header">
                  <div>Date</div>
                  <div>Seat</div>
                  <div>Status</div>
                  <div>Action</div>
                </div>
                {stats.bookings.filter(b => new Date(b.bookingDate) >= new Date() && 
                   (new Date(b.bookingDate) - new Date()) <= 30 * 24 * 60 * 60 * 1000
                ).map(booking => (
                  <div key={booking.id} className="table-row">
                    <div>{booking.bookingDate}</div>
                    <div>{booking.seatNumber}</div>
                    <div><span className="status-badge">{booking.status}</span></div>
                    <div>
                      <button 
                        className="cancel-btn"
                        onClick={() => handleCancelBooking(booking.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-bookings">No bookings found for the next 30 days</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
