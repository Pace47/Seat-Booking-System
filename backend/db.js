const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'bookings.db');
let sqlDb = null;
let SQL = null;

// Compatibility wrapper for sql.js to match better-sqlite3 API
class DatabaseWrapper {
    run(sql, params = []) {
        if (!sqlDb) throw new Error('Database not initialized');
        try {
            sqlDb.run(sql, params);
            saveDatabase();
        } catch (error) {
            console.error('SQL Error:', sql, params, error.message);
            throw error;
        }
    }

    exec(sql) {
        if (!sqlDb) throw new Error('Database not initialized');
        try {
            sqlDb.exec(sql);
            saveDatabase();
        } catch (error) {
            console.error('SQL Exec Error:', sql, error.message);
            throw error;
        }
    }

    prepare(sql) {
        if (!sqlDb) throw new Error('Database not initialized');
        return new StatementWrapper(sqlDb, sql);
    }

    pragma(pragma) {
        if (!sqlDb) throw new Error('Database not initialized');
        sqlDb.run(`PRAGMA ${pragma}`);
    }

    transaction(fn) {
        return () => {
            try {
                sqlDb.run('BEGIN TRANSACTION');
                fn();
                sqlDb.run('COMMIT');
                saveDatabase();
            } catch (error) {
                sqlDb.run('ROLLBACK');
                throw error;
            }
        };
    }
}

class StatementWrapper {
    constructor(database, sql) {
        this.database = database;
        this.sql = sql;
    }

    run(...params) {
        try {
            this.database.run(this.sql, params);
            saveDatabase();
        } catch (error) {
            console.error('Statement run error:', this.sql, params, error.message);
            throw error;
        }
    }

    get(...params) {
        try {
            const stmt = this.database.prepare(this.sql);
            stmt.bind(params);
            let result = null;
            if (stmt.step()) {
                result = stmt.getAsObject();
            }
            stmt.free();
            return result;
        } catch (error) {
            console.error('Statement get error:', this.sql, params, error.message);
            throw error;
        }
    }

    all(...params) {
        try {
            const stmt = this.database.prepare(this.sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (error) {
            console.error('Statement all error:', this.sql, params, error.message);
            throw error;
        }
    }
}

const db = new DatabaseWrapper();

// Save database to disk
function saveDatabase() {
    if (sqlDb) {
        try {
            const data = sqlDb.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(dbPath, buffer);
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }
}

// Initialize database
async function initializeDatabase() {
    SQL = await initSqlJs();

    // Load or create database
    if (fs.existsSync(dbPath)) {
        try {
            const data = fs.readFileSync(dbPath);
            sqlDb = new SQL.Database(data);
            console.log('✅ Database loaded from disk');
        } catch (error) {
            console.error('Error loading database, creating new:', error);
            sqlDb = new SQL.Database();
        }
    } else {
        sqlDb = new SQL.Database();
        console.log('✅ New database created');
    }

    // Create tables
    const tables = [
        `CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      batch INTEGER NOT NULL,
      squad INTEGER NOT NULL,
      designation TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
        `CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seatNumber TEXT NOT NULL UNIQUE,
      isFloater BOOLEAN DEFAULT 0,
      designatedBatch INTEGER,
      designatedSquad INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
        `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      memberId TEXT NOT NULL,
      seatId INTEGER NOT NULL,
      bookingDate DATE NOT NULL,
      status TEXT DEFAULT 'confirmed',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(memberId, bookingDate)
    )`,
        `CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      name TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
        `CREATE TABLE IF NOT EXISTS blockedSeats (
      id TEXT PRIMARY KEY,
      seatId INTEGER NOT NULL,
      blockDate DATE NOT NULL,
      reason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(seatId, blockDate)
    )`
    ];

    tables.forEach(table => {
        try {
            db.exec(table);
        } catch (error) {
            // Table already exists
        }
    });

    saveDatabase();
    console.log('✅ Database initialized successfully');
}

// Seed initial data
function seedDatabase() {
    // Check if data already exists
    const memberResult = db.prepare('SELECT COUNT(*) as count FROM members').get();
    const memberCount = memberResult?.count || 0;

    if (memberCount > 0) {
        console.log('✅ Database already seeded');
        return;
    }

    console.log('🌱 Seeding database with initial data...');

    // Create members
    let memberId = 1;
    for (let batch = 1; batch <= 2; batch++) {
        for (let squad = 1; squad <= 8; squad++) {
            for (let member = 1; member <= 5; member++) {
                const id = uuidv4();
                const name = `Employee B${batch}S${squad}M${member}`;
                const email = `emp_b${batch}_s${squad}_m${member}@company.com`;

                db.prepare(
                    'INSERT INTO members (id, name, email, batch, squad, designation) VALUES (?, ?, ?, ?, ?, ?)'
                ).run(id, name, email, batch, squad, 'Member');
                memberId++;
            }
        }
    }

    // Create seats
    let seatNum = 1;

    // Designated seats (40 seats total - distributed across batches and squads)
    let designatedCount = 0;
    for (let batch = 1; batch <= 2; batch++) {
        for (let squad = 1; squad <= 8; squad++) {
            for (let i = 1; i <= 3 && designatedCount < 40; i++) {
                db.prepare(
                    'INSERT INTO seats (seatNumber, isFloater, designatedBatch, designatedSquad) VALUES (?, ?, ?, ?)'
                ).run(`SEAT-${seatNum.toString().padStart(3, '0')}`, 0, batch, squad);
                seatNum++;
                designatedCount++;
            }
        }
    }

    // Floater seats (10 seats)
    for (let i = 1; i <= 10; i++) {
        db.prepare(
            'INSERT INTO seats (seatNumber, isFloater, designatedBatch, designatedSquad) VALUES (?, ?, ?, ?)'
        ).run(`SEAT-${seatNum.toString().padStart(3, '0')}`, 1, null, null);
        seatNum++;
    }

    // Add holidays
    const holidays = [
        { date: '2026-01-26', name: 'Republic Day' },
        { date: '2026-03-08', name: 'Maha Shivaratri' },
        { date: '2026-03-25', name: 'Holi' },
        { date: '2026-04-02', name: 'Good Friday' },
        { date: '2026-04-14', name: 'Ambedkar Jayanti' },
        { date: '2026-05-01', name: 'May Day' },
        { date: '2026-08-15', name: 'Independence Day' },
        { date: '2026-08-24', name: 'Janmashtami' },
        { date: '2026-09-16', name: 'Milad un-Nabi' },
        { date: '2026-10-02', name: 'Gandhi Jayanti' },
        { date: '2026-10-25', name: 'Diwali' },
        { date: '2026-11-01', name: 'Diwali (day 2)' },
        { date: '2026-12-25', name: 'Christmas' }
    ];

    holidays.forEach(h => {
        const id = uuidv4();
        db.prepare(
            'INSERT INTO holidays (id, date, name) VALUES (?, ?, ?)'
        ).run(id, h.date, h.name);
    });

    saveDatabase();
    console.log('✅ Database seeded with initial data');
}

module.exports = {
    db,
    initializeDatabase,
    seedDatabase
};
