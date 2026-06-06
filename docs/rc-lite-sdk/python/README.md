# RC Lite Python SDK (scaffold)

Generate a Thin HTTP client via `openapi-python-generator` targeting `docs/openapi/rc-lite-v1.openapi.yaml`.

Suggested layout:

```
rc_lite_sdk/
  __init__.py
  client.py   # wraps httpx with tenant + key scopes
pyproject.toml
```
