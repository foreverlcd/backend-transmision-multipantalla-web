const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    // Crear categoría de prueba
    const category = await prisma.category.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Transmisión Multipantalla'
      }
    });

    // Crear equipo de prueba
    const team = await prisma.team.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Equipo Principal',
        categoryId: category.id
      }
    });

    // Crear usuario admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        password: adminPassword,
        role: 'ADMIN',
        teamId: team.id
      }
    });

    // Crear usuario participante
    const userPassword = await bcrypt.hash('user123', 10);
    const user = await prisma.user.upsert({
      where: { email: 'user@test.com' },
      update: {},
      create: {
        email: 'user@test.com',
        password: userPassword,
        role: 'PARTICIPANT',
        teamId: team.id
      }
    });

    console.log('Usuarios de prueba creados:');
    console.log('Admin: admin@test.com / admin123');
    console.log('Usuario: user@test.com / user123');
    
  } catch (error) {
    console.error('Error creando usuarios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
