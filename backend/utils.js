const { db } = require('./db');

/**
 * Get week details from a date
 * Returns: { weekNumber, year, isWeek1: boolean }
 */
function getWeekDetails(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const pastDaysOfYear = (d - firstDay) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
    const twoWeekCycle = Math.ceil(weekNumber / 2);
    return {
        weekNumber,
        year,
        isWeek1: twoWeekCycle % 2 === 1,
        cycle: twoWeekCycle
    };
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(date) {
    return new Date(date).getDay();
}

/**
 * Check if date is a weekend
 */
function isWeekend(date) {
    const day = getDayOfWeek(date);
    return day === 0 || day === 6;
}

/**
 * Check if date is a holiday
 */
function isHoliday(date) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM holidays WHERE date = ?');
    const result = stmt.get(date);
    return result.count > 0;
}

/**
 * Check if a member can book on a specific date
 */
function canMemberBookOnDate(memberId, bookingDate) {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) return { allowed: false, reason: 'Member not found' };

    // Check if weekend
    if (isWeekend(bookingDate)) {
        return { allowed: false, reason: 'Cannot book on weekends' };
    }

    // Check if holiday
    if (isHoliday(bookingDate)) {
        return { allowed: false, reason: 'Cannot book on holidays' };
    }

    // Check booking eligibility based on batch and week
    const weekDetails = getWeekDetails(bookingDate);
    const batch = member.batch;
    const allowedSlots = getAllowedBookingSlotsForBatch(batch);

    let canBook = false;

    if (batch === 1) {
        // Batch 1: Mon-Wed on Week 1, Thu-Fri on Week 2
        const dayOfWeek = getDayOfWeek(bookingDate);
        if (weekDetails.isWeek1) {
            // Mon (1), Tue (2), Wed (3)
            canBook = dayOfWeek >= 1 && dayOfWeek <= 3;
        } else {
            // Thu (4), Fri (5)
            canBook = dayOfWeek >= 4 && dayOfWeek <= 5;
        }
    } else if (batch === 2) {
        // Batch 2: Thu-Fri on Week 1, Mon-Fri on Week 2
        const dayOfWeek = getDayOfWeek(bookingDate);
        if (weekDetails.isWeek1) {
            // Thu (4), Fri (5)
            canBook = dayOfWeek >= 4 && dayOfWeek <= 5;
        } else {
            // Mon (1) - Fri (5)
            canBook = dayOfWeek >= 1 && dayOfWeek <= 5;
        }
    }

    if (!canBook) {
        return {
            allowed: false,
            reason: `Your batch cannot book on this date/day`,
            batch,
            weekDetails
        };
    }

    // Check if member has already booked for this date
    const existing = db.prepare(
        'SELECT * FROM bookings WHERE memberId = ? AND bookingDate = ? AND status = ?'
    ).get(memberId, bookingDate, 'confirmed');

    if (existing) {
        return { allowed: false, reason: 'Already booked for this date' };
    }

    return { allowed: true };
}

/**
 * Check if a seat is available for a specific date
 */
function isSeatAvailable(seatId, bookingDate) {
    const seat = db.prepare('SELECT * FROM seats WHERE id = ?').get(seatId);
    if (!seat) return false;

    // Check if seat is blocked on this date
    const blocked = db.prepare(
        'SELECT COUNT(*) as count FROM blockedSeats WHERE seatId = ? AND blockDate = ?'
    ).get(seatId, bookingDate);

    if (blocked.count > 0) return false;

    // Check if seat is booked on this date
    const booked = db.prepare(
        'SELECT COUNT(*) as count FROM bookings WHERE seatId = ? AND bookingDate = ? AND status = ?'
    ).get(seatId, bookingDate, 'confirmed');

    return booked.count === 0;
}

/**
 * Check if member can book a specific seat on a date
 */
