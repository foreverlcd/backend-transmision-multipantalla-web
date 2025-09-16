/**
 * Gestor de conexiones WebRTC para múltiples streams simultáneos
 * Maneja el mapeo entre admins y participantes
 */
class ConnectionManager {
  constructor() {
    // Mapa de conexiones activas: adminSocketId -> Set de participantSocketId
    this.adminToParticipants = new Map();
    // Mapa inverso: participantSocketId -> Set de adminSocketId
    this.participantToAdmins = new Map();
    // Historial de señales para debugging
    this.signalHistory = new Map();
  }

  /**
   * Registrar intento de conexión de admin a participante
   */
  registerConnection(adminSocketId, participantSocketId) {
    console.log(`🔗 Registrando conexión: Admin ${adminSocketId} -> Participante ${participantSocketId}`);
    
    // Admin -> Participantes
    if (!this.adminToParticipants.has(adminSocketId)) {
      this.adminToParticipants.set(adminSocketId, new Set());
    }
    this.adminToParticipants.get(adminSocketId).add(participantSocketId);
    
    // Participante -> Admins
    if (!this.participantToAdmins.has(participantSocketId)) {
      this.participantToAdmins.set(participantSocketId, new Set());
    }
    this.participantToAdmins.get(participantSocketId).add(adminSocketId);
    
    console.log(`✅ Conexión registrada. Admin tiene ${this.adminToParticipants.get(adminSocketId).size} conexiones`);
    console.log(`✅ Participante conectado a ${this.participantToAdmins.get(participantSocketId).size} admins`);
  }

  /**
   * Desregistrar conexión
   */
  unregisterConnection(adminSocketId, participantSocketId) {
    console.log(`🔌 Desregistrando conexión: Admin ${adminSocketId} -> Participante ${participantSocketId}`);
    
    // Limpiar admin -> participante
    if (this.adminToParticipants.has(adminSocketId)) {
      this.adminToParticipants.get(adminSocketId).delete(participantSocketId);
      if (this.adminToParticipants.get(adminSocketId).size === 0) {
        this.adminToParticipants.delete(adminSocketId);
      }
    }
    
    // Limpiar participante -> admin
    if (this.participantToAdmins.has(participantSocketId)) {
      this.participantToAdmins.get(participantSocketId).delete(adminSocketId);
      if (this.participantToAdmins.get(participantSocketId).size === 0) {
        this.participantToAdmins.delete(participantSocketId);
      }
    }
  }

  /**
   * Limpiar todas las conexiones de un socket (admin o participante)
   */
  cleanupSocket(socketId) {
    console.log(`🧹 Limpiando conexiones para socket: ${socketId}`);
    
    let cleanedCount = 0;
    
    // Si es admin, limpiar sus conexiones a participantes
    if (this.adminToParticipants.has(socketId)) {
      const participantSockets = Array.from(this.adminToParticipants.get(socketId));
      participantSockets.forEach(participantSocketId => {
        this.unregisterConnection(socketId, participantSocketId);
        cleanedCount++;
      });
    }
    
    // Si es participante, limpiar sus conexiones a admins
    if (this.participantToAdmins.has(socketId)) {
      const adminSockets = Array.from(this.participantToAdmins.get(socketId));
      adminSockets.forEach(adminSocketId => {
        this.unregisterConnection(adminSocketId, socketId);
        cleanedCount++;
      });
    }
    
    console.log(`✅ ${cleanedCount} conexiones limpiadas para socket ${socketId}`);
    return cleanedCount;
  }

  /**
   * Obtener participantes conectados a un admin
   */
  getParticipantsForAdmin(adminSocketId) {
    return Array.from(this.adminToParticipants.get(adminSocketId) || []);
  }

  /**
   * Obtener admins conectados a un participante
   */
  getAdminsForParticipant(participantSocketId) {
    return Array.from(this.participantToAdmins.get(participantSocketId) || []);
  }

  /**
   * Verificar si existe una conexión específica
   */
  hasConnection(adminSocketId, participantSocketId) {
    return this.adminToParticipants.get(adminSocketId)?.has(participantSocketId) || false;
  }

  /**
   * Registrar señal WebRTC para debugging
   */
  recordSignal(fromSocketId, toSocketId, signalType, timestamp = new Date()) {
    const key = `${fromSocketId}->${toSocketId}`;
    if (!this.signalHistory.has(key)) {
      this.signalHistory.set(key, []);
    }
    
    this.signalHistory.get(key).push({
      type: signalType,
      timestamp,
      from: fromSocketId,
      to: toSocketId
    });
    
    // Mantener solo los últimos 10 registros por conexión
    const history = this.signalHistory.get(key);
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Obtener estadísticas del gestor
   */
  getStats() {
    const totalAdmins = this.adminToParticipants.size;
    const totalParticipants = this.participantToAdmins.size;
    let totalConnections = 0;
    
    for (const participantSet of this.adminToParticipants.values()) {
      totalConnections += participantSet.size;
    }
    
    return {
      totalAdmins,
      totalParticipants,
      totalConnections,
      signalHistoryEntries: this.signalHistory.size
    };
  }

  /**
   * Obtener diagnóstico detallado
   */
  getDiagnostics() {
    const stats = this.getStats();
    const adminConnections = {};
    const participantConnections = {};
    
    // Mapear conexiones de admins
    for (const [adminId, participantSet] of this.adminToParticipants) {
      adminConnections[adminId] = Array.from(participantSet);
    }
    
    // Mapear conexiones de participantes
    for (const [participantId, adminSet] of this.participantToAdmins) {
      participantConnections[participantId] = Array.from(adminSet);
    }
    
    return {
      stats,
      adminConnections,
      participantConnections,
      recentSignals: this.getRecentSignals(5)
    };
  }

  /**
   * Obtener señales recientes para debugging
   */
  getRecentSignals(limit = 5) {
    const allSignals = [];
    
    for (const [key, signals] of this.signalHistory) {
      allSignals.push(...signals.slice(-limit));
    }
    
    return allSignals
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

// Exportar instancia singleton
const connectionManager = new ConnectionManager();
module.exports = connectionManager;
