# TECNOCOM180 Platform

## Guía operativa de desarrollo, pruebas y despliegue

**Documento de continuidad para futuras sesiones de ChatGPT**

**Última actualización:** 20 de octubre de 2026

**Repositorio:** `tecnocom180-platform`

**Rama de trabajo:** `feature/postgresql-production`

**Último commit desplegado y confirmado:** `3c0d9f2`

---

## 1. Instrucción para mi yo del futuro

Este documento contiene información **comprobada durante una sesión real de actualización de TECNOCOM180 Platform**.

Antes de solicitar nuevamente la arquitectura, los comandos de despliegue o la ubicación de los servicios, consulta esta guía.

**Reglas de trabajo:**

- Avanzar un paso a la vez.

- Dar comandos concretos y esperar el resultado antes de continuar.

- Usar PowerShell para Windows y Bash para Ubuntu.

- No modificar producción para realizar pruebas.

- No reiniciar PostgreSQL, Mosquitto o Nginx innecesariamente.

- No pedir contraseñas, tokens ni secretos.

- Verificar los servicios después de cada despliegue.

- No asumir que la configuración sigue igual: comprobarla cuando sea relevante.

---

## 2. Arquitectura general

```text

DESARROLLO LOCAL — WINDOWS

C:\Users\Miguel Angel\tecnocom180-platform

    |

    | Git push

    v

GITHUB

miguelon81/tecnocom180-platform

    |

    | Git pull

    v

HOSTINGER VPS — UBUNTU

/opt/tecnocom180/app

    |

    +-- API Node.js / Express / Prisma

    |      |

    |      +-- systemd

    |      +-- 127.0.0.1:3000

    |      +-- MQTT HiveMQ Cloud

    |

    +-- Frontend React / Vite

    |      |

    |      +-- apps/web/dist

    |      +-- Nginx

    |

    +-- PostgreSQL 18 (Docker)

    |

    +-- Mosquitto MQTT (Docker)

```

### Dominios de producción

| Dominio | Función |

|---|---|

| `app.tecnocom180.com` | Interfaz web |

| `api.tecnocom180.com` | API REST |

| `mqtt.tecnocom180.com` | Dominio con configuración Nginx |

**Importante:** la API continúa conectándose a HiveMQ Cloud según los registros observados el 20 de octubre de 2026. No asumir que la migración a Mosquitto propio ya se completó.

---

## 3. Desarrollo local en Windows

**Ruta del repositorio:**

```powershell

cd "C:\Users\Miguel Angel\tecnocom180-platform"

```

**Tecnologías:**

- Node.js 24

- Express 5

- Prisma 7

- PostgreSQL

- React + TypeScript

- Vite

- MQTT

- JWT

### Arrancar la API

```powershell

npm run dev --workspace @tecnocom180/api

```

Dirección local:

`http://127.0.0.1:3000`

### Arrancar el frontend

En otra terminal:

```powershell

npm run dev --workspace @tecnocom180/web

```

Dirección local:

`http://localhost:5173`

### Configuración local

El archivo `.env` de desarrollo debe utilizar:

```dotenv

DATABASE\_URL="postgresql://USUARIO:CONTRASEÑA@127.0.0.1:5433/tecnocom180\_test?schema=public"

MQTT\_ENABLED=false

JWT\_SECRET=SECRETO\_INDEPENDIENTE\_DE\_PRUEBAS

```

Los valores anteriores son ejemplos; nunca copiar credenciales reales al documento.

**Regla crítica:** mantener `MQTT\_ENABLED=false` en desarrollo para evitar que la API local procese mensajes reales de los dispositivos de producción.

---

## 4. PostgreSQL: túnel SSH para pruebas

PostgreSQL se encuentra en el VPS, dentro de Docker, y publica su puerto exclusivamente en `127.0.0.1:5432`.

Existen dos bases de datos identificadas:

| Base de datos | Uso |

|---|---|

| `tecnocom180` | Producción |

| `tecnocom180\_test` | Desarrollo y pruebas |

### Abrir el túnel SSH

En una terminal PowerShell independiente:

```powershell

ssh -N -o ExitOnForwardFailure=yes -L 5433:127.0.0.1:5432 tecnocom180@179.236.233.166

```

