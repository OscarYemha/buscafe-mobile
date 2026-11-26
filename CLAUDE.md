# BusCafé

App para descubrir cafeterías. `mobile/` (Expo 57, React Native) y
`server/` (Express 5, Prisma 7, Postgres). Autor: Oscar. Respondé en castellano rioplatense.

`react-native-maps` va en 1.29 a propósito aunque Expo 57 espere 1.27.2:
la 1.27 tenía problemas de renderizado en el mapa. Está excluido de los
chequeos de Expo (`expo.install.exclude` en mobile/package.json); no
bajarlo con `expo install --fix`.

## Cómo trabajamos
- Modo mixto: los cambios chicos o los que quiero entender, explicámelos
  y dejame escribirlos a mí (decime archivo, lugar y qué poner). Los
  grandes o repetitivos (tests, refactors) los hacés vos.
- Antes de cambios no triviales: proponé un plan y esperá mi OK.
- Un commit por paso, mensajes estilo Conventional Commits en castellano.
- Al terminar: `npm test` y `npm run build` en server/; `npx tsc --noEmit`
  y `npx jest` en mobile/ (no hay script `test` a propósito: ver jest.config.js).

## Base de datos: reglas estrictas
- server/.env apunta a Postgres LOCAL (localhost:5432). Las URLs de
  Supabase (producción) están comentadas: nunca las uses.
- Antes de cualquier comando de Prisma que escriba, verificá que
  DIRECT_URL sea localhost. Las migraciones se aplican en local con
  `npx prisma migrate deploy --config prisma7.config.ts`; a producción
  las aplica Oscar durante el deploy.
- Si Postgres no responde (ECONNREFUSED): `sudo systemctl start postgresql`.

## APK y actualizaciones (EAS)
- APK: `npx eas-cli build -p android --profile preview` (gasta un build del
  cupo mensual). Hace falta uno nuevo solo si cambia algo nativo (SDK,
  paquetes con código nativo, app.config.js).
- Cambios de JS: en mobile/ correr
  `npx eas-cli update --channel preview --environment preview --platform android --message "..."`
  (o `npm run update:preview` si eas-cli está instalado global). Nunca sin
  `--environment preview`: usaría la IP local de mobile/.env y la app de
  producción dejaría de andar.
- runtimeVersion usa la política "fingerprint": si cambió algo nativo,
  la actualización no le llega a los APK viejos (hace falta APK nuevo).
  Ojo: los `scripts` de mobile/package.json también entran en el
  fingerprint; cambiarlos rompe la compatibilidad con los APK instalados.
  Antes de publicar, verificar con
  `npx eas-cli fingerprint:compare --build-id <id> --environment preview`.

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
- README desactualizado (último ítem de la lista de ChatGPT).
- Actualizar a Expo SDK 58 (tarea aparte; el APK actual ya está validado).
  Expo Go del Play Store solo soporta el último SDK. Revisar qué versión
  de react-native-maps espera el 58 y si se puede sacar la exclusión.
- Fotos huérfanas en producción (Supabase, bucket avatars): las que
  dejaron los cambios de foto y las cuentas borradas antes del arreglo
  de DELETE /users/me. Limpiar con un script de una sola vez (toca datos
  reales: revisar con Oscar antes de correrlo).
- Antes de una prueba con otras personas: dominio propio verificado en
  Resend (hoy los mails salen de onboarding@resend.dev y solo le llegan
  al dueño de la cuenta), alertas de presupuesto en Google Cloud y ver si
  el plan de Render duerme el server.
