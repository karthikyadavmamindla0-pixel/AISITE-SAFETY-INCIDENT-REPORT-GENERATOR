const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const useTurso = process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== '';

let dbInstance = null;
let client = null;
let initializationPromise = null;

if (useTurso) {
  console.log('Detecting Turso cloud database configuration. Connecting via LibSQL...');
  const { createClient } = require('@libsql/client');
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  initializationPromise = initializeTursoDatabase();
} else {
  console.log('No Turso variables detected. Defaulting to local SQLite connection...');
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'reports.db');
  initializationPromise = new Promise((resolve, reject) => {
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening local database:', err.message);
        reject(err);
      } else {
        console.log('Connected to local SQLite database at:', dbPath);
        initializeSqliteDatabase().then(resolve).catch(reject);
      }
    });
  });
}

// --- SQLITE INITIALIZATION ---
function initializeSqliteDatabase() {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS incident_reports (
          id TEXT PRIMARY KEY,
          supervisor_name TEXT NOT NULL,
          supervisor_role TEXT NOT NULL,
          site_location TEXT NOT NULL,
          incident_timestamp TEXT NOT NULL,
          incident_type TEXT NOT NULL,
          severity_level TEXT NOT NULL,
          raw_description TEXT NOT NULL,
          weather_conditions TEXT,
          immediate_actions TEXT,
          witness_details TEXT,
          generated_report_markdown TEXT NOT NULL,
          prompt_version INTEGER DEFAULT 4,
          response_time_ms INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL,
          rating_stars INTEGER NOT NULL CHECK(rating_stars >= 1 AND rating_stars <= 5),
          comments TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (report_id) REFERENCES incident_reports(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) return reject(err);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS template_presets (
          id TEXT PRIMARY KEY,
          preset_name TEXT NOT NULL UNIQUE,
          incident_type TEXT NOT NULL,
          severity_level TEXT NOT NULL,
          raw_description TEXT NOT NULL,
          immediate_actions TEXT,
          weather_conditions TEXT
        )
      `, (err) => {
        if (err) return reject(err);
        seedTemplatesSqlite(resolve, reject);
      });
    });
  });
}

// --- TURSO INITIALIZATION ---
async function initializeTursoDatabase() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS incident_reports (
        id TEXT PRIMARY KEY,
        supervisor_name TEXT NOT NULL,
        supervisor_role TEXT NOT NULL,
        site_location TEXT NOT NULL,
        incident_timestamp TEXT NOT NULL,
        incident_type TEXT NOT NULL,
        severity_level TEXT NOT NULL,
        raw_description TEXT NOT NULL,
        weather_conditions TEXT,
        immediate_actions TEXT,
        witness_details TEXT,
        generated_report_markdown TEXT NOT NULL,
        prompt_version INTEGER DEFAULT 4,
        response_time_ms INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        rating_stars INTEGER NOT NULL,
        comments TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS template_presets (
        id TEXT PRIMARY KEY,
        preset_name TEXT NOT NULL UNIQUE,
        incident_type TEXT NOT NULL,
        severity_level TEXT NOT NULL,
        raw_description TEXT NOT NULL,
        immediate_actions TEXT,
        weather_conditions TEXT
      )
    `);

    await seedTemplatesTurso();
    console.log('Turso tables initialized and seeded successfully.');
  } catch (err) {
    console.error('Error initializing Turso tables:', err.message);
    throw err;
  }
}

