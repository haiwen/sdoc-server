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
  "host": "localhost",
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