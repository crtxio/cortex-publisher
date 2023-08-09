# [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/crtxio/cortex-publisher)

# Cortex-Publisher
Cortex Publisher is deployed to cloudflare using cloudflare workers. Visit the official docs for more information on [Cloudflare Workers](https://developers.cloudflare.com/workers/).

## Prerequisites

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).

2. Create the following KV namespaces in your cloudflare account.

    - RESOLVER
    - RESOLVER-PREVIEW
    - ZONES
    - ZONES-PREVIEW

   To create these, you must have installed Wrangler from Step 1 and then run the following commands in your console.

```console
    wrangler kv:namespaces create "RESOLVER"
    wrangler kv:namespaces create "RESOLVER" --preview
    wrangler kv:namespaces create "ZONE"
    wrangler kv:namespaces create "ZONE" --preview

```

3. Configure github actions with the following secrets in your repository. Visit the official Github docs on how to use environment variables and secrets at [Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets).

    - __*CLOUDFLARE_API_TOKEN*__: The API token associated to your cloudflare account. For more information on how create and use API tokens for use in CI/CD please visit [Create a Cloudflare API token](https://developers.cloudflare.com/workers/wrangler/ci-cd/#create-a-cloudflare-api-token).
    - __*CLOUDFLARE_ACCOUNT_ID*__: The ID of your Cloudflare account.
    - __*CLOUDFLARE_ZONE_ID*__: The Zone ID of the domain you wish to target.
    - __*CLOUDFLARE_ROUTE_PATTERN*__: The pattern of the route you wish to use for your worker. Example: hello.example.come/*
    - __*RESOLVER_KV_ID*__: The ID of the RESOLVER KV you created in Step 1
    - __*RESOLVER_KV_PREVIEW_ID*__: The ID of the RESOLVER_PREVIEW KV you created in Step 1.
    - __*ZONES_KV_ID*__: The ID of the ZONES KV you create in Step 1.
    - __*ZONES_KV_PREVIEW_ID*__: The ID of the ZONES-PREVIEW KV you created in Step 1.