Mantener esta terminal abierta mientras se desarrolla.

**Interpretación:**

```text

Windows localhost:5433

          |

       Túnel SSH

          |

VPS localhost:5432

          |

PostgreSQL Docker

          |

tecnocom180\_test

```

La API local utiliza `localhost:5433`, mientras que PostgreSQL continúa escuchando en el VPS mediante `localhost:5432`.

### Precauciones

1\. Verificar que `DATABASE\_URL` apunte a `tecnocom180\_test`.

2\. No ejecutar migraciones destructivas sobre `tecnocom180`.

3\. No copiar ni modificar credenciales de producción para hacer pruebas.

4\. No iniciar una segunda API local conectada a MQTT real.

5\. Mantener separado el secreto JWT de desarrollo.

---

## 5. Flujo de desarrollo y Git

### Antes de modificar código

```powershell

git status --short

git branch --show-current

git log -1 --oneline

```

La rama utilizada en esta sesión fue:

```text

feature/postgresql-production

```

No asumir que seguirá siendo la rama correcta para siempre.

### Después de desarrollar

Comprobar TypeScript y las pruebas aplicables. En particular, el frontend utiliza TypeScript y Vite.

Revisar cambios:

```powershell

git diff --check

git status --short

git diff --stat

```

Agregar únicamente los archivos deseados:

```powershell

git add RUTA\_DEL\_ARCHIVO

```

Revisar el contenido preparado:

```powershell

git diff --cached --check

git diff --cached --stat

```

Crear commit:

```powershell

git commit -m "fix: descripcion del cambio"

```

Confirmar:

```powershell

git status --short

git log -1 --oneline

```

Subir a GitHub:

```powershell

git push origin feature/postgresql-production

```

**Ejemplo real de esta sesión:**

```text

3c0d9f2 fix: unify device online status and isolate development MQTT

```

---

## 6. Acceso al VPS Hostinger

Desde PowerShell:

```powershell

ssh tecnocom180@179.236.233.166

```

### Estructura comprobada

```text

/opt/tecnocom180/

├── .env

├── compose.yaml

├── app/

├── backups/

├── mosquitto/

└── postgres/

```

El repositorio Git se encuentra en:

```text

/opt/tecnocom180/app

```

El archivo `/opt/tecnocom180/.env` corresponde a la configuración principal de Docker Compose.

La API utiliza otro archivo:

```text

/opt/tecnocom180/app/.env

```

**No confundir ambos archivos.**

---

## 7. Actualizar el código en el VPS

Una vez que el commit esté publicado en GitHub:

```bash

cd /opt/tecnocom180/app

git status --short

git branch --show-current

git log -1 --oneline

```

Verificar que no existan cambios locales pendientes.

Después:

```bash

git pull --ff-only origin feature/postgresql-production

```

Confirmar:

```bash

git log -1 --oneline

```

**Importante:** `git pull` actualiza el código fuente, pero no reinicia automáticamente la API ni recompila el frontend.

---

## 8. Servicios de producción

### Docker

El archivo principal es:

```text

/opt/tecnocom180/compose.yaml

```

En la sesión del 20 de octubre de 2026 contenía únicamente:

- PostgreSQL 18

- Mosquitto MQTT

Contenedores comprobados:

```text

tecnocom180-postgres

tecnocom180-mosquitto

```

Consultar estado:

```bash

docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

```

Puertos observados:

| Servicio | Puerto |

|---|---|

| PostgreSQL | `127.0.0.1:5432` |

| Mosquitto sin TLS | `127.0.0.1:1883` |

| Mosquitto TLS | `8883` |

**No ejecutar `docker compose up -d --build` esperando actualizar la API o el frontend.** Ninguno de los dos estaba definido en ese Compose.

### API

Servicio systemd:

```text

tecnocom180-api.service

```

Consultar:

```bash

systemctl is-active tecnocom180-api.service

```

Consultar definición:

```bash

systemctl show tecnocom180-api.service -p ExecStart -p WorkingDirectory --no-pager

```

**Arranque comprobado:**

```text

/usr/bin/node

  --dns-result-order=ipv4first

  --env-file=/opt/tecnocom180/app/.env

  /opt/tecnocom180/app/node\_modules/tsx/dist/cli.mjs

  /opt/tecnocom180/app/apps/api/src/index.ts

```

Directorio de trabajo:

```text

/opt/tecnocom180/app

```

La API ejecuta directamente TypeScript mediante `tsx`.

Por ello, para los cambios de código de esta sesión **no fue necesaria una compilación JavaScript previa**.

---

## 9. Procedimiento de actualización de la API

Antes del reinicio:

1\. Confirmar que el código está actualizado.

2\. Comprobar dependencias.

3\. Revisar cambios de configuración.

4\. Confirmar que no existan migraciones pendientes.

Comprobar dependencias:

```bash

cd /opt/tecnocom180/app

npm ls tsx mqtt --depth=0

```

Versiones observadas:

```text

mqtt@5.15.2

tsx@4.19.4

```

### MQTT en desarrollo y producción

La implementación del commit `3c0d9f2` utiliza:

```text

MQTT\_ENABLED=false → MQTT deshabilitado

MQTT\_ENABLED ausente → MQTT habilitado

```

En producción se verificó que `MQTT\_ENABLED` no estaba definido.

Para comprobarlo sin mostrar secretos:

```bash

grep '^MQTT\_ENABLED=' .env | sed 's/=.*/=<configurado>/'

```

### Reiniciar únicamente la API

```bash

sudo systemctl restart tecnocom180-api.service

```

Verificar:

```bash

systemctl is-active tecnocom180-api.service

```

Consultar registros:

```bash

sudo journalctl -u tecnocom180-api.service -n 40 --no-pager

```

### Resultado comprobado el 20 de octubre

```text

TECNOCOM180 API running on http://127.0.0.1:3000

MQTT conectado a HiveMQ Cloud

MQTT suscrito a +/sensores/

MQTT suscrito a +/status

MQTT suscrito a +/diagnostics/result

```

También se recibieron mensajes del agente:

```text

TC180-AG-000001/status

```

Con una periodicidad aproximada de 30 segundos.

**Observación:** durante el reinicio, systemd registró `status=143` para el proceso anterior, pero el proceso nuevo inició correctamente. No confundir ese evento aislado con una falla persistente.

---

## 10. Actualización del frontend React

Nginx sirve el frontend desde:

```text

/opt/tecnocom180/app/apps/web/dist

```

Dominio:

```text

https://app.tecnocom180.com

```

El API proxy utiliza:

```text

https://api.tecnocom180.com

    ↓

http://127.0.0.1:3000

```

### Compilar frontend

En el VPS:

```bash

cd /opt/tecnocom180/app

npm run build --workspace @tecnocom180/web

```

El comando ejecuta:

```text

tsc -b \&\& vite build

```

Resultado real de la sesión:

```text

vite v8.2.1

✓ 51 modules transformed.

✓ built in 397ms

```

El resultado se escribe en `apps/web/dist`.

**No fue necesario reiniciar Nginx**, porque ya estaba configurado para servir esa carpeta.

### Validación posterior

Abrir:

`https://app.tecnocom180.com`

Forzar recarga:

```text

Ctrl + Shift + R

```

Comprobar las pantallas modificadas y las solicitudes a la API.

---

## 11. Reglas Online/Offline implementadas

El commit `3c0d9f2` incorporó una función compartida:

```text

apps/web/src/utils/deviceStatus.ts

```

La utilizan:

```text

DashboardPage.tsx

DevicesPage.tsx

```

### Umbrales

| Tipo | Tiempo máximo sin comunicación |

|---|---|

| AGENT | 90 segundos |

| IOT | 5 horas |

Para los agentes se requiere además el estado `online` y una comunicación reciente.

Para IoT se utiliza la fecha de última comunicación, con respaldo en la telemetría disponible.

Esto evita que un dispositivo permanezca visualmente Online indefinidamente después de dejar de reportar.

**Estado de validación:** código compilado y publicado en producción. La comprobación visual final de ambos módulos quedó pendiente de confirmación explícita del usuario.

---

## 12. Procedimiento abreviado para futuros despliegues

### A. Windows

```powershell

cd "C:\Users\Miguel Angel\tecnocom180-platform"

git status --short

git branch --show-current

# Desarrollar y probar cambios

git diff --check

git add RUTAS\_DE\_ARCHIVOS

git diff --cached --check

git commit -m "tipo: descripcion"

git push origin feature/postgresql-production

```

