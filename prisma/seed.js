// backend/prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando el proceso de seeding...');

  // 1. Limpiar la base de datos
  console.log('Limpiando datos existentes...');
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.category.deleteMany({});
  
  // 2. Crear Categorías
  console.log('Creando categorías...');
  const frontendCategory = await prisma.category.create({
    data: { name: 'Desarrollo Frontend' },
  });

  const backendCategory = await prisma.category.create({
    data: { name: 'Desarrollo Backend' },
  });

  // 3. Crear Usuario Administrador
  console.log('Creando usuario administrador...');
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@asdu.com',
      password: hashedAdminPassword,
      role: 'ADMIN',
    },
  });

  // 4. Crear Equipos y Participantes
  console.log('Creando equipos y participantes...');

  // --- Equipo A (Frontend) ---
  const teamA = await prisma.team.create({
    data: {
      name: 'Equipo Alfa',
      categoryId: frontendCategory.id,
    },
  });
  const hashedParticipantPassword = await bcrypt.hash('participante123', 10);
  await prisma.user.createMany({
    data: [
      { email: 'p1.alfa@email.com', password: hashedParticipantPassword, role: 'PARTICIPANT', teamId: teamA.id },
      { email: 'p2.alfa@email.com', password: hashedParticipantPassword, role: 'PARTICIPANT', teamId: teamA.id },
    ],
  });

  // --- Equipo B (Backend) ---
  const teamB = await prisma.team.create({
    data: {
      name: 'Equipo Beta',
      categoryId: backendCategory.id,
    },
  });
  await prisma.user.createMany({
    data: [
      { email: 'p1.beta@email.com', password: hashedParticipantPassword, role: 'PARTICIPANT', teamId: teamB.id },
      { email: 'p2.beta@email.com', password: hashedParticipantPassword, role: 'PARTICIPANT', teamId: teamB.id },
    ],
  });

  console.log('Seeding completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });