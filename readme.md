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

SDoc 2.0 continues to load document and whiteboard content using download links
returned by the authenticated Seahub API. The file server may use a different
origin. These links must use HTTP or HTTPS without embedded credentials; content
downloads do not follow redirects or receive the Seahub authorization token.

Operation-log queries use MySQL prepared statements through `mysql2`.

## Socket.IO document authorization

Collaboration connections require an HS256 token with a non-empty `file_uuid` and
`username`, a finite `exp`, and permission `r` or `rw`. Existing Seahub browser
tokens remain supported. Tokens marked `token_type: service` are reserved for
server-to-server requests and cannot open collaboration connections.

Each connection is bound to the document and identity in its token. Legacy event
payloads may include `doc_uuid`, but a different UUID is rejected before any
document access or broadcast. Omitting it uses the authenticated document.
Connection middleware validates the token once; native `socket.use` middleware
checks each incoming event against an explicit read/write permission map.
Token expiration is checked when each event arrives. Authorized events do not
recheck expiration during execution; validated token claims remain frozen.
After asynchronous operations, disconnected sockets do not rejoin rooms or
receive replies. Successful edits are still broadcast to online collaborators
when the sender disconnects before the edit completes.
Room joins use the default in-memory adapter synchronously.
Unauthorized packets are acknowledged with an error when a callback is provided
and never reach the event listener. Unknown events are rejected.
Document and whiteboard edits require `rw`; read-only connections may join and
synchronize their own document. User identity and permissions come from the
token; the `user-updated` event may only change the display name.
Legacy `server-volatile-broadcast` messages are rejected; whiteboard edits must
use the versioned `elements-updated` event.

Connections are disconnected when their token expires, including idle readers
subscribed to room broadcasts. Clients must obtain a fresh Seahub token before
reconnecting after expiration. Internal download and read requests use read-only
service tokens; persistence retains write permission for authorized edits.
