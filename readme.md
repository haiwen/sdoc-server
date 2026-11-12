# SDoc server
> A sync op server for sdoc-editor

## Locale test

1. Create a folder called "config"
2. Create a new config.json file under the folder config
3. Add configuration content
```
{
  "seahub_service_url": "http://127.0.0.1:8000", // optional, default is http://127.0.0.1:8000
  "server_port": 7070,
  "save_interval": 10000,
  "private_key": "M@O8VWUb81YvmtWLHGB2I_V7di5-@0p(MF*GrE!sIws23F",
  "host": "db",
  "user": "root",
  "password": "db_dev",
  "database": "seahub",
  "port": "3306",
  "connection_limit": 5
}

```

**Development test**
```
> npm run start
```

**Deployment test**
```
> npm run build
> npm run serve
```

## HTTP request limits

Node.js 16 or newer is required. HTTP requests are limited before body parsing and
authentication. The default is 600 requests per client IP per 60 seconds. Requests
over the limit receive HTTP 429, a `Retry-After` header and
`{"error_code":"rate_limit_exceeded"}`. CORS preflight requests do not consume the limit.

These settings can be supplied in the JSON configuration file or overridden by
environment variables:

| JSON setting | Environment variable | Default |
| --- | --- | --- |
| `rate_limit_window_ms` | `RATE_LIMIT_WINDOW_MS` | `60000` |
| `rate_limit_max` | `RATE_LIMIT_MAX` | `600` |
| `trust_proxy` | `TRUST_PROXY` | `false` |

The window and request count must be positive integers. Behind a reverse proxy,
set `trust_proxy` to its IP addresses or CIDRs (for example, `"loopback"` for a local
proxy). The proxy must overwrite the client forwarding headers. Without this
setting, requests forwarded by the same proxy share one limit. Counters are stored
in each server process; deployments with multiple instances need a shared limiter
at the reverse proxy for an aggregate limit. Socket.IO traffic uses a separate
request handler and is outside this HTTP limit.

Seahub API requests do not follow redirects. Set `seahub_service_url` (or
`SEAHUB_SERVICE_URL`) to the final Seahub service URL.

Operation-log queries use MySQL prepared statements through `mysql2`.
