# Deployment

The dashboard is served by Cloudflare Pages at `https://btc-elliott.allisson.dev`. A tag
`v<version>` on `main` runs `.github/workflows/release.yml`, which tests and builds once, uploads
that build and checks the served files against it. Nothing else deploys: no Git integration is
connected, and Cloudflare never builds the app.

## Release

1. Bump `version` in `package.json` and merge to `main`.
2. Tag the merge commit `v<version>` and push the tag.

The workflow fails if the tag is not `v` + the `package.json` version, or if the tagged commit is
not on `main`.

| Job | What it does |
| --- | --- |
| `build` | No secrets. `bun run test`, `bun run build`, then a `sha256sum` manifest of `dist/` (without `_headers`, which Pages consumes) uploaded with the build. |
| `deploy` | Environment `cloudflare-pages`. Checks `ORIGIN`, then `wrangler pages deploy` of the uploaded build to the production branch `main`. |
| `verify` | Waits until the served `/` matches the build's `index.html`, checks every served file against the manifest, and checks the CSP and `nosniff` headers. It never calls Binance: GitHub's runners get HTTP 451 from it. |

Live data and the console are checked in a browser after each release.

## Security headers

`public/_headers` sets the CSP, `nosniff`, `Referrer-Policy: no-referrer`, `no-cache` on the HTML
and a one-year immutable cache on `/assets/*`.

- `connect-src` allows only `https://api.binance.com` and `wss://stream.binance.com:9443`, the
  bases in `src/config.ts`. Changing either needs the CSP changed too.
- `style-src` allows one hash: the `<style>` Lightweight Charts 5.3.0 injects for its attribution
  logo. After upgrading the library, open the deployed page and look for a CSP error in the
  console; the browser prints the new hash.

`wrangler pages dev dist` serves a build with `_headers` applied, so the CSP can be checked
locally before a release.

## Cloudflare

| Resource | Setting |
| --- | --- |
| Pages project | `btc-elliott-dashboard`, created by `wrangler pages project create btc-elliott-dashboard --production-branch main --force`, with no Git integration, so its creation deployed nothing. `--force` stops wrangler from handing a new project to Workers when it detects an AI agent. |
| Production branch | `main`. The release deploys with `--branch=main`; any other branch would be a preview. |
| Custom domain | `btc-elliott.allisson.dev`, a proxied CNAME to `btc-elliott-dashboard.pages.dev`. |
| Preview access | Restricted: a Cloudflare Access application on `*.btc-elliott-dashboard.pages.dev` admits only the account owner. It does not cover `btc-elliott-dashboard.pages.dev`. |
| `pages.dev` redirect | An account Bulk Redirect: `btc-elliott-dashboard.pages.dev/` to `https://btc-elliott.allisson.dev/`, 301, with subpath matching and the path suffix and query string kept. Include subdomains is off, so previews stay behind Access. Added only after the first release's check passed, which it would otherwise have followed. |
| API token | The account permission Cloudflare Pages Edit, on this account only, no IP filter, no expiry. |

The zone `allisson.dev` keeps every setting that rewrites responses off (Rocket Loader, Email
Address Obfuscation, Automatic HTTPS Rewrites, Auto Minify): `verify` compares the served files
byte for byte with the build.

## GitHub

The environment `cloudflare-pages` allows only tags `v*` and holds:

| Name | Kind | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | the token above |
| `CLOUDFLARE_ACCOUNT_ID` | secret | the account ID |
| `ORIGIN` | variable | `https://btc-elliott.allisson.dev` |

The workflow accepts no other `ORIGIN` than that one or `https://btc-elliott-dashboard.pages.dev`.

## Rotating the token

Create a token with the same permission, store it with
`gh secret set CLOUDFLARE_API_TOKEN --env cloudflare-pages --repo allisson/btc-elliott-dashboard`,
then delete the old one in the dashboard. The value never goes through a chat or a file in the
repo.