### B. VPS

```bash

ssh tecnocom180@179.236.233.166

```

```bash

cd /opt/tecnocom180/app

git status --short

git pull --ff-only origin feature/postgresql-production

git log -1 --oneline

```

### C. Si cambió la API

Verificar dependencias, variables y migraciones.

```bash

sudo systemctl restart tecnocom180-api.service

systemctl is-active tecnocom180-api.service

sudo journalctl -u tecnocom180-api.service -n 40 --no-pager

```

### D. Si cambió el frontend

```bash

cd /opt/tecnocom180/app

npm run build --workspace @tecnocom180/web

```

Después validar en el navegador.

### E. Verificación final

```bash

docker ps

systemctl is-active tecnocom180-api.service

systemctl is-active nginx.service

```

Comprobar adicionalmente la conectividad de la API, los mensajes MQTT y las funcionalidades afectadas.

---

## 13. Casos especiales: no aplicar el procedimiento abreviado sin revisión

El procedimiento anterior funcionó porque los cambios eran principalmente de código y presentación.

**Requieren pasos adicionales:**

- Modificaciones al esquema Prisma o migraciones PostgreSQL.

- Cambios en dependencias de Node.js.

- Modificaciones de `.env`.

- Cambios de permisos o autenticación.

- Actualizaciones del broker MQTT.

- Cambios en certificados TLS.

- Modificaciones de Nginx.

- Cambios en Docker Compose.

- Alteraciones de tópicos MQTT o del formato de telemetría.

Para migraciones de base de datos, primero preparar respaldo y plan de reversión. No ejecutar comandos destructivos directamente sobre producción.

---

## 14. Referencia del despliegue del 20 de octubre de 2026

**Commit anterior del VPS:**

```text

51d60c7 allow production frontend origin in CORS

```

**Commit actualizado:**

```text

3c0d9f2 fix: unify device online status and isolate development MQTT

```

**Archivos modificados:**

```text

apps/api/src/services/mqtt.ts

apps/web/src/pages/DashboardPage.tsx

apps/web/src/pages/DevicesPage.tsx

apps/web/src/utils/deviceStatus.ts

```

**Operaciones completadas:**

- Commit local.

- Push a GitHub.

- Pull fast-forward en Hostinger.

- Verificación de dependencias.

- Reinicio de la API.

- Confirmación de conexión HiveMQ Cloud.

- Confirmación de mensajes del agente.

- Compilación exitosa del frontend.

**No se modificaron directamente:**

- Base de datos PostgreSQL.

- Contenedor Mosquitto.

- Configuración de Nginx.

- Certificados TLS.

---

## 15. Instrucción final para futuras sesiones

Cuando el usuario diga:

**«Vamos a actualizar TECNOCOM180»**

No volver a reconstruir la arquitectura desde cero.

Primero consultar esta guía, verificar la rama, el estado del repositorio y la naturaleza del cambio.

Después determinar si corresponde actualizar:

- Solo frontend.

- Solo API.

- API y frontend.

- Infraestructura o base de datos.

**Principio operativo:** desarrollo local, pruebas aisladas, control de versiones, despliegue selectivo y verificación posterior.

El objetivo es mantener TECNOCOM180 funcionando mientras la plataforma evoluciona.

---

## 16. Auditoría de producción y despliegue de alertas IoT — octubre de 2026

### 16.1 Arquitectura comprobada

- VPS Ubuntu: `/opt/tecnocom180`.
- Repositorio de la aplicación: `/opt/tecnocom180/app`.
- Rama de despliegue: `feature/postgresql-production`.
- API Node.js ejecutada mediante `tecnocom180-api.service` (systemd).
- PostgreSQL 18 en contenedor `tecnocom180-postgres`.
- Mosquitto en contenedor `tecnocom180-mosquitto`.
- Base de producción: `tecnocom180`.
- Base de pruebas: `tecnocom180_test`.
- Archivo de configuración de la API: `/opt/tecnocom180/app/.env`.

La API no se despliega mediante Docker Compose de producción.
Docker Compose administra PostgreSQL y Mosquitto.

