const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const {
    canMemberBookOnDate,
    isSeatAvailable,
    canMemberBookSeat,
    getMemberBookingDays,
    getMemberBookingCountInCycle,
    getWeekDetails,
    isWeekend,
    isHoliday
} = require('../utils');

// ========== MEMBERS ==========

// Get all members
router.get('/members', (req, res) => {
    try {
        const members = db.prepare('SELECT * FROM members ORDER BY batch, squad, id').all();
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get member by ID
router.get('/members/:id', (req, res) => {
    try {
        const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json(member);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get members by batch
router.get('/members/batch/:batch', (req, res) => {
    try {
        const batch = parseInt(req.params.batch);
        const members = db.prepare('SELECT * FROM members WHERE batch = ? ORDER BY squad, id').all(batch);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== SEATS ==========

// Get all seats
router.get('/seats', (req, res) => {
    try {
        const seats = db.prepare('SELECT * FROM seats ORDER BY id').all();
        res.json(seats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get seat by ID
router.get('/seats/:id', (req, res) => {
    try {
        const seat = db.prepare('SELECT * FROM seats WHERE id = ?').get(req.params.id);
        if (!seat) {
            return res.status(404).json({ error: 'Seat not found' });
        }
        res.json(seat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get seats availability for a specific date
router.get('/seats/availability/:date', (req, res) => {
    try {
        const date = req.params.date;
        const seats = db.prepare('SELECT * FROM seats ORDER BY id').all();

        const seatsWithAvailability = seats.map(seat => {
            const isAvailable = isSeatAvailable(seat.id, date);
            return {
                ...seat,
                isAvailable
            };
        });

        res.json(seatsWithAvailability);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== BOOKINGS ==========

// Create a booking
router.post('/bookings', (req, res) => {
    try {
        const { memberId, seatId, bookingDate } = req.body;

        if (!memberId || !seatId || !bookingDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if member can book on this date
        const canBook = canMemberBookOnDate(memberId, bookingDate);
        if (!canBook.allowed) {
            return res.status(400).json({ error: canBook.reason });
        }

        // Check if member can book this specific seat
        const canBookSeat = canMemberBookSeat(memberId, seatId, bookingDate);
        if (!canBookSeat.allowed) {
            return res.status(400).json({ error: canBookSeat.reason });
        }

        // Check if seat is available
        if (!isSeatAvailable(seatId, bookingDate)) {
            return res.status(400).json({ error: 'Seat is not available' });
        }

        const id = uuidv4();
        db.prepare(`
      INSERT INTO bookings (id, memberId, seatId, bookingDate, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, memberId, seatId, bookingDate, 'confirmed');

        res.status(201).json({
            id,
            memberId,
            seatId,
            bookingDate,
            status: 'confirmed'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all bookings for a member
router.get('/bookings/member/:memberId', (req, res) => {
    try {
        const memberId = req.params.memberId;
        const bookings = db.prepare(`
      SELECT b.*, s.seatNumber, m.name, m.batch, m.squad
      FROM bookings b
      JOIN seats s ON b.seatId = s.id
      JOIN members m ON b.memberId = m.id
      WHERE b.memberId = ?
      ORDER BY b.bookingDate DESC
    `).all(memberId);

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get bookings for a specific date
router.get('/bookings/date/:date', (req, res) => {
    try {
        const date = req.params.date;
        const bookings = db.prepare(`
      SELECT b.*, s.seatNumber, m.name, m.batch, m.squad
      FROM bookings b
      JOIN seats s ON b.seatId = s.id
      JOIN members m ON b.memberId = m.id
      WHERE b.bookingDate = ? AND b.status = ?
      ORDER BY s.id
    `).all(date, 'confirmed');

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel a booking
router.delete('/bookings/:bookingId', (req, res) => {
    try {
        const bookingId = req.params.bookingId;

        const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Can only cancel future bookings (can cancel today if it's still morning, but for simplicity, allow all)
        const today = new Date().toISOString().split('T')[0];
        if (booking.bookingDate < today) {
            return res.status(400).json({ error: 'Cannot cancel past bookings' });
        }

        db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', bookingId);

        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ANALYTICS ==========

// Get member's booking stats
router.get('/analytics/member/:memberId', (req, res) => {
    try {
        const memberId = req.params.memberId;
        const today = new Date().toISOString().split('T')[0];
        const weekDetails = getWeekDetails(today);

        const bookingDays = getMemberBookingDays(memberId);
        const bookingCount = getMemberBookingCountInCycle(memberId, today);
        const bookings = db.prepare(`
      SELECT b.*, s.seatNumber
      FROM bookings b
      JOIN seats s ON b.seatId = s.id
      WHERE b.memberId = ? AND b.status = ?
      ORDER BY b.bookingDate DESC
    `).all(memberId, 'confirmed');

        res.json({
            bookingDays,
            currentCycleBookings: bookingCount,
            requiredBookings: bookingDays.totalDaysIn2Weeks,
            bookings,
            bookingPercentage: (bookingCount / bookingDays.totalDaysIn2Weeks * 100).toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get seat utilization for a date range
router.get('/analytics/utilization', (req, res) => {
    try {
        const startDate = req.query.startDate || '2026-01-01';
        const endDate = req.query.endDate || '2026-12-31';

        const bookings = db.prepare(`
      SELECT COUNT(DISTINCT b.seatId) as occupiedSeats, b.bookingDate
      FROM bookings b
      WHERE b.bookingDate >= ? AND b.bookingDate <= ? AND b.status = ?
      GROUP BY b.bookingDate
      ORDER BY b.bookingDate
    `).all(startDate, endDate, 'confirmed');

        const totalSeats = db.prepare('SELECT COUNT(*) as count FROM seats').get().count;

        const utilizationData = bookings.map(b => ({
            date: b.bookingDate,
            occupiedSeats: b.occupiedSeats,
            totalSeats,
            utilizationPercentage: (b.occupiedSeats / totalSeats * 100).toFixed(2)
        }));

        res.json(utilizationData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get batch occupancy for a date
router.get('/analytics/batch/:date', (req, res) => {
    try {
        const date = req.params.date;

        const batchAnalytics = db.prepare(`
      SELECT m.batch, COUNT(DISTINCT m.id) as totalMembers
      FROM members m
      GROUP BY m.batch
    `).all();

        const batchBookings = db.prepare(`
      SELECT m.batch, COUNT(DISTINCT b.memberId) as bookedMembers
      FROM bookings b
      JOIN members m ON b.memberId = m.id
      WHERE b.bookingDate = ? AND b.status = ?
      GROUP BY m.batch
    `).all(date, 'confirmed');

        const result = batchAnalytics.map(batch => {
            const bookings = batchBookings.find(b => b.batch === batch.batch);
            const bookedMembers = bookings?.bookedMembers || 0;
            return {
                batch: batch.batch,
                totalMembers: batch.totalMembers,
                bookedMembers,
                attendancePercentage: (bookedMembers / batch.totalMembers * 100).toFixed(2)
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== HOLIDAYS ==========

// Get all holidays
router.get('/holidays', (req, res) => {
    try {
        const holidays = db.prepare('SELECT * FROM holidays ORDER BY date').all();
        res.json(holidays);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add holiday
router.post('/holidays', (req, res) => {
    try {
        const { date, name } = req.body;
        if (!date || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = uuidv4();
        db.prepare('INSERT INTO holidays (id, date, name) VALUES (?, ?, ?)').run(id, date, name);

        res.status(201).json({ id, date, name });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Holiday already exists for this date' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// ========== SEAT BLOCKING ==========

// Block a seat for a date
router.post('/blocked-seats', (req, res) => {
    try {
        const { seatId, blockDate, reason } = req.body;
        if (!seatId || !blockDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = uuidv4();
        db.prepare(`
      INSERT INTO blockedSeats (id, seatId, blockDate, reason)
      VALUES (?, ?, ?, ?)
    `).run(id, seatId, blockDate, reason || 'Maintenance');

        res.status(201).json({ id, seatId, blockDate, reason });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Seat is already blocked for this date' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Get blocked seats for a date
router.get('/blocked-seats/:date', (req, res) => {
    try {
        const date = req.params.date;
        const blockedSeats = db.prepare(`
      SELECT bs.*, s.seatNumber
      FROM blockedSeats bs
      JOIN seats s ON bs.seatId = s.id
      WHERE bs.blockDate = ?
    `).all(date);

        res.json(blockedSeats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