function canMemberBookSeat(memberId, seatId, bookingDate) {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    const seat = db.prepare('SELECT * FROM seats WHERE id = ?').get(seatId);

    if (!member || !seat) {
        return { allowed: false, reason: 'Invalid member or seat' };
    }

    // Check if seat is available
    if (!isSeatAvailable(seatId, bookingDate)) {
        return { allowed: false, reason: 'Seat is not available' };
    }

    // If seat is dedicated (not a floater)
    if (!seat.isFloater) {
        // Check if it's the member's squad
        if (seat.designatedBatch === member.batch && seat.designatedSquad === member.squad) {
            return { allowed: true };
        }

        // Check if it's the member's designated day (can book other squads' seats)
        const canMemberUseFloater = canUseFloaterSeats(memberId, bookingDate);
        if (canMemberUseFloater.allowed) {
            // Can only use floater seats if their designated seat is not available
            // For now, allow same batch members to use other squad seats
            if (seat.designatedBatch === member.batch) {
                return { allowed: true };
            }
        }
        return { allowed: false, reason: 'This seat is designated for another squad' };
    } else {
        // Floater seat - can book if not on designated slot
        const canUseFloater = canUseFloaterSeats(memberId, bookingDate);
        if (!canUseFloater.allowed) {
            return { allowed: false, reason: canUseFloater.reason };
        }
        return { allowed: true };
    }
}

/**
 * Check if member can use floater seats (i.e., not on designated booking days)
 */
function canUseFloaterSeats(memberId, bookingDate) {
    const memberCheckResult = canMemberBookOnDate(memberId, bookingDate);
    if (!memberCheckResult.allowed) {
        return { allowed: true, reason: 'Not on designated booking slot' };
    }
    return { allowed: false, reason: 'Can only use dedicated seats on designated days' };
}

/**
 * Get allowed booking slots for a batch
 */
function getAllowedBookingSlotsForBatch(batch) {
    if (batch === 1) {
        return {
            week1: [1, 2, 3], // Mon, Tue, Wed
            week2: [4, 5]      // Thu, Fri
        };
    } else if (batch === 2) {
        return {
            week1: [4, 5],     // Thu, Fri
            week2: [1, 2, 3, 4, 5] // Mon-Fri
        };
    }
    return {};
}

/**
 * Get member's booking days for a 2-week cycle
 */
function getMemberBookingDays(memberId) {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) return null;

    const batch = member.batch;
    const slots = getAllowedBookingSlotsForBatch(batch);

    return {
        batch,
        week1Days: slots.week1,
        week2Days: slots.week2,
        totalDaysIn2Weeks: slots.week1.length + slots.week2.length
    };
}

/**
 * Get member's booking count in current 2-week cycle
 */
function getMemberBookingCountInCycle(memberId, referenceDate) {
    const weekDetails = getWeekDetails(referenceDate);
    const cycleStart = getCycleStartDate(referenceDate);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + 13);

    const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM bookings 
    WHERE memberId = ? AND bookingDate >= ? AND bookingDate <= ? AND status = ?
  `);

    const result = stmt.get(
        memberId,
        cycleStart.toISOString().split('T')[0],
        cycleEnd.toISOString().split('T')[0],
        'confirmed'
    );

    return result.count;
}

/**
 * Get cycle start date (first day of the 2-week cycle)
 */
function getCycleStartDate(date) {
    const d = new Date(date);
    const weekDetails = getWeekDetails(d);
    const year = d.getFullYear();
    const firstDay = new Date(year, 0, 1);

    if (weekDetails.isWeek1) {
        // First week - go back to Monday of this week
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - (d.getDay() - 1));
        return weekStart;
    } else {
        // Second week - go back to Monday of this week, then back 7 days
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - (d.getDay() - 1) - 7);
        return weekStart;
    }
}

module.exports = {
    getWeekDetails,
    getDayOfWeek,
    isWeekend,
    isHoliday,
    canMemberBookOnDate,
    isSeatAvailable,
    canMemberBookSeat,
    canUseFloaterSeats,
    getAllowedBookingSlotsForBatch,
    getMemberBookingDays,
    getMemberBookingCountInCycle,
    getCycleStartDate
};
