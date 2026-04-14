import React, { useState, useEffect } from 'react';
import { getHolidays, addHoliday, getSeats, blockSeat, getBatchOccupancy } from '../services/api';
import '../styles/AdminPanel.css';

export function AdminPanel() {
  const [holidays, setHolidays] = useState([]);
  const [seats, setSeats] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [blockSeatForm, setBlockSeatForm] = useState({ seatId: '', blockDate: '', reason: '' });
  const [occupancyData, setOccupancyData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('holidays');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [holRes, seatsRes] = await Promise.all([
        getHolidays(),
        getSeats()
      ]);
      setHolidays(holRes.data);
      setSeats(seatsRes.data);
    } catch (error) {
      setMessage('Error fetching data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.name) {
      setMessage('Please fill all fields');
      return;
    }

    try {
      await addHoliday(newHoliday.date, newHoliday.name);
      setMessage('Holiday added successfully');
      setNewHoliday({ date: '', name: '' });
      fetchData();
    } catch (error) {
      setMessage('Error adding holiday: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleBlockSeat = async (e) => {
    e.preventDefault();
    if (!blockSeatForm.seatId || !blockSeatForm.blockDate) {
      setMessage('Please fill required fields');
      return;
    }

    try {
      await blockSeat(blockSeatForm.seatId, blockSeatForm.blockDate, blockSeatForm.reason);
      setMessage('Seat blocked successfully');
      setBlockSeatForm({ seatId: '', blockDate: '', reason: '' });
    } catch (error) {
      setMessage('Error blocking seat: ' + (error.response?.data?.error || error.message));
    }
  };

  const fetchOccupancy = async () => {
    try {
      const res = await getBatchOccupancy(selectedDate);
      setOccupancyData(res.data);
    } catch (error) {
      setMessage('Error fetching occupancy: ' + error.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'occupancy') {
      fetchOccupancy();
    }
  }, [selectedDate, activeTab]);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🛠️ Admin Panel</h1>
        <p>Manage bookings, holidays, and system settings</p>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="admin-tabs">
        <button 
          className={`tab ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => setActiveTab('holidays')}
        >
          📅 Holidays
        </button>
        <button 
          className={`tab ${activeTab === 'blockSeats' ? 'active' : ''}`}
          onClick={() => setActiveTab('blockSeats')}
        >
          🚫 Block Seats
        </button>
        <button 
          className={`tab ${activeTab === 'occupancy' ? 'active' : ''}`}
          onClick={() => setActiveTab('occupancy')}
        >
          📊 Occupancy
        </button>
      </div>

      {activeTab === 'holidays' && (
        <div className="admin-section">
          <div className="admin-form">
            <h2>Add Holiday</h2>
            <form onSubmit={handleAddHoliday}>
              <div className="form-group">
                <label>Date:</label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Holiday Name:</label>
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  placeholder="e.g., Diwali, Christmas"
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Add Holiday</button>
            </form>
          </div>

          <div className="holidays-list">
            <h2>Existing Holidays</h2>
            {holidays.length > 0 ? (
              <div className="holidays-table">
                <div className="table-header">
                  <div>Date</div>
                  <div>Holiday Name</div>
                </div>
                {holidays.map(holiday => (
                  <div key={holiday.id} className="table-row">
                    <div>{holiday.date}</div>
                    <div>{holiday.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No holidays configured</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'blockSeats' && (
        <div className="admin-section">
          <div className="admin-form">
            <h2>Block Seat for Maintenance</h2>
            <form onSubmit={handleBlockSeat}>
              <div className="form-group">
                <label>Seat:</label>
                <select
                  value={blockSeatForm.seatId}
                  onChange={(e) => setBlockSeatForm({ ...blockSeatForm, seatId: e.target.value })}
                  required
                >
                  <option value="">Select a seat</option>
                  {seats.map(seat => (
                    <option key={seat.id} value={seat.id}>
                      {seat.seatNumber} {seat.isFloater ? '(Floater)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Block Date:</label>
                <input
                  type="date"
                  value={blockSeatForm.blockDate}
                  onChange={(e) => setBlockSeatForm({ ...blockSeatForm, blockDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Reason:</label>
                <input
                  type="text"
                  value={blockSeatForm.reason}
                  onChange={(e) => setBlockSeatForm({ ...blockSeatForm, reason: e.target.value })}
                  placeholder="e.g., Maintenance, Repair"
                />
              </div>
              <button type="submit" className="btn-primary">Block Seat</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'occupancy' && (
        <div className="admin-section">
          <div className="occupancy-selector">
            <label>Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {occupancyData && (
            <div className="occupancy-grid">
              {occupancyData.map(batch => (
                <div key={batch.batch} className="occupancy-card">
                  <h3>Batch {batch.batch}</h3>
                  <div className="occupancy-stat">
                    <div className="stat-value">{batch.bookedMembers}/{batch.totalMembers}</div>
                    <div className="stat-label">Members Booked</div>
                  </div>
                  <div className="stat-value percentage">{batch.attendancePercentage}%</div>
                  <div className="progress-bar">
                    <div className="progress" style={{ width: `${batch.attendancePercentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
