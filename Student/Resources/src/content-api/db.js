'use strict';

const { Pool } = require('pg');
const sessionsData = require('./sessions');
const speakersData = require('./speakers');

let pool = null;

async function init() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.log('DATABASE_URL not set — using local JSON data');
    return false;
  }

  // Expected format: postgresql://user:password@host:5432/dbname?sslmode=require
  // For Azure Database for PostgreSQL, always include ?sslmode=require
  pool = new Pool({
    connectionString: connStr,
    connectionTimeoutMillis: 5000
  });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('Failed to connect to PostgreSQL:', err.message);
    console.error('Check DATABASE_URL and ensure the server is reachable and SSL is configured correctly');
    await pool.end().catch(() => {});
    pool = null;
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id   SERIAL PRIMARY KEY,
      data JSONB  NOT NULL
    );
    CREATE TABLE IF NOT EXISTS speakers (
      id   SERIAL PRIMARY KEY,
      data JSONB  NOT NULL
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM sessions');
  if (parseInt(rows[0].count, 10) === 0) {
    console.log('Seeding database...');
    for (const session of sessionsData) {
      await pool.query('INSERT INTO sessions (data) VALUES ($1)', [session]);
    }
    for (const speaker of speakersData) {
      await pool.query('INSERT INTO speakers (data) VALUES ($1)', [speaker]);
    }
    console.log(`Seeded ${sessionsData.length} sessions and ${speakersData.length} speakers`);
  } else {
    console.log('Database already seeded — skipping');
  }

  return true;
}

async function getSessions() {
  const { rows } = await pool.query('SELECT data FROM sessions ORDER BY id');
  return rows.map(r => r.data);
}

async function getSpeakers() {
  const { rows } = await pool.query('SELECT data FROM speakers ORDER BY id');
  return rows.map(r => r.data);
}

function isConnected() {
  return pool !== null;
}

module.exports = { init, getSessions, getSpeakers, isConnected };
