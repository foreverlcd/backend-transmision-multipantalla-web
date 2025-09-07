require('dotenv').config(); // 👈 debe ir arriba de todo
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const authRoutes = require('./api/auth');

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
    methods: ["GET", "POST"]
  }
});

// Middleware de autenticación para Socket.IO
io.use((socket, next) => {
  try {
    // Extraer el token JWT del handshake
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verificar el token con jwt.verify
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Añadir los datos del usuario al objeto socket
    socket.user = payload;
    
    console.log(`Usuario autenticado: ${payload.email} (${payload.role})`);
    
    // Continuar con la conexión
    next();
    
  } catch (error) {
    console.error('Error de autenticación en Socket.IO:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Middleware
app.use(cors());
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
    
    const participantsList = [];
    participantSockets.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket && participantSocket.user) {
        participantsList.push({
          socketId: participantSocketId,
          userData: {
            id: participantSocket.user.userId || participantSocket.user.id,
            email: participantSocket.user.email,
            teamId: participantSocket.user.teamId
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
    console.log(`📺 Stream listo para participante: ${data.email} (${socket.id})`);
    
    // Notificar a todos los administradores que el participante tiene stream disponible
    socket.to('admins').emit('participant-stream-available', {
      socketId: socket.id,
      userData: {
        id: data.userId,
        email: data.email,
        teamId: data.teamId
      }
    });
  });

  // Cuando un participante deja de compartir pantalla
  socket.on('participant-stopped-sharing', (data) => {
    console.log(`📴 Participante ${data.email} (${socket.id}) detuvo la compartición`);
    
    // Notificar a todos los administradores que el participante ya no está transmitiendo
    socket.to('admins').emit('participant-stopped-sharing', {
      socketId: socket.id,
      userData: {
        id: data.userId,
        email: data.email,
        teamId: data.teamId
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
    
    const participantsList = [];
    participantSockets.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket && participantSocket.user) {
        participantsList.push({
          socketId: participantSocketId,
          userData: {
            id: participantSocket.user.userId || participantSocket.user.id,
            email: participantSocket.user.email,
            teamId: participantSocket.user.teamId
          }
        });
      }
    });
    
    // Enviar lista actualizada
    socket.emit('participants-list', participantsList);
  });

  
  socket.on('disconnect', () => {
    console.log(`👋 Usuario desconectado: ${socket.user.email} (ID: ${socket.id})`);
    
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