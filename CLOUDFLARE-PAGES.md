# Independent Cloudflare Pages asset target

This target serves `https://blogcdn.zhangdd.tech` for the independent blog at `https://blog.zhangdd.tech`.

Original repository assets remain at their original paths, unchanged. Seven oversized originals have smaller deployment-only copies under `.pages-assets/`. The builder copies only allowlisted public assets into `pages-dist/`, replacing those seven paths with their optimized copies. No Git metadata, README, PowerShell helpers, tests, optimization source copies, or other tooling is published.

## Build

Requires Node.js 20.19 or newer; validated with Node.js 24.19.0. No npm dependencies are required.

```sh
node --test tools/test-pages.mjs
node tools/build-pages.mjs
```

Upload only `pages-dist/`. Do not upload the repository root or `.pages-assets/` directly.

The build preserves original filenames and directory layout, retains the two SQL tutorial downloads already linked by the blog, and rewrites the font stylesheet to `./blog.woff2`. It creates a top-level 404 page so missing assets do not receive an SPA fallback. The static `_headers` permits cross-origin use of public assets, applies `nosniff`, and uses a one-hour cache lifetime because existing asset paths are mutable.

The build rejects symlinks, enforces Pages Free's 20,000-file and 25-MiB-per-asset limits, and enforces a 24-MiB safety ceiling for optimized replacements. Unmodified files already below 25 MiB are retained without needless recompression. Validation happens before existing generated output is replaced.

## Cloudflare Pages settings

- Project type: Pages, Git integration
- Repository: `1ess/cdn`
- Production branch: the approved migration branch until reviewed and merged
- Framework preset: None
- Root directory: repository root (leave blank)
- Build command: `node --test tools/test-pages.mjs && node tools/build-pages.mjs`
- Build output directory: `pages-dist`
- `NODE_VERSION=24.19.0`
- `SKIP_DEPENDENCY_INSTALL=true`
- Custom domain: `blogcdn.zhangdd.tech` only

Use Git integration for automatic deployments. Dashboard drag-and-drop is capped at 1,000 files and cannot fit this asset set; the Pages Free project limit via Git/Wrangler is 20,000 files. A Direct Upload project cannot be converted to Git integration later.

There are no Pages Functions, Workers, R2 buckets, paid bindings, or purchases in this target. Keep the existing Vercel project and the `cdn.zhangdd.tech` DNS record untouched.

## Media and publishing checks

Before publishing, verify the seven replacements' byte sizes, duration, stream counts, preserved audio, rotation, representative frames and decoding. The longest source video requires a 1280×720 deployment copy to meet the limit with its complete audio and duration; the original 1920×1080 source remains intact. HDR/HLG source videos are tone-mapped to standard BT.709 for broadly compatible H.264 playback. Optimized copies use MP4 fast-start metadata.

At the Cloudflare preview, check image and font requests, both linked tutorial downloads, real HTTP 404 behavior, `Content-Type`, CORS, video range requests and playback/seeking. Then add the new custom domain and verify HTTPS and the same paths. Local fixtures cannot establish live Cloudflare behavior.

The blog must not be published against the new CDN domain until this target passes its live checks. Rollback remains the unchanged Vercel domains.

## References

- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Direct Upload constraints](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Serving Pages and 404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Static response headers](https://developers.cloudflare.com/pages/configuration/headers/)
