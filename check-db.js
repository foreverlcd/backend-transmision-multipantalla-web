const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('=== VERIFICANDO DATOS DE LA BASE DE DATOS ===\n');
    
    const categories = await prisma.category.findMany();
    console.log('CATEGORÍAS:');
    categories.forEach(cat => console.log(`  - ID: ${cat.id}, Nombre: ${cat.name}`));
    
    const teams = await prisma.team.findMany({
      include: { category: true }
    });
    console.log('\nEQUIPOS:');
    teams.forEach(team => console.log(`  - ID: ${team.id}, Nombre: ${team.name}, CategoríaID: ${team.categoryId}, Categoría: ${team.category.name}`));
    
    const users = await prisma.user.findMany({
      include: { team: { include: { category: true } } }
    });
    console.log('\nUSUARIOS:');
    users.forEach(user => {
      const teamInfo = user.team ? `${user.team.name} (ID: ${user.team.id})` : 'Sin equipo';
      const categoryInfo = user.team?.category ? user.team.category.name : 'Sin categoría';
      console.log(`  - ${user.email} (${user.role}) - Equipo: ${teamInfo}, Categoría: ${categoryInfo}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
