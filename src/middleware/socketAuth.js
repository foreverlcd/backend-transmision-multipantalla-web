const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Middleware de autenticación para Socket.IO
 * Valida el token JWT y carga los datos del usuario
 */
const socketAuth = async (socket, next) => {
  try {
    // Extraer el token JWT del handshake
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.warn('❌ Socket sin token:', socket.id);
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verificar el token con jwt.verify
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.warn('❌ Token JWT inválido:', jwtError.message);
      return next(new Error(`Authentication error: ${jwtError.message}`));
    }
    
    // Obtener información completa del usuario desde la base de datos
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        team: {
          include: {
            category: true
          }
        }
      }
    });
    
    if (!user) {
      console.warn('❌ Usuario no encontrado en DB:', payload.id);
      return next(new Error('Authentication error: User not found'));
    }
    
    // Añadir los datos completos del usuario al objeto socket
    socket.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      categoryId: user.team?.categoryId || null,
      categoryName: user.team?.category?.name || null
    };
    
    console.log(`✅ Usuario autenticado: ${user.email} (${user.role}) - Equipo: ${user.teamId}, Categoría: ${socket.user.categoryId}`);
    
    // Continuar con la conexión
    next();
    
  } catch (error) {
    console.error('❌ Error de autenticación en Socket.IO:', error);
    next(new Error('Authentication error: Server error'));
  }
};

module.exports = socketAuth;
