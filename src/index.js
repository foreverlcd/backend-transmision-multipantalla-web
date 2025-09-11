require('dotenv').config(); // 👈 debe ir arriba de todo
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./api/auth');

// Inicializar Prisma
const prisma = new PrismaClient();

// Mapa global para trackear participantes con streams disponibles
const participantsWithStreams = new Map();

// Cargar variables de entorno
dotenv.config();

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
    
    console.log(`Usuario autenticado: ${user.email} (${user.role}) - Equipo: ${user.teamId}, Categoría: ${socket.user.categoryId}`);
    
    // Continuar con la conexión
    next();
    
  } catch (error) {
    console.error('Error de autenticación en Socket.IO:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Middleware de logging para debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Body:`, req.body);
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
    
    // Listar admins conectados
    const adminSockets = Array.from(io.sockets.adapter.rooms.get('admins') || []);
    console.log(`📊 Total admins conectados: ${adminSockets.length}`);
    
    // Enviar lista actual de participantes al admin recién conectado
    const participantSockets = Array.from(io.sockets.adapter.rooms.get('participants') || []);
    console.log(`📡 Enviando lista de ${participantSockets.length} participantes al admin`);
    console.log(`📊 Participantes con streams disponibles: ${participantsWithStreams.size}`);
    
    const participantsList = [];
    participantSockets.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket && participantSocket.user) {
        const hasStream = participantsWithStreams.has(participantSocketId);
        console.log(`👤 Participante ${participantSocket.user.email}: stream disponible = ${hasStream}`);
        
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
    
    // Listar participantes conectados
    const participantSockets = Array.from(io.sockets.adapter.rooms.get('participants') || []);
    console.log(`📊 Total participantes conectados: ${participantSockets.length}`);
  }
  
  // Cuando un participante está listo para compartir pantalla
  socket.on('participant-ready', (data) => {
    console.log(`🎬 Participante listo: ${data.email} (${socket.id})`);
    console.log(`📊 Datos del participante:`, JSON.stringify(data, null, 2));
    
    // Verificar cuántos admins hay conectados
    const adminSockets = Array.from(io.sockets.adapter.rooms.get('admins') || []);
    console.log(`📡 Notificando a ${adminSockets.length} administradores`);
    
    // Notificar a todos los administradores que hay un nuevo participante disponible
    const notificationData = {
      socketId: socket.id,
      userData: {
        id: data.userId,
        email: data.email,
        teamId: data.teamId
      }
    };
    
    console.log(`📤 Enviando user-joined:`, JSON.stringify(notificationData, null, 2));
    socket.to('admins').emit('user-joined', notificationData);
  });

  // Cuando un participante confirma que tiene stream listo
  socket.on('participant-stream-ready', (data) => {
    console.log(`📺 Stream listo para participante: ${socket.user.email} (${socket.id})`);
    console.log(`📋 Datos recibidos:`, data);
    
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
    
    console.log(`📡 Enviando participant-stream-available a todos los admins:`, streamData);
    socket.to('admins').emit('participant-stream-available', streamData);
  });

  // Cuando un participante deja de compartir pantalla
  socket.on('participant-stopped-sharing', (data) => {
    console.log(`📴 Participante ${socket.user.email} (${socket.id}) detuvo la compartición`);
    
    // Remover participante del mapa de streams disponibles
    if (participantsWithStreams.has(socket.id)) {
      participantsWithStreams.delete(socket.id);
      console.log(`✅ Participante ${socket.user.email} removido del mapa de streams`);
      console.log(`📊 Total participantes con streams: ${participantsWithStreams.size}`);
    }
    
    // Notificar a todos los administradores que el participante ya no está transmitiendo
    socket.to('admins').emit('participant-stopped-sharing', {
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
    console.log(`📦 Tipo de señal:`, data.signal.type);
    console.log(`📦 Tamaño de señal:`, JSON.stringify(data.signal).length, 'caracteres');
    
    // Verificar que el admin existe
    const adminSocket = io.sockets.sockets.get(data.adminSocketId);
    if (!adminSocket) {
      console.log(`❌ Admin ${data.adminSocketId} no encontrado`);
      return;
    }
    
    console.log(`✅ Reenviando señal al admin ${data.adminSocketId}`);
    
    // Reenviar la señal al admin correspondiente
    socket.to(data.adminSocketId).emit('receiving-signal', {
      signal: data.signal,
      participantSocketId: socket.id
    });
    
    console.log(`📤 Señal enviada correctamente al admin`);
  });

  // Cuando un admin envía señal de respuesta al participante
  socket.on('returning-signal', (data) => {
    console.log(`📡 Señal de respuesta del admin ${socket.user.email} (${socket.id}) al participante ${data.participantSocketId}`);
    console.log(`📦 Tipo de señal:`, data.signal.type);
    console.log(`📦 Tamaño de señal:`, JSON.stringify(data.signal).length, 'caracteres');
    
    // Verificar que el participante existe
    const participantSocket = io.sockets.sockets.get(data.participantSocketId);
    if (!participantSocket) {
      console.log(`❌ Participante ${data.participantSocketId} no encontrado`);
      return;
    }
    
    console.log(`✅ Reenviando señal de respuesta al participante ${data.participantSocketId}`);
    
    // Reenviar la señal al participante correspondiente
    socket.to(data.participantSocketId).emit('return-signal-received', {
      signal: data.signal,
      adminSocketId: socket.id
    });
    
    console.log(`📤 Señal de respuesta enviada correctamente al participante`);
  });

  // Cuando un admin solicita la lista actualizada de participantes
  socket.on('request-participants-list', () => {
    console.log(`🔄 Admin ${socket.user.email} solicita lista actualizada de participantes`);
    
    const participantSockets = Array.from(io.sockets.adapter.rooms.get('participants') || []);
    console.log(`📡 Enviando lista actualizada de ${participantSockets.length} participantes`);
    console.log(`📊 Participantes con streams disponibles: ${participantsWithStreams.size}`);
    
    const participantsList = [];
    participantSockets.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket && participantSocket.user) {
        const hasStream = participantsWithStreams.has(participantSocketId);
        console.log(`👤 Participante ${participantSocket.user.email}: stream disponible = ${hasStream}`);
        
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
    console.log(`✅ Lista enviada con ${participantsList.length} participantes`);
  });

  
  socket.on('disconnect', () => {
    console.log(`👋 Usuario desconectado: ${socket.user.email} (ID: ${socket.id})`);
    
    // Limpiar del mapa de streams si es participante
    if (participantsWithStreams.has(socket.id)) {
      participantsWithStreams.delete(socket.id);
      console.log(`🗑️ Participante ${socket.user.email} removido del mapa de streams por desconexión`);
      console.log(`📊 Total participantes con streams: ${participantsWithStreams.size}`);
    }
    
    // Notificar a los admins si un participante se desconecta
    if (socket.user.role === 'PARTICIPANT') {
      console.log(`📤 Notificando desconexión de participante a admins`);
      socket.to('admins').emit('user-left', {
        socketId: socket.id
      });
    }
  });
});

// Puerto del servidor
const PORT = process.env.PORT || 3001;

// Iniciar el servidor HTTP (no solo Express)
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});