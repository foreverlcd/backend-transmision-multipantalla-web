/**
 * Middleware de logging para debug de requests HTTP
 */
const loggerMiddleware = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 [${timestamp}] ${req.method} ${req.path}`);
  
  // Solo mostrar body si no es muy grande y no contiene contraseñas
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) {
      sanitizedBody.password = '[HIDDEN]';
    }
    console.log(`📦 Body:`, sanitizedBody);
  }
  
  next();
};

module.exports = { loggerMiddleware };
