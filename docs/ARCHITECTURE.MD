# TECNOCOM180 Platform Architecture

## Visión

TECNOCOM180 Platform es una plataforma modular orientada a la administración de la infraestructura tecnológica de hoteles.

Su diseño está basado en módulos independientes que comparten un núcleo común, permitiendo incorporar nuevas funcionalidades sin modificar la arquitectura principal.

---

# Principios de diseño

La plataforma se desarrolla siguiendo los siguientes principios:

* Arquitectura modular.
* Independencia del fabricante de infraestructura.
* Separación entre interfaz, lógica de negocio e integración.
* Escalabilidad.
* Bajo mantenimiento.
* Despliegue sencillo mediante Docker.
* Administración remota.

---

# Arquitectura general

```text
                   Frontend (React)
                           │
                           ▼
                    REST API (Express)
                           │
                 ┌─────────┴─────────┐
                 │                   │
                 ▼                   ▼
           Core Services        Event System
                 │
        ┌────────┴────────┐
        ▼                 ▼
     Database         WiFi Providers
```

---

# Componentes

## Frontend

Aplicación web utilizada por:

* Recepción
* Técnicos
* Administradores del hotel
* Administradores TECNOCOM180

Funciones:

* Dashboard
* Guest Access
* Tickets
* Analytics
* Diagnostics
* Configuración

---

## API

La API es el punto central de comunicación.

Responsabilidades:

* Autenticación
* Autorización
* Validaciones
* Reglas de negocio
* Comunicación con la base de datos
* Comunicación con proveedores WiFi

---

## Core Services

Implementan la lógica del negocio.

Ejemplos:

* Guest Access
* Ticket Manager
* Analytics
* Diagnostics
* Inventory
* Health Monitor

Los módulos nunca interactúan directamente entre sí; utilizan servicios compartidos y eventos.

---

# Base de datos

Inicialmente:

SQLite

Futuro:

PostgreSQL

El acceso se realizará mediante Prisma ORM para mantener independencia del motor de base de datos.

---

# Sistema de eventos

Toda acción importante genera un evento.

Ejemplos:

* ROOM_OCCUPIED
* ACCESS_CREATED
* DEVICE_REGISTERED
* DEVICE_AUTHORIZED
* DEVICE_REVOKED
* ACCESS_FINISHED
* TICKET_CREATED
* TICKET_CLOSED

Estos eventos permitirán:

* Auditoría
* Estadísticas
* Reportes
* Diagnóstico

---

# WiFi Providers

La plataforma nunca dependerá de un fabricante específico.

Cada integración implementará una interfaz común.

Ejemplos:

* TP-Link Omada
* Ubiquiti UniFi
* Aruba
* MikroTik
* RADIUS

La lógica del sistema nunca interactúa directamente con las APIs de los fabricantes.

---

# Estructura del proyecto

```text
tecnocom180-platform/

apps/
    api/
    web/

packages/
    core/
    wifi-sdk/
    shared/

database/

docker/

docs/

scripts/
```

---

# Módulos actuales

## Guest Access

Control de acceso WiFi para huéspedes.

---

## Ticket Manager

Gestión de incidencias.

---

## Analytics

Indicadores y estadísticas.

---

## Diagnostics

Herramientas de diagnóstico de infraestructura.

---

## Health Monitor

Monitoreo del servidor.

---

## Inventory

Inventario de infraestructura.

---

# Roles

* ADMIN_TECNOCOM180
* ADMIN_HOTEL
* RECEPTION
* TECHNICIAN

Cada rol visualizará únicamente los módulos y acciones que le correspondan.

---

# Filosofía del proyecto

TECNOCOM180 Platform no busca reemplazar los controladores WiFi, los PMS ni los sistemas de acceso existentes.

Su objetivo es integrarlos bajo una plataforma única que facilite la operación diaria del hotel y proporcione herramientas de administración, diagnóstico y soporte técnico desde una sola interfaz.

---

# Estado del documento

Versión: 0.1

Este documento evolucionará conforme la plataforma incorpore nuevos módulos y capacidades.
