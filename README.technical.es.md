# Guía Técnica De GlucoEasy

Este documento es para desarrolladores y usuarios avanzados.  
Si solo quieres desplegarlo y configurarlo en `xDrip+`, consulta [README.es.md](README.es.md).

Version in English: see [README.technical.md](README.technical.md).

## Alcance

GlucoEasy es un servicio reducido de monitorización de glucosa diseñado para:

- aceptar `entries`
- aceptar `treatments`
- ofrecer compatibilidad mínima con `profile`
- exponer una página de `health` y estado
- mantener un despliegue pequeño, simple y barato

Limitaciones actuales:

- no es Nightscout completo
- el borrado de `treatments` es mínimo y busca sobre todo compatibilidad con clientes
- no guarda historial completo de perfiles
- `devicestatus` se expone como colección vacía por compatibilidad

## Intención Del Diseño

El objetivo no es reemplazar todas las funciones de Nightscout.

El objetivo es conservar la superficie de API de Nightscout que muchas apps e integraciones ya entienden, reduciendo al mismo tiempo la complejidad operativa al mínimo.

## Variables De Entorno

- `API_SECRET`: secreto manual opcional
- `READ_PUBLIC`: `true` en esta configuración
- `MAX_ENTRIES`: `2000` por defecto
- `HEALTH_REFRESH_SECONDS`: `30` por defecto, valor efectivo mínimo `5`

## Endpoints Principales

- `POST /api/v1/entries`
- `GET /api/v1/entries`
- `GET /api/v1/entries/current`
- `GET /api/v1/status.json`
- `POST /api/v1/treatments`
- `GET /api/v1/treatments`
- `DELETE /api/v1/treatments/:id`
- `GET /api/v1/profile/current`
- `GET /api/v1/profile`
- `POST /api/v1/profile`
- `PUT /api/v1/profile`
- `GET /api/v1/devicestatus`
- `GET /health`
- `GET /es/health`

## Soporte De Profile

El soporte actual de perfiles incluye:

- `GET /api/v1/profile/current`
- `GET /api/v1/profile`
- `POST /api/v1/profile`
- `PUT /api/v1/profile`

## Gestión Del Secreto

En la primera visita, GlucoEasy puede generar automáticamente un `API_SECRET` de 6 caracteres y mostrarlo una sola vez.

Si necesitas gestionarlo manualmente, define `API_SECRET` tú mismo en la configuración del Worker de Cloudflare.

## Desarrollo Local

```bash
npm install
npm run test
npm run dev
```

## Licencia

Este proyecto está licenciado bajo MIT. Consulta [LICENSE](LICENSE).