No asumir que actualizar el repositorio publica automáticamente el frontend.
Verificar por separado el mecanismo de publicación web.

### 16.2 Verificación previa de Git

En Windows:

```powershell
git fetch origin
git status -sb
git log -5 --oneline
git push origin feature/postgresql-production
```

En el VPS, antes de actualizar:

```bash
cd /opt/tecnocom180/app
git fetch origin
git status --short
git log --oneline HEAD..origin/feature/postgresql-production
git diff --stat HEAD..origin/feature/postgresql-production
```

No actualizar si existen cambios locales sin revisar.

### 16.3 Punto de retorno y respaldo

Antes del despliegue, registrar el commit actual y crear un tag de retorno.

Referencia del 23 de octubre de 2026:

- Versión anterior: `3c0d9f2`.
- Tag: `predeploy-20261023`.
- Versión candidata: `696bfac`.

Respaldar exclusivamente la base de producción `tecnocom180`:

```bash
mkdir -p /opt/tecnocom180/backups/postgres
FECHA=$(date +%Y%m%d-%H%M%S)

docker exec tecnocom180-postgres \
  pg_dump -U tecnocom180_app -d tecnocom180 -Fc \
  > "/opt/tecnocom180/backups/postgres/tecnocom180-predeploy-${FECHA}.dump"
```

Comprobar que `pg_dump` terminó correctamente y verificar el respaldo.

El VPS no tiene necesariamente `pg_restore` instalado. Podemos utilizar PostgreSQL 18 en Docker:

```bash
BACKUP=$(ls -t /opt/tecnocom180/backups/postgres/tecnocom180-predeploy-*.dump | head -1)

ls -lh "$BACKUP"

docker run --rm \
  -v "$BACKUP:/backup.dump:ro" \
  postgres:18 \
  pg_restore --list /backup.dump
```

La lectura del catálogo es una verificación inicial, no una restauración completa.

Respaldo comprobado inicialmente durante esta auditoría:

`/opt/tecnocom180/backups/postgres/tecnocom180-predeploy-20261023-235112.dump`

### 16.4 Migraciones PostgreSQL y Prisma

Antes de ejecutar migraciones:

1. Examinar los archivos SQL.
2. Confirmar el historial registrado en `_prisma_migrations`.
3. Verificar la base de datos destino.
4. Tener respaldo y procedimiento de recuperación.
5. Confirmar que `prisma.config.ts` utiliza el entorno correcto.

Consultar el historial de producción:

```bash
docker exec tecnocom180-postgres \
  psql -U tecnocom180_app -d tecnocom180 \
  -c 'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC;'
```

Al momento de esta auditoría, producción solamente tenía aplicada:

`20261002000100_postgresql_baseline`

Se identificaron cinco migraciones pendientes para:

- `DeviceAlertConfig`
- `DeviceDiagnosticEvent`
- `DeviceAlert`
- `AlertNotification`
- Restricciones de unicidad y bloqueo del trabajador de notificaciones.

Las cinco migraciones revisadas eran aditivas, sin eliminación de tablas ni columnas existentes.

**No ejecutar `prisma migrate deploy` hasta confirmar la conexión efectiva a `tecnocom180`.**

### 16.5 MQTT y Telegram

En la versión candidata:

- MQTT funciona salvo que `MQTT_ENABLED` sea exactamente `"false"`.
- MQTT requiere `MQTT_BROKER_URL`, `MQTT_USERNAME` y `MQTT_PASSWORD`.
- Telegram automático solamente arranca cuando `TELEGRAM_NOTIFICATIONS_ENABLED` es exactamente `"true"`.

En el VPS, ambas banderas estaban ausentes durante la auditoría. Por ello, MQTT debía arrancar y Telegram automático permanecer deshabilitado.

La existencia de `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` no habilita por sí sola el trabajador automático.

Antes de activar Telegram para clientes, verificar los destinatarios por organización, sitio y dispositivo, así como las notificaciones pendientes.

No mostrar valores sensibles del archivo `.env`.

### 16.6 Verificación posterior al despliegue

Comprobar:

- Estado de `tecnocom180-api.service`.
- PostgreSQL y Mosquitto operativos.
- Recepción real de telemetría MQTT.
- Endpoints de configuración de alertas.
- Permisos y aislamiento por organización.
- Compilación y publicación del frontend.
- Estado del trabajador Telegram y destinatarios.