const presets = [
  {
    id: 'preset-1',
    preset_name: 'Scaffolding Fall (High Severity)',
    incident_type: 'Fall from Height',
    severity_level: 'High',
    raw_description: 'A subcontractor mason was working on the third-floor external scaffolding without securing his safety harness line. The scaffolding platform plank slipped, causing the mason to lose balance and fall onto the second-floor safety net mesh. The net successfully caught him, preventing a fatal drop, but he sustained a minor sprain and superficial bruises.',
    immediate_actions: 'Site safety supervisor halted all work on that block. The worker was immediately helped down and administered first aid. He was sent to the nearest clinic (Apex Hospital) for checkup. The scaffolding safety lines and planks were inspected and re-tied. A mandatory toolbox meeting was scheduled for all workers.',
    weather_conditions: 'Clear skies, hot (approx 34°C), mild wind.'
  },
  {
    id: 'preset-2',
    preset_name: 'Excavation Wall Collapse (Critical)',
    incident_type: 'Excavation Cave-in',
    severity_level: 'Critical',
    raw_description: 'During foundation excavation works for Flyover Pier 12, a portion of the southern trench wall collapsed. Excavation depth was 4.5 meters. The trench lacked proper shoring/strutting. No workers were trapped inside as the collapse happened during the lunch break. Excavator operator noted soil shifting minutes prior and raised alarm.',
    immediate_actions: 'Area cordoned off immediately. Excavation work suspended. Subcontractor instructed to install heavy shoring/sheet piling before resuming. Soil stability check conducted by project engineer.',
    weather_conditions: 'Heavy rainfall in the morning, high humidity, soil wet and unstable.'
  },
  {
    id: 'preset-3',
    preset_name: 'Electrical Hazard / Short Circuit (Medium)',
    incident_type: 'Electrical Short Circuit',
    severity_level: 'Medium',
    raw_description: 'Temporary power distribution board (PDB) on Site Block B experienced a short circuit due to moisture ingress after overnight rains. Sparks and small localized fire occurred inside the board enclosure. No injuries reported. The main circuit breaker tripped automatically, cutting power to the zone.',
    immediate_actions: 'Site electrician isolated the main supply. Fire extinguisher (DCP type) was used to douse the board sparks. Damaged cables and MCBs were replaced. The distribution board was relocated to a covered dry shelter with a weather-proof enclosure.',
    weather_conditions: 'Overcast, damp conditions, highly humid.'
  }
];

function seedTemplatesSqlite(resolve, reject) {
  try {
    const stmt = dbInstance.prepare(`
      INSERT OR IGNORE INTO template_presets (id, preset_name, incident_type, severity_level, raw_description, immediate_actions, weather_conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    presets.forEach((p) => {
      stmt.run(p.id, p.preset_name, p.incident_type, p.severity_level, p.raw_description, p.immediate_actions, p.weather_conditions);
    });
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  } catch (err) {
    reject(err);
  }
}

async function seedTemplatesTurso() {
  try {
    for (const p of presets) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO template_presets (id, preset_name, incident_type, severity_level, raw_description, immediate_actions, weather_conditions)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [p.id, p.preset_name, p.incident_type, p.severity_level, p.raw_description, p.immediate_actions, p.weather_conditions]
      });
    }
  } catch (err) {
    console.error('Failed to seed presets in Turso:', err.message);
  }
}

// --- UNIFIED API OPERATIONS ---
const dbOperations = {
  isTurso: useTurso,
  db: useTurso ? client : dbInstance,

  ready() {
    return initializationPromise;
  },

  run(sql, params = []) {
    if (useTurso) {
      return client.execute({ sql, args: params }).then(result => ({
        lastID: result.lastInsertRowid ? result.lastInsertRowid.toString() : null,
        changes: Number(result.rowsAffected)
      }));
    } else {
      return new Promise((resolve, reject) => {
        dbInstance.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
  },

  all(sql, params = []) {
    if (useTurso) {
      return client.execute({ sql, args: params }).then(result => result.rows);
    } else {
      return new Promise((resolve, reject) => {
        dbInstance.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  },

  get(sql, params = []) {
    if (useTurso) {
      return client.execute({ sql, args: params }).then(result => result.rows[0] || null);
    } else {
      return new Promise((resolve, reject) => {
        dbInstance.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  }
};

module.exports = dbOperations;
