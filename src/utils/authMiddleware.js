const jwt = require('jsonwebtoken');

// Middleware para verificar el token JWT
const verifyToken = (req, res, next) => {
  try {
    // Leer el token del header Authorization
    const authHeader = req.headers.authorization;
    
    // Verificar si el header existe y empieza con 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ error: 'Token de acceso requerido' });
    }
    
    // Extraer el token (remover 'Bearer ' del inicio)
    const token = authHeader.substring(7); // 'Bearer '.length = 7
    
    // Verificar el token con jwt.verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Añadir el payload decodificado al objeto req
    req.user = decoded;
    
    // Continuar con el siguiente middleware o ruta
    next();
    
  } catch (error) {
    // Si el token es inválido o ha expirado
    console.error('Error de verificación de token:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = verifyToken;