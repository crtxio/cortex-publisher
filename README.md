[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/crtxio/cortex-publisher)


## Prerequisites
- __Must have KV namespaces created__
  - RESOLVER
  - RESOLVER-PREVIEW
  - ZONES
  - ZONES-PREVIEW
- __Must have Github Actions environment secrets populated__
  - CLOUDFLARE_API_TOKEN: The API token used to deploy to your cloudflare account. For more information on how to create and use API tokens please visit []
  - CLOUDFLARE_ACCOUNT_ID: The ID of your CloudFlare account.
  - CLOUDFLARE_ZONE_ID: The Zone ID of the domain you wish to target
  - CLOUDFLARE_ROUTE_PATTERN: The pattern of the route you wish to use for your worker. Example: press.crtx.one/*
  - RESOLVER_KV_ID:
  - RESOLVER_KV_PREVIEW_ID:
  - ZONES_KV_ID:
  - ZONES_KV_PREVIEW_ID:
