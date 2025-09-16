require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./api/auth');

// Inicializar Prisma
const prisma = new PrismaClient();

// Mapa global para trackear participantes con streams disponibles
const participantsWithStreams = new Map();

// Crear la aplicación Express
const app = express();

// Crear servidor HTTP
const server = createServer(app);

// Configurar Socket.IO con CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware de autenticación para Socket.IO
io.use(async (socket, next) => {
  try {
    // Extraer el token JWT del handshake
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verificar el token con jwt.verify
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
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
    next(new Error('Authentication error: Invalid token'));
  }
});

// Middleware Express
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Middleware de logging simple
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/auth', authRoutes);

// Ruta básica de prueba
app.get('/', (req, res) => {
  res.json({ message: 'Servidor de transmisión multipantalla funcionando' });
});

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
  console.log(`✅ Usuario conectado: ${socket.user.email} (ID: ${socket.id}, Rol: ${socket.user.role})`);
  
  // Unirse a sala según el rol del usuario
  if (socket.user.role === 'ADMIN') {
    socket.join('admins');
    console.log(`👑 Admin ${socket.user.email} unido a sala de administradores`);
    
    // Enviar lista actual de participantes al admin recién conectado
    const participantSockets = Array.from(io.sockets.adapter.rooms.get('participants') || []);
    console.log(`📡 Enviando lista de ${participantSockets.length} participantes al admin`);
    
    const participantsList = [];
    participantSockets.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket && participantSocket.user) {
        const hasStream = participantsWithStreams.has(participantSocketId);
        
        participantsList.push({
          socketId: participantSocketId,
          userData: {
            id: participantSocket.user.id,
            email: participantSocket.user.email,
            teamId: participantSocket.user.teamId,
            categoryId: participantSocket.user.categoryId,
            categoryName: participantSocket.user.categoryName,
            streamAvailable: hasStream
          }
        });
      }
    });
    
    // Enviar lista actual de participantes
    socket.emit('participants-list', participantsList);
    
  } else if (socket.user.role === 'PARTICIPANT') {
    socket.join('participants');
    console.log(`👤 Participante ${socket.user.email} unido a sala de participantes`);
  }
  
  // Cuando un participante está listo para compartir pantalla
  socket.on('participant-ready', (data) => {
    console.log(`🎬 Participante listo: ${data.email} (${socket.id})`);
    
    // Notificar a todos los administradores que hay un nuevo participante disponible
    const notificationData = {
      socketId: socket.id,
      userData: {
        id: data.userId,
        email: data.email,
        teamId: data.teamId,
        categoryId: socket.user.categoryId,
        categoryName: socket.user.categoryName
      }
    };
    
    socket.broadcast.to('admins').emit('user-joined', notificationData);
  });

  // Cuando un participante confirma que tiene stream listo
  socket.on('participant-stream-ready', (data) => {
    console.log(`📺 Stream listo para participante: ${socket.user.email} (${socket.id})`);
    
    // Marcar participante como teniendo stream disponible
    participantsWithStreams.set(socket.id, {
      socketId: socket.id,
      userData: {
        id: socket.user.id,
        email: socket.user.email,
        teamId: socket.user.teamId,
        categoryId: socket.user.categoryId,
        categoryName: socket.user.categoryName
      },
      timestamp: new Date()
    });
    
    console.log(`✅ Participante ${socket.user.email} marcado con stream disponible`);
    console.log(`📊 Total participantes con streams: ${participantsWithStreams.size}`);
    
    // Notificar a todos los administradores que el participante tiene stream disponible
    const streamData = {
      socketId: socket.id,
      userData: {
        id: socket.user.id,
        email: socket.user.email,
        teamId: socket.user.teamId,
        categoryId: socket.user.categoryId,
        categoryName: socket.user.categoryName
      }
    };
    
    socket.broadcast.to('admins').emit('participant-stream-available', streamData);
  });

  // Cuando un participante deja de compartir pantalla
  socket.on('participant-stopped-sharing', (data) => {
    console.log(`📴 Participante ${socket.user.email} (${socket.id}) detuvo la compartición`);
    
    // Remover participante del mapa de streams disponibles
    if (participantsWithStreams.has(socket.id)) {
      participantsWithStreams.delete(socket.id);
      console.log(`✅ Participante ${socket.user.email} removido del mapa de streams`);
    }
    
    // Notificar a todos los administradores
    socket.broadcast.to('admins').emit('participant-stopped-sharing', {
      socketId: socket.id,
      userData: {
        id: socket.user.id,
        email: socket.user.email,
        teamId: socket.user.teamId,
        categoryId: socket.user.categoryId,
        categoryName: socket.user.categoryName
      }
    });
  });

  // Cuando un admin quiere conectarse a un participante
  socket.on('admin-wants-to-connect', (data) => {
    console.log(`📞 Admin ${socket.user.email} (${socket.id}) quiere conectarse al participante ${data.participantSocketId}`);
    
    // Verificar que el participante existe
    const participantSocket = io.sockets.sockets.get(data.participantSocketId);
    if (!participantSocket) {
      console.log(`❌ Participante ${data.participantSocketId} no encontrado`);
      return;
    }
    
    console.log(`✅ Enviando solicitud de conexión al participante ${data.participantSocketId}`);
    
    // Notificar al participante específico que un admin quiere conectarse
    socket.to(data.participantSocketId).emit('admin-wants-to-connect', {
      adminSocketId: socket.id
    });
  });

  // Cuando un participante envía señal WebRTC al admin
  socket.on('sending-signal', (data) => {
    console.log(`📡 Señal WebRTC del participante ${socket.user.email} (${socket.id}) al admin ${data.adminSocketId}`);
    
    // Verificar que el admin existe
    const adminSocket = io.sockets.sockets.get(data.adminSocketId);
    if (!adminSocket) {
      console.log(`❌ Admin ${data.adminSocketId} no encontrado`);
      return;
    }
    
    // Reenviar la señal al admin correspondiente
    socket.to(data.adminSocketId).emit('receiving-signal', {
      signal: data.signal,
      participantSocketId: socket.id
    });
  });

  // Cuando un admin envía señal de respuesta al participante
  socket.on('returning-signal', (data) => {
    console.log(`📡 Señal de respuesta del admin ${socket.user.email} (${socket.id}) al participante ${data.participantSocketId}`);
    
    // Verificar que el participante existe
    const participantSocket = io.sockets.sockets.get(data.participantSocketId);
    if (!participantSocket) {
      console.log(`❌ Participante ${data.participantSocketId} no encontrado`);
      return;
    }
    
    // Reenviar la señal al participante correspondiente
    socket.to(data.participantSocketId).emit('return-signal-received', {
      signal: data.signal,
      adminSocketId: socket.id
    });
  });

  // Cuando un admin solicita la lista actualizada de participantes
  socket.on('request-participants-list', () => {
    console.log(`🔄 Admin ${socket.user.email} solicita lista actualizada de participantes`);
    
    const participantSockets = Array.from(io.sockets.adapter.rooms.get('participants') || []);
    
    const participantsList = [];
    participantSockets.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket && participantSocket.user) {
        const hasStream = participantsWithStreams.has(participantSocketId);
        
        participantsList.push({
          socketId: participantSocketId,
          userData: {
            id: participantSocket.user.id,
            email: participantSocket.user.email,
            teamId: participantSocket.user.teamId,
            categoryId: participantSocket.user.categoryId,
            categoryName: participantSocket.user.categoryName,
            streamAvailable: hasStream
          }
        });
      }
    });
    
    // Enviar lista actualizada
    socket.emit('participants-list', participantsList);
  });

  // Cuando un admin deja de observar un participante
  socket.on('admin-stop-observing', (data) => {
    console.log(`🛑 Admin ${socket.user.email} deja de observar participante ${data.participantSocketId}`);
    // No necesitamos hacer nada especial en el backend para esto
    // El frontend maneja la limpieza de las conexiones WebRTC
  });
  
  socket.on('disconnect', () => {
    console.log(`👋 Usuario desconectado: ${socket.user.email} (ID: ${socket.id})`);
    
    // Limpiar del mapa de streams si es participante
    if (participantsWithStreams.has(socket.id)) {
      participantsWithStreams.delete(socket.id);
      console.log(`🗑️ Participante ${socket.user.email} removido del mapa de streams por desconexión`);
    }
    
    // Notificar a los admins si un participante se desconecta
    if (socket.user.role === 'PARTICIPANT') {
      socket.broadcast.to('admins').emit('user-left', {
        socketId: socket.id
      });
    }
  });
});

// Puerto del servidor
const PORT = process.env.PORT || 3001;

// Iniciar el servidor HTTP
server.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  console.log(`🔑 JWT Secret configurado: ${!!process.env.JWT_SECRET}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando servidor...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
});