### 16.7 Recuperación

Un rollback de Git **no revierte migraciones de PostgreSQL**.

Restaurar una base de datos puede sobrescribir información recibida después del respaldo; requiere un procedimiento específico y una decisión explícita.

No reiniciar PostgreSQL ni Mosquitto como parte de una actualización ordinaria de la API, salvo que exista una necesidad comprobada.

### 16.8 Estado al 23 de octubre de 2026

- Auditoría preliminar completada.
- Respaldo generado y catálogo verificado.
- Tag de retorno creado.
- Código candidato publicado en GitHub.
- Despliegue de la nueva versión pendiente.
- Pendiente verificar `prisma.config.ts`, dependencias y ejecución controlada de migraciones.
## 17. Despliegue a producción del 24 de octubre de 2026

### 17.1 Resultado del despliegue

**Estado: DESPLEGADO Y VALIDADO**

- Commit desplegado: `db3ce46`.
- Rama: `feature/postgresql-production`.
- API: Node.js 24, ejecutada mediante systemd.
- Frontend: React/Vite servido mediante Nginx.
- Base de datos: PostgreSQL 18.
- MQTT: conectado a HiveMQ Cloud.
- Telegram automático: deshabilitado.

Se validaron el inicio de sesión, la recepción de telemetría, la configuración de alertas y la persistencia en PostgreSQL.

### 17.2 Arquitectura utilizada

API activa:

`/opt/tecnocom180/releases/db3ce46`

Servicio:

`tecnocom180-api.service`

Archivo de configuración de producción:

`/opt/tecnocom180/app/.env`

Frontend publicado:

`/opt/tecnocom180/app/apps/web/dist`

Esta última ruta es un enlace simbólico hacia:

`/opt/tecnocom180/releases/db3ce46/apps/web/dist`

Nginx utiliza dos dominios principales:

- `api.tecnocom180.com`: API Express mediante proxy hacia `127.0.0.1:3000`.
- `app.tecnocom180.com`: frontend React.

PostgreSQL y Mosquitto continúan ejecutándose en Docker. El broker MQTT utilizado por la API durante este despliegue sigue siendo HiveMQ Cloud.

### 17.3 Preparación de versiones

Se utilizó Git Worktree para preparar la nueva versión sin modificar el repositorio anterior.

Comando de referencia:

```bash
git fetch origin

git worktree add --detach \
  /opt/tecnocom180/releases/db3ce46 \
  db3ce46
```

Posteriormente:

```bash
cd /opt/tecnocom180/releases/db3ce46

npm ci

npm audit --audit-level=high
```

Resultado: cero vulnerabilidades reportadas.

### 17.4 Generación Prisma y compilación

Generar Prisma Client:

```bash
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:5432/tecnocom180_test?schema=public' \
  ./node_modules/.bin/prisma generate
```

Compilar la API:

```bash
npm run build --workspace=@tecnocom180/api
```

Para consultar las migraciones pendientes utilizando la configuración real de producción:

```bash
node --env-file=/opt/tecnocom180/app/.env \
  ./node_modules/prisma/build/index.js migrate status
```

Se identificaron cinco migraciones pendientes y se revisó previamente su contenido SQL.

### 17.5 Respaldo y migraciones

Respaldo final anterior al despliegue:

`/opt/tecnocom180/backups/postgres/tecnocom180-final-20261024-005337.dump`

El archivo se verificó inicialmente mediante `pg_restore --list` usando Docker PostgreSQL 18.

Durante la ventana de mantenimiento se detuvo únicamente la API.

Se ejecutó:

```bash
cd /opt/tecnocom180/releases/db3ce46

node --env-file=/opt/tecnocom180/app/.env \
  ./node_modules/prisma/build/index.js migrate deploy
```

Resultado:

**All migrations have been successfully applied.**

Se aplicaron las cinco migraciones correspondientes a alertas, diagnósticos, notificaciones y bloqueo del trabajador Telegram.

No se reiniciaron PostgreSQL ni Mosquitto.

### 17.6 Actualización de systemd

Se respaldó la unidad anterior:

`/etc/systemd/system/tecnocom180-api.service.predeploy-20261023`

