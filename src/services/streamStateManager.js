/**
 * Gestor de estado para streams de participantes
 * Mantiene el mapeo de qué participantes tienen streams disponibles
 */
class StreamStateManager {
  constructor() {
    this.participantsWithStreams = new Map();
  }

  /**
   * Marcar participante como teniendo stream disponible
   */
  addParticipantStream(socketId, userData) {
    if (!socketId || !userData) {
      console.warn('⚠️ Datos inválidos para agregar stream:', { socketId, userData });
      return false;
    }

    this.participantsWithStreams.set(socketId, {
      socketId,
      userData,
      timestamp: new Date()
    });

    console.log(`✅ Participante ${userData.email} marcado con stream disponible`);
    console.log(`📊 Total participantes con streams: ${this.participantsWithStreams.size}`);
    return true;
  }

  /**
   * Remover participante del mapa de streams
   */
  removeParticipantStream(socketId) {
    const existed = this.participantsWithStreams.has(socketId);
    if (existed) {
      const participant = this.participantsWithStreams.get(socketId);
      this.participantsWithStreams.delete(socketId);
      console.log(`🗑️ Participante ${participant.userData.email} removido del mapa de streams`);
      console.log(`📊 Total participantes con streams: ${this.participantsWithStreams.size}`);
    }
    return existed;
  }

  /**
   * Verificar si un participante tiene stream disponible
   */
  hasParticipantStream(socketId) {
    return this.participantsWithStreams.has(socketId);
  }

  /**
   * Obtener información de un participante con stream
   */
  getParticipantStream(socketId) {
    return this.participantsWithStreams.get(socketId);
  }

  /**
   * Obtener estadísticas de streams
   */
  getStats() {
    return {
      totalStreams: this.participantsWithStreams.size,
      participants: Array.from(this.participantsWithStreams.values())
    };
  }

  /**
   * Limpiar streams antiguos (opcional, para mantenimiento)
   */
  cleanupOldStreams(maxAgeMinutes = 60) {
    const now = new Date();
    let cleanedCount = 0;

    for (const [socketId, streamData] of this.participantsWithStreams) {
      const ageMinutes = (now - streamData.timestamp) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes) {
        this.participantsWithStreams.delete(socketId);
        cleanedCount++;
        console.log(`🧹 Stream antiguo removido: ${streamData.userData.email} (${ageMinutes.toFixed(1)} min)`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ ${cleanedCount} streams antiguos limpiados`);
    }

    return cleanedCount;
  }
}

// Exportar instancia singleton
const streamStateManager = new StreamStateManager();
module.exports = streamStateManager;
