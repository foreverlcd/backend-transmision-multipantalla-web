// Mapa global para trackear participantes con streams disponibles
const participantsWithStreams = new Map();

function addParticipantStream(socketId, userData) {
  participantsWithStreams.set(socketId, {
    socketId,
    userData,
    timestamp: new Date()
  });
  console.log(`✅ Participante ${userData.email} marcado con stream disponible`);
}

function removeParticipantStream(socketId) {
  return participantsWithStreams.delete(socketId);
}

function hasParticipantStream(socketId) {
  return participantsWithStreams.has(socketId);
}

module.exports = {
  participantsWithStreams,
  addParticipantStream,
  removeParticipantStream,
  hasParticipantStream
};
