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
