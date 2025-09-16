const { participantsWithStreams } = require('../services/streamManager');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Usuario conectado: ${socket.user.email} (ID: ${socket.id}, Rol: ${socket.user.role})`);
    
    // Unirse a sala según el rol del usuario
    if (socket.user.role === 'ADMIN') {
      handleAdminConnection(socket, io);
    } else if (socket.user.role === 'PARTICIPANT') {
      handleParticipantConnection(socket, io);
    }

    setupEventHandlers(socket, io);
  });
}

function handleAdminConnection(socket, io) {
  socket.join('admins');
  console.log(`👑 Admin ${socket.user.email} unido a sala de administradores`);
  
  // Enviar lista actual de participantes
  sendParticipantsList(socket, io);
}

function handleParticipantConnection(socket, io) {
  socket.join('participants');
  console.log(`👤 Participante ${socket.user.email} unido a sala de participantes`);
}

/**
 * Configurar todos los manejadores de eventos de Socket.IO
 */
function setupEventHandlers(socket, io) {
  // Cuando un participante está listo
  socket.on('participant-ready', (data) => {
    if (!validateParticipantData(data)) {
      console.warn('❌ Datos inválidos en participant-ready:', data);
      return;
    }
    handleParticipantReady(socket, io, data);
  });

  // Cuando un participante tiene stream listo
  socket.on('participant-stream-ready', (data) => {
    if (!validateParticipantData(data)) {
      console.warn('❌ Datos inválidos en participant-stream-ready:', data);
      return;
    }
    handleParticipantStreamReady(socket, io, data);
  });

  // Cuando un participante deja de compartir
  socket.on('participant-stopped-sharing', (data) => {
    handleParticipantStoppedSharing(socket, io, data);
  });

  // Cuando un admin quiere conectarse
  socket.on('admin-wants-to-connect', (data) => {
    if (!validateSocketId(data?.participantSocketId)) {
      console.warn('❌ participantSocketId inválido:', data);
      return;
    }
    handleAdminWantsToConnect(socket, io, data);
  });

  // Señales WebRTC
  socket.on('sending-signal', (data) => {
    if (!validateSocketId(data?.adminSocketId) || !data?.signal) {
      console.warn('❌ Datos inválidos en sending-signal:', data);
      return;
    }
    handleSendingSignal(socket, io, data);
  });

  socket.on('returning-signal', (data) => {
    if (!validateSocketId(data?.participantSocketId) || !data?.signal) {
      console.warn('❌ Datos inválidos en returning-signal:', data);
      return;
    }
    handleReturningSignal(socket, io, data);
  });

  // Solicitud de lista de participantes
  socket.on('request-participants-list', () => {
    sendParticipantsList(socket, io);
  });

  // Evento para obtener diagnósticos (solo para admins)
  socket.on('get-connection-diagnostics', () => {
    if (socket.user.role !== 'ADMIN') {
      socket.emit('diagnostics-error', { message: 'Solo administradores pueden acceder a diagnósticos' });
      return;
    }
    
    const diagnostics = connectionManager.getDiagnostics();
    const streamStats = streamStateManager.getStats();
    
    socket.emit('connection-diagnostics', {
      connections: diagnostics,
      streams: streamStats,
      timestamp: new Date().toISOString()
    });
  });

  // Evento para forzar limpieza de conexiones (solo para admins)
  socket.on('cleanup-stale-connections', () => {
    if (socket.user.role !== 'ADMIN') {
      socket.emit('cleanup-error', { message: 'Solo administradores pueden limpiar conexiones' });
      return;
    }
    
    // Limpiar streams antiguos
    const cleanedStreams = streamStateManager.cleanupOldStreams(30); // 30 minutos
    
    socket.emit('cleanup-completed', {
      cleanedStreams,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Manejar cuando participante está listo
 */
function handleParticipantReady(socket, io, data) {
  console.log(`🎬 Participante listo: ${data.email} (${socket.id})`);
  
  const adminSockets = Array.from(io.sockets.adapter.rooms.get('admins') || []);
  console.log(`📡 Notificando a ${adminSockets.length} administradores`);
  
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
}

/**
 * Manejar cuando participante tiene stream listo
 */
function handleParticipantStreamReady(socket, io, data) {
  console.log(`📺 Stream listo para participante: ${socket.user.email} (${socket.id})`);
  
  // Usar el stream state manager
  const success = streamStateManager.addParticipantStream(socket.id, {
    id: socket.user.id,
    email: socket.user.email,
    teamId: socket.user.teamId,
    categoryId: socket.user.categoryId,
    categoryName: socket.user.categoryName
  });

  if (!success) {
    console.warn('❌ Error al agregar stream al estado');
    return;
  }
  
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
}

/**
 * Manejar cuando participante deja de compartir pantalla
 */
function handleParticipantStoppedSharing(socket, io, data) {
  console.log(`📴 Participante ${socket.user.email} (${socket.id}) detuvo la compartición`);
  
  // Remover participante del mapa de streams disponibles
  const wasRemoved = streamStateManager.removeParticipantStream(socket.id);
  
  if (wasRemoved) {
    console.log(`✅ Participante ${socket.user.email} removido del mapa de streams`);
  }
  
  // Notificar a todos los administradores que el participante ya no está transmitiendo
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
}

/**
 * Manejar desconexión de usuario con limpieza mejorada
 */
function handleDisconnection(socket, io) {
  console.log(`👋 Usuario desconectado: ${socket.user.email} (ID: ${socket.id})`);
  
  // Limpiar conexiones WebRTC registradas
  const cleanedConnections = connectionManager.cleanupSocket(socket.id);
  console.log(`🧹 ${cleanedConnections} conexiones WebRTC limpiadas`);
  
  // Limpiar stream state si es participante
  if (socket.user.role === 'PARTICIPANT') {
    const streamRemoved = streamStateManager.removeParticipantStream(socket.id);
    
    // Notificar a admins sobre la desconexión del participante
    socket.broadcast.to('admins').emit('user-left', { 
      socketId: socket.id,
      userEmail: socket.user.email,
      streamWasAvailable: streamRemoved,
      timestamp: new Date().toISOString()
    });
    
    // Notificar específicamente a admins que tenían conexión con este participante
    const connectedAdmins = connectionManager.getAdminsForParticipant(socket.id);
    connectedAdmins.forEach(adminSocketId => {
      const adminSocket = io.sockets.sockets.get(adminSocketId);
      if (adminSocket) {
        adminSocket.emit('participant-connection-lost', {
          participantSocketId: socket.id,
          participantEmail: socket.user.email,
          reason: 'disconnect',
          timestamp: new Date().toISOString()
        });
      }
    });
    
  } else if (socket.user.role === 'ADMIN') {
    console.log(`👑 Admin desconectado: ${socket.user.email}`);
    
    // Notificar a participantes que tenían conexión con este admin
    const connectedParticipants = connectionManager.getParticipantsForAdmin(socket.id);
    connectedParticipants.forEach(participantSocketId => {
      const participantSocket = io.sockets.sockets.get(participantSocketId);
      if (participantSocket) {
        participantSocket.emit('admin-connection-lost', {
          adminSocketId: socket.id,
          adminEmail: socket.user.email,
          reason: 'disconnect',
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  // Log estadísticas finales
  const stats = connectionManager.getStats();
  console.log(`📊 Estado después de desconexión:`, stats);
}

module.exports = setupSocketHandlers;