La unidad nueva utiliza:

```ini
WorkingDirectory=/opt/tecnocom180/releases/db3ce46

ExecStart=/usr/bin/node --dns-result-order=ipv4first --env-file=/opt/tecnocom180/app/.env /opt/tecnocom180/releases/db3ce46/node_modules/tsx/dist/cli.mjs /opt/tecnocom180/releases/db3ce46/apps/api/src/index.ts
```

Después del cambio se ejecutaron:

```bash
sudo systemctl daemon-reload
sudo systemctl reset-failed tecnocom180-api.service
sudo systemctl start tecnocom180-api.service
```

La nueva API arrancó correctamente.

La interrupción observada entre los eventos de parada y arranque del servicio fue de aproximadamente 1 minuto y 55 segundos.

### 17.7 Requisito crítico: VITE_API_URL

**IMPORTANTE PARA TODOS LOS DESPLIEGUES FUTUROS**

El frontend utiliza:

`import.meta.env.VITE_API_URL`

Esta variable debe definirse durante la compilación de producción.

Comando correcto:

```bash
cd /opt/tecnocom180/releases/db3ce46

VITE_API_URL=https://api.tecnocom180.com \
  npm run build --workspace=@tecnocom180/web
```

Si se omite, el navegador puede enviar solicitudes incorrectas como:

`https://app.tecnocom180.com/undefined/auth/login`

Esto produce:

**HTTP 405 Method Not Allowed — Nginx**

El error se corrigió reconstruyendo el frontend con `VITE_API_URL` configurada.

La compilación corregida generó:

`index-BjVa4hnL.js`

Se verificó su publicación mediante una solicitud HTTP al dominio `app.tecnocom180.com`.

**Nunca publicar un frontend sin verificar primero esta variable.**

### 17.8 Publicación del frontend

Nginx sirve:

`/opt/tecnocom180/app/apps/web/dist`

El frontend anterior se conservó en:

`/opt/tecnocom180/app/apps/web/dist-predeploy-20261024`

También se creó un respaldo independiente:

`/opt/tecnocom180/backups/web/frontend-predeploy-20261024-011525`

La publicación se realizó usando un enlace simbólico hacia el directorio `dist` de la nueva versión.

Para futuros despliegues, preparar el directorio y validar la compilación antes de cambiar el enlace. Evitar reconstruir directamente un `dist` que ya esté publicado; preparar primero una compilación independiente para realizar el cambio con la menor interrupción posible.

### 17.9 Verificaciones finales

Se comprobó:

- API activa y respondiendo solicitudes HTTP.
- Login funcional con `SUPER_ADMIN`.
- MQTT conectado a HiveMQ Cloud.
- Agente Raspberry `TC180-AG-000001` reportando ONLINE.
- Recepción y persistencia de telemetría de dispositivos IoT.
- Formulario **Configurar alertas** visible y funcional.
- Guardado de umbrales mediante la API.
- Persistencia de umbrales en PostgreSQL.
- Telegram automático deshabilitado.

Dispositivos cuya telemetría posterior al despliegue fue comprobada:

- `TC180-000001`
- `TC180-000003`
- `TC180-000005`
- `TC180-000006`

Se realizó una prueba de modificación de umbrales sobre `TC180-000005`, y después fueron restaurados a:

- Nivel bajo: 20 %.
- Recuperación: 25 %.
- Alertas habilitadas: `true`.

Los valores restaurados se verificaron directamente en PostgreSQL.

### 17.10 Pendientes

1. Implementar destinatarios Telegram por organización, sitio y, cuando corresponda, dispositivo.
2. Validar la generación y resolución de alertas mediante telemetría real.
3. Revisar las notificaciones pendientes antes de habilitar el trabajador Telegram.
4. Completar las pruebas de recuperación de respaldo PostgreSQL en un entorno aislado.
5. Planificar la migración definitiva de HiveMQ Cloud a Mosquitto propio.
6. Incorporar diagnósticos Edge de Wi-Fi, MQTT y sensores.

**Conclusión:** el despliegue `db3ce46` quedó funcionando en producción, con API, frontend, PostgreSQL y telemetría validados. Las notificaciones Telegram automáticas siguen deshabilitadas hasta implementar el aislamiento de destinatarios.