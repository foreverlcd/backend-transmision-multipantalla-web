# 🎥 Backend - Transmisión Multipantalla

## 📋 Descripción
Backend para el sistema de transmisión multipantalla desarrollado con Node.js, Express.js, Prisma ORM y SQLite. Este sistema permite la autenticación de usuarios, gestión de equipos y transmisión en tiempo real.

## 🛠️ Tecnologías Utilizadas
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **Prisma ORM** - ORM para base de datos
- **SQLite** - Base de datos
- **Socket.io** - Comunicación en tiempo real
- **JWT** - Autenticación con tokens
- **bcrypt** - Encriptación de contraseñas
- **CORS** - Manejo de peticiones cross-origin

## 📋 Requisitos Previos
- Node.js (versión 18 o superior)
- npm (incluido con Node.js)

## 🚀 Instalación y Configuración

### Paso 1: Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd backend-transmision-multipantalla-web
```

### Paso 2: Instalar dependencias
```bash
npm install
```

### Paso 3: Configurar variables de entorno
```bash
cp .env.example .env
```

Asegúrate de que el archivo `.env` contenga:
```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="ESTA-ES-UNA-CLAVE-SECRETA-MUY-LARGA-Y-DEBES-CAMBIARLA"
FRONTEND_URL="http://localhost:3000"
```

### Paso 4: Configurar base de datos
```bash
# Ejecutar migraciones
npm run migrate

# Poblar base de datos con datos de prueba
npm run seed
```

## 🎮 Scripts Disponibles

```bash
# Desarrollo - Inicia el servidor con nodemon
npm run dev

# Producción - Inicia el servidor
npm start

# Migraciones de base de datos
npm run migrate
npm run prisma:migrate

# Poblar base de datos con datos de prueba
npm run seed
npm run prisma:seed

# Abrir Prisma Studio (interfaz visual para DB)
npm run prisma:studio

# Ejecutar tests
npm test
```

## 🌐 API Endpoints

### 🔐 Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener datos del usuario autenticado

### 📊 Estructura de Respuesta Login
```json
{
  "message": "Login exitoso",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "admin@asdu.com",
    "role": "ADMIN",
    "teamId": null
  }
}
```

## 👥 Usuarios de Prueba

### 👨‍💼 Administrador
- **Email:** `admin@asdu.com`
- **Contraseña:** `admin123`
- **Rol:** ADMIN

### 👥 Participantes - Equipo Alfa (Frontend)
- **Email:** `p1.alfa@email.com` | **Contraseña:** `participante123`
- **Email:** `p2.alfa@email.com` | **Contraseña:** `participante123`

### 👥 Participantes - Equipo Beta (Backend)
- **Email:** `p1.beta@email.com` | **Contraseña:** `participante123`
- **Email:** `p2.beta@email.com` | **Contraseña:** `participante123`

## 📁 Estructura del Proyecto
```
backend-transmision-multipantalla-web/
├── src/
│   ├── index.js              # Punto de entrada del servidor
│   ├── api/
│   │   └── auth.js           # Rutas de autenticación
│   └── utils/
│       └── authMiddleware.js # Middleware de autenticación JWT
├── prisma/
│   ├── schema.prisma         # Esquema de base de datos
│   ├── seed.js              # Datos de prueba
│   ├── dev.db               # Base de datos SQLite
│   └── migrations/          # Migraciones de DB
├── .env.example             # Ejemplo de variables de entorno
├── package.json             # Dependencias y scripts
└── README.md               # Este archivo
```

## 🚀 Uso en Desarrollo

1. **Iniciar el servidor backend:**
```bash
npm run dev
```
El servidor estará disponible en `http://localhost:3001`

2. **Para visualizar la base de datos:**
```bash
npm run prisma:studio
```
Se abrirá una interfaz web en `http://localhost:5555`

## 🐛 Solución de Problemas

### Error: "Missing script: migrate"
Asegúrate de estar en el directorio correcto y usar:
```bash
npm run migrate
```

### Error de conexión a base de datos
Verifica que el archivo `.env` existe y contiene la URL correcta de la base de datos.

### Error de JWT
Asegúrate de que `JWT_SECRET` esté configurado en el archivo `.env`.

## 🔧 Desarrollo

### Agregar nuevas rutas
1. Crear archivo en `src/api/`
2. Configurar rutas en `src/index.js`
3. Usar middleware de autenticación si es necesario

### Modificar base de datos
1. Editar `prisma/schema.prisma`
2. Ejecutar `npm run migrate`
3. Actualizar `prisma/seed.js` si es necesario

## 🤝 Contribución
1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit los cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📞 Soporte
Si encuentras problemas, revisa:
1. Que todas las dependencias estén instaladas
2. Que el archivo `.env` esté configurado correctamente
3. Que la base de datos esté migrada y poblada
4. Que el puerto 3001 esté disponible