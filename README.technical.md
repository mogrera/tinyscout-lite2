# GlucoEasy Technical Guide

This document is for developers and advanced users.  
If you only want to deploy and configure `xDrip+`, see [README.md](README.md).

Spanish version: see [README.technical.es.md](README.technical.es.md).

## Scope

GlucoEasy is a reduced glucose monitoring service designed to:

- accept `entries`
- accept `treatments`
- provide minimal `profile` compatibility
- expose a health/status page
- keep deployment small, simple, and inexpensive

Current limitations:

- it is not full Nightscout
- `treatments` delete support is minimal and mainly for client compatibility
- it does not keep full profile history
- `devicestatus` is exposed as an empty collection for compatibility

## Design Intent

The goal is not to replace every Nightscout feature.

The goal is to preserve the Nightscout API surface that many existing apps and integrations already understand, while keeping operations dramatically simpler.

## Environment Variables

- `API_SECRET`: optional manual secret override
- `READ_PUBLIC`: `true` in this configuration
- `MAX_ENTRIES`: `2000` by default
- `HEALTH_REFRESH_SECONDS`: `30` by default, minimum effective value `5`

## Main Endpoints

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

## Profile Support

Current profile support includes:

- `GET /api/v1/profile/current`
- `GET /api/v1/profile`
- `POST /api/v1/profile`
- `PUT /api/v1/profile`

## Secret Management

On first visit, GlucoEasy can generate a 6-character `API_SECRET` automatically and show it once.

If you need to manage the secret manually, set `API_SECRET` yourself in the Cloudflare Worker configuration.

## Local Development

```bash
npm install
npm run test
npm run dev
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
