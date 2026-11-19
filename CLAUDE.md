# BusCafé

App para descubrir cafeterías. `mobile/` (Expo 57, React Native) y
`server/` (Express 5, Prisma 7, Postgres). Autor: Oscar. Respondé en castellano rioplatense.

## Cómo trabajamos
- Modo mixto: los cambios chicos o los que quiero entender, explicámelos
  y dejame escribirlos a mí (decime archivo, lugar y qué poner). Los
  grandes o repetitivos (tests, refactors) los hacés vos.
- Antes de cambios no triviales: proponé un plan y esperá mi OK.
- Un commit por paso, mensajes estilo Conventional Commits en castellano.
- Al terminar: `npm test` y `npm run build` en server/, `npx tsc --noEmit` en mobile/.

## Base de datos: reglas estrictas
- server/.env apunta a Postgres LOCAL (localhost:5432). Las URLs de
  Supabase (producción) están comentadas: nunca las uses.
- Antes de cualquier comando de Prisma que escriba, verificá que
  DIRECT_URL sea localhost. Las migraciones se aplican en local con
  `npx prisma migrate deploy --config prisma7.config.ts`; a producción
  las aplica Oscar durante el deploy.
- Si Postgres no responde (ECONNREFUSED): `sudo systemctl start postgresql`.

## Deploy (Render, auto-deploy desde master)
Mergear a master despliega. Procedimiento: desactivar auto-deploy →
cargar variables nuevas en Render → mergear → aplicar migración en
producción → deploy manual → verificar → reactivar auto-deploy.
Nunca mergees a master sin que Oscar lo pida.

## Pendiente
- Deploy de fix/seguridad-auth (falta VERIFICATION_CODE_SECRET en
  Render, migración hash_verification_codes_and_attempts, después
  verificar y borrar GET /debug/ip).
- Ubicación: watchUserLocation arranca antes de que se otorgue el
  permiso (error "undetermined") y no se reintenta; getCurrentLocation
  no verifica servicios de ubicación ni tiene timeout.
- Resetear contraseña no invalida sesiones (tokenVersion).
- 401 sin manejar en el resto de rutas de mobile (ej. removeFavorite).
- Lista de ChatGPT: validar mapa en APK, abierto/cerrado en mapa,
  "Elegir zona", README desactualizado, npm audit en mobile.
- Antes del APK: EXPO_PUBLIC_API_URL del environment preview de EAS
  debe apuntar a Render.
