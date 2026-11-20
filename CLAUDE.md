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

Supabase (plan gratuito) pausa el proyecto tras ~7 días sin uso. Lo
evita `.github/workflows/keepalive.yml`, que pinga GET /health a diario.
GitHub desactiva ese workflow si el repo pasa 60 días sin commits:
si llega el aviso, reactivarlo en Actions.

## Pendiente
- Lista de ChatGPT: validar mapa en APK, abierto/cerrado en mapa,
  "Elegir zona", README desactualizado, npm audit en mobile.
- Antes del APK: EXPO_PUBLIC_API_URL del environment preview de EAS
  debe apuntar a Render.
