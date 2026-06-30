const prisma = require('./prisma');
const { hashPassword, generateSalt } = require('../utils/helpers');
const logger = require('../utils/logger');

const defaultUsers = [
  {
    id: 'usr-ramesh',
    username: 'ramesh',
    password: 'password123',
    full_name: 'Ramesh Kumar',
    role: 'Senior Safety Officer'
  },
  {
    id: 'usr-admin',
    username: 'admin',
    password: 'password123',
    full_name: 'Admin Director',
    role: 'Safety Director'
  },
  {
    id: 'usr-rakesh',
    username: 'rakesh varma',
    password: 'rakesh',
    full_name: 'Rakesh Varma',
    role: 'Site Supervisor'
  }
];

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

async function main() {
  logger.info('Starting database seeding...');

  // Seed Users
  for (const u of defaultUsers) {
    const salt = generateSalt();
    const hash = hashPassword(u.password, salt);
    
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        id: u.id,
        username: u.username,
        password_hash: hash,
        salt: salt,
        full_name: u.full_name,
        role: u.role
      }
    });
    logger.info(`Seeded user: ${u.username}`);
  }

  // Seed Presets
  for (const p of presets) {
    await prisma.templatePreset.upsert({
      where: { preset_name: p.preset_name },
      update: {
        incident_type: p.incident_type,
        severity_level: p.severity_level,
        raw_description: p.raw_description,
        immediate_actions: p.immediate_actions,
        weather_conditions: p.weather_conditions
      },
      create: {
        id: p.id,
        preset_name: p.preset_name,
        incident_type: p.incident_type,
        severity_level: p.severity_level,
        raw_description: p.raw_description,
        immediate_actions: p.immediate_actions,
        weather_conditions: p.weather_conditions
      }
    });
    logger.info(`Seeded preset: ${p.preset_name}`);
  }

  logger.info('Database seeding completed successfully.');
}

if (require.main === module) {
  main()
    .catch((err) => {
      logger.error('Error seeding database', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = main;
