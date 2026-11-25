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
- Al terminar: `npm test` y `npm run build` en server/, `npx tsc --noEmit` en mobile/.

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
- Cambios de JS: `npm run update:preview` en mobile/ los manda por aire al
  APK (canal preview). Nunca correr `eas update` sin `--environment
  preview`: usaría la IP local de mobile/.env y la app de producción
  dejaría de andar.
- runtimeVersion usa la política "fingerprint": si cambió algo nativo,
  la actualización no le llega a los APK viejos (hace falta APK nuevo).

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
- Probar en el próximo APK lo que en Expo Go no se ve (el mapa sale gris
  porque Expo Go trae react-native-maps 1.27): "Buscar en esta zona"
  (demora y que no tape la tarjeta) y abierto/cerrado en el mapa.
- Después de validar el APK: actualizar a Expo SDK 58 (tarea aparte).
  Expo Go del Play Store solo soporta el último SDK. Revisar qué versión
  de react-native-maps espera el 58 y si se puede sacar la exclusión.
