# Backend - Transmisión Multipantalla

## Descripción
Backend para el sistema de transmisión multipantalla desarrollado con Node.js y Express.

## Requisitos Previos
- Node.js (versión 14 o superior)
- npm o yarn
- Base de datos (especificar tipo)

## Instalación

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
Editar el archivo `.env` con las configuraciones necesarias.

### Paso 4: Configurar base de datos
```bash
npm run migrate
npm run seed
```

## Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

## API Endpoints
- `GET /api/health` - Estado del servidor
- `POST /api/transmision` - Crear transmisión
- `GET /api/transmision` - Obtener transmisiones

## Estructura del Proyecto
```
src/
├── controllers/
├── models/
├── routes/
├── middleware/
└── utils/
```

## Tecnologías Utilizadas
- Node.js
- Express.js
- Socket.io (para tiempo real)

## Contribución
1. Fork el proyecto
2. Crear rama de feature
3. Commit los cambios
4. Push a la rama
5. Crear Pull Request