import axios from 'axios';

const API_BASE = '/api';

export const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Members
export const getMembers = () => api.get('/members');
export const getMemberById = (id) => api.get(`/members/${id}`);
export const getMembersByBatch = (batch) => api.get(`/members/batch/${batch}`);

// Seats
export const getSeats = () => api.get('/seats');
export const getSeatById = (id) => api.get(`/seats/${id}`);
export const getSeatsAvailability = (date) => api.get(`/seats/availability/${date}`);

// Bookings
export const createBooking = (memberId, seatId, bookingDate) =>
    api.post('/bookings', { memberId, seatId, bookingDate });

export const getMemberBookings = (memberId) =>
    api.get(`/bookings/member/${memberId}`);

export const getBookingsByDate = (date) =>
    api.get(`/bookings/date/${date}`);

export const cancelBooking = (bookingId) =>
    api.delete(`/bookings/${bookingId}`);

// Analytics
export const getMemberStats = (memberId) =>
    api.get(`/analytics/member/${memberId}`);

export const getUtilization = (startDate, endDate) =>
    api.get(`/analytics/utilization?startDate=${startDate}&endDate=${endDate}`);

export const getBatchOccupancy = (date) =>
    api.get(`/analytics/batch/${date}`);

// Holidays
export const getHolidays = () => api.get('/holidays');
export const addHoliday = (date, name) =>
    api.post('/holidays', { date, name });

// Blocked seats
export const blockSeat = (seatId, blockDate, reason) =>
    api.post('/blocked-seats', { seatId, blockDate, reason });

export const getBlockedSeats = (date) =>
    api.get(`/blocked-seats/${date}`);
