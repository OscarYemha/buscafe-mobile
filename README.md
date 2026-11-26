# BusCafé

Aplicación móvil Full Stack para descubrir cafeterías según la ubicación, las preferencias y el motivo de la visita.

BusCafé permite encontrar cafeterías cercanas o en cualquier zona, verlas en un mapa, consultar sus detalles y saber cuáles recomienda la comunidad para trabajar, estudiar, tener una cita, comer o disfrutar de un buen café.

> Proyecto en desarrollo. La app funciona en Android y el backend está desplegado; se está preparando una primera versión de prueba.

## Funcionalidades

### Descubrir cafeterías

- Cafeterías cercanas según la ubicación del teléfono, ordenadas por distancia.
- Categorías según el motivo de la visita: trabajar, estudiar, tener una cita, buen café, comer y pet friendly.
- Recomendaciones de la comunidad: en trabajar, estudiar y cita solo se recomiendan cafeterías con al menos 5 respuestas y un 70 % de opiniones positivas. Si ninguna cumple, la app lo dice en lugar de rellenar con lugares sin valoraciones.
- **Elegir zona**: buscar en un barrio o ciudad en lugar de la ubicación actual, con sugerencias mientras se escribe. La zona elegida se recuerda entre categorías y al cerrar la app, y la distancia se sigue midiendo desde el usuario.
- Buscador por nombre o zona.
- Mapa con los marcadores de cada cafetería, si está abierta o cerrada, y la opción de buscar en la zona que se está viendo.
- Ordenamiento por distancia, puntuación de Google o puntuación de BusCafé.

### Cafeterías

- Detalle con fotos, horarios, servicios, contacto y acceso a "Cómo llegar".
- Reseñas con puntuación general y valoraciones específicas de café, comida, atención, comodidad y nivel de ruido.
- Favoritos.

### Cuenta

- Registro con verificación por email.
- Inicio de sesión y recuperación de contraseña por código.
- Edición de nombre, foto de perfil y email (con verificación del email nuevo).
- Cambio de contraseña y eliminación de la cuenta.

### Seguridad

- Contraseñas cifradas con bcrypt.
- Códigos de verificación guardados con hash y con un límite de intentos.
- Límites de solicitudes por IP y por email en los endpoints de autenticación.
- Cambiar o restablecer la contraseña cierra las sesiones abiertas en otros dispositivos.
- Al eliminar la cuenta se borran también sus fotos.

## Tecnologías

### Aplicación móvil

- TypeScript
- React Native y Expo (SDK 57)
- React Navigation
- react-native-maps y Expo Location
- EAS Build y EAS Update (actualizaciones por aire)
- Jest y React Native Testing Library

### Backend

- Node.js, Express 5 y TypeScript
- Prisma ORM 7 y PostgreSQL
- Google Places API (cafeterías, fotos y búsqueda de zonas)
- Resend (emails)
- Supabase Storage (fotos de perfil)
- Vitest y Supertest

### Infraestructura

- Render (API) y Supabase (base de datos y storage)
- GitHub Actions (chequeo diario de la API)

## Estructura del proyecto

```text
buscafe-mobile/
├── mobile/    Aplicación móvil (Expo y React Native)
├── server/    API REST (Node.js, Express y Prisma)
└── README.md
```

## Requisitos

- Node.js 20.19.4 o superior y npm.
- PostgreSQL.
- Una clave de Google Places API.
- Para la funcionalidad completa: cuentas de Resend y Supabase.
- Un teléfono Android con Expo Go, o un emulador.

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/OscarYemha/buscafe-mobile.git
cd buscafe-mobile
```

### 2. Configurar el servidor

```bash
cd server
npm install
cp .env.example .env
```

Completar `server/.env`:

| Variable | Para qué se usa |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL que usa la API. |
| `DIRECT_URL` | Conexión directa para las migraciones de Prisma. En local puede ser la misma que `DATABASE_URL`. |
| `GOOGLE_PLACES_API_KEY` | Clave de Google Places (API nueva). |
| `JWT_SECRET` | Secreto para firmar las sesiones. |
| `VERIFICATION_CODE_SECRET` | Secreto para el hash de los códigos de verificación. Se puede generar con `openssl rand -hex 32`. |
| `RESEND_API_KEY` | Clave de Resend para enviar los emails. |
| `SUPABASE_URL` y `SUPABASE_SECRET_KEY` | Proyecto de Supabase para las fotos de perfil (bucket `avatars`). |

Generar el cliente de Prisma y aplicar las migraciones:

```bash
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
```

Iniciar el servidor:

```bash
npm run dev
```

La API se ejecuta en el puerto `3001`.

### 3. Configurar la aplicación móvil

En otra terminal:

```bash
cd mobile
npm install
cp .env.example .env
```

Indicar en `mobile/.env` la dirección del servidor:

```env
EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:3001
```

El teléfono y la computadora deben estar en la misma red local. Si la IP de la computadora cambia, hay que actualizarla y reiniciar Expo con `npx expo start -c`.

Iniciar Expo:

```bash
npm start
```

> En Expo Go el mapa se ve gris: la app usa `react-native-maps` 1.29 y Expo Go trae la 1.27. Para probar el mapa hace falta un APK o un development build.

## Tests

```bash
# Backend
cd server
npm test

# Aplicación móvil
cd mobile
npx jest
```

En la aplicación móvil no hay script `npm test` a propósito: los scripts de `package.json` forman parte de la huella del código nativo que usa EAS Update, y cambiarlos dejaría sin actualizaciones a los APK ya instalados.

## API

| Área | Rutas principales |
|---|---|
| Cafeterías | `GET /cafes/nearby`, `GET /cafes/search`, `GET /cafes/place/:id`, `GET /cafes/place/:id/photo/:index` |
| Zonas | `GET /zones`, `GET /zones/:placeId` |
| Usuarios | Registro, verificación de email, login, recuperación de contraseña y `/users/me` (perfil, foto, email, contraseña y eliminación de la cuenta) |
| Reseñas y favoritos | `POST /reviews`, `GET /favorites`, `POST /favorites`, `DELETE /favorites/:googlePlaceId` |
| Estado | `GET /health` (incluye un chequeo de la base de datos) |

## Próximos pasos

- Publicar una primera versión de prueba con otras personas.
- Preparar la publicación en Google Play.
- Actualizar a Expo SDK 58.

## Autor

**Oscar Ismael Yemha**

- GitHub: [OscarYemha](https://github.com/OscarYemha)
- LinkedIn: [oscarismaelyemha](https://www.linkedin.com/in/oscarismaelyemha/)
