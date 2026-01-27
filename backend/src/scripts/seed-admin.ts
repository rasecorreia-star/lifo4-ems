/**
 * Seed script to create demo admin user
 * Run with: npx tsx src/scripts/seed-admin.ts
 */

import bcrypt from 'bcryptjs';
import { getFirestore, Collections } from '../config/firebase.js';
import { UserRole } from '../models/types.js';

const SALT_ROUNDS = 12;

async function seedAdmin() {
  console.log('🌱 Seeding demo admin user...');

  const db = getFirestore();

  // Check if admin already exists
  const existingAdmin = await db
    .collection(Collections.USERS)
    .where('email', '==', 'admin@lifo4.com.br')
    .get();

  if (!existingAdmin.empty) {
    console.log('✅ Admin user already exists!');
    console.log('\n📧 Email: admin@lifo4.com.br');
    console.log('🔑 Senha: admin123');
    process.exit(0);
  }

  // Create organization first
  const orgRef = db.collection(Collections.ORGANIZATIONS).doc();
  await orgRef.set({
    name: 'Lifo4 Energia',
    slug: 'lifo4',
    address: {
      street: 'Rua Exemplo, 123',
      city: 'Teresina',
      state: 'PI',
      zipCode: '64000-000',
      country: 'Brasil',
    },
    contact: {
      email: 'contato@lifo4.com.br',
      phone: '(86) 99999-9999',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`✅ Organization created: ${orgRef.id}`);

  // Hash password
  const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);

  // Create admin user
  const userRef = db.collection(Collections.USERS).doc();
  const now = new Date();

  await userRef.set({
    email: 'admin@lifo4.com.br',
    name: 'Administrador',
    phone: '(86) 99999-9999',
    password: hashedPassword,
    role: UserRole.ADMIN,
    organizationId: orgRef.id,
    permissions: ['*'],
    isActive: true,
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
    notificationPreferences: {
      email: { enabled: true, criticalOnly: false },
      whatsapp: { enabled: false, criticalOnly: true },
      push: { enabled: true },
      telegram: { enabled: false },
      quietHours: { enabled: false, start: '22:00', end: '07:00' },
    },
    language: 'pt-BR',
    theme: 'dark',
  });

  console.log(`✅ Admin user created: ${userRef.id}`);

  // Create a demo BESS system
  const systemRef = db.collection(Collections.SYSTEMS).doc();
  await systemRef.set({
    name: 'BESS Demo - 100kWh',
    organizationId: orgRef.id,
    siteId: 'site-demo',
    type: 'bess',
    status: 'online',
    capacity: {
      energy: 100, // kWh
      power: 50,   // kW
    },
    batteryConfig: {
      chemistry: 'LiFePO4',
      nominalVoltage: 51.2,
      nominalCapacity: 100,
      cellCount: 16,
      moduleCount: 4,
    },
    location: {
      latitude: -5.0892,
      longitude: -42.8019,
      address: 'Teresina, PI',
    },
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✅ Demo BESS system created: ${systemRef.id}`);

  console.log('\n========================================');
  console.log('🎉 Seed completed successfully!');
  console.log('========================================');
  console.log('\n📧 Email: admin@lifo4.com.br');
  console.log('🔑 Senha: admin123');
  console.log('\n');

  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
