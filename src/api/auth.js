const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verifyToken = require('../utils/authMiddleware');

// Inicializar el cliente de Prisma
const prisma = new PrismaClient();

// Inicializar el router de Express
const router = express.Router();

// Ruta de login
router.post('/login', async (req, res) => {
  console.log('🔍 Ruta /login accedida. Body:', req.body);
  try {
    // Extraer email y password del body de la petición
    const { email, password } = req.body;
    
    // Validación de campos requeridos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    // Buscar usuario en la base de datos por email
    const user = await prisma.user.findUnique({
      where: {
        email: email
      }
    });
    
    // Verificar si el usuario existe y la contraseña es válida
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Comparar la contraseña con la contraseña encriptada en la base de datos
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    // Verificar si las contraseñas coinciden
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Login exitoso - Generar token JWT
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    // Respuesta exitosa con token y datos del usuario (sin contraseña)
    res.status(200).json({
      message: 'Login exitoso',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener datos del usuario autenticado
router.get('/me', verifyToken, async (req, res) => {
  try {
    // Buscar usuario en la base de datos usando el id del token
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      }
    });

    // Verificar si el usuario existe
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Devolver datos del usuario (sin contraseña)
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        teamId: user.teamId
      }
    });

  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;