# SDoc server
> A sync op server for sdoc-editor

## Locale test

1. Create a folder called "config"
2. Create a new config.json file under the folder config
3. Add configuration content
```
  {
    "seahub_service_url": "http://127.0.0.1:80", // optional, default is http://127.0.0.1:80
    "server_port": 7070,  // optional, default is 7070
    "save_interval": 300000, // optional, default is 5 min
    "private_key": "", // required
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