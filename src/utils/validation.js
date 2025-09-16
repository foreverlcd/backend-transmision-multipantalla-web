/**
 * Validar datos de participante
 */
function validateParticipantData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const { userId, email, teamId } = data;
  
  return !!(
    userId && 
    email && 
    typeof email === 'string' && 
    email.includes('@') &&
    (teamId === null || typeof teamId === 'number')
  );
}

/**
 * Validar ID de socket
 */
function validateSocketId(socketId) {
  return !!(
    socketId && 
    typeof socketId === 'string' && 
    socketId.length > 0
  );
}

/**
 * Validar señal WebRTC
 */
function validateWebRTCSignal(signal) {
  return !!(
    signal &&
    typeof signal === 'object' &&
    signal.type &&
    ['offer', 'answer', 'candidate'].includes(signal.type)
  );
}

module.exports = {
  validateParticipantData,
  validateSocketId,
  validateWebRTCSignal
};
