# Homepage demo listing-card assets

These files are upload-ready artifacts only. No production R2 upload is performed by this repository change.

## Required deployment order

1. Upload every WebP below to the `sanboard-media` bucket using the exact R2 key.
2. Set `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`.
3. Verify every public CDN URL returns HTTP 200 with the expected content type and cache header.
4. Only then commit, push, and deploy the application code.
5. Verify homepage browser requests go directly to `cdn.sanboard.xyz`, not `/home/` or `/_next/image`.
6. Remove legacy `public/home` listing-card sources only in a later cleanup.

## Upload mapping

| Local file | R2 key | Public CDN URL | Bytes | Dimensions | SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| `artifacts/r2/site/listingcard/vinewood-crest-estate.webp` | `site/listingcard/vinewood-crest-estate.webp` | `https://cdn.sanboard.xyz/site/listingcard/vinewood-crest-estate.webp` | 99,668 | 680×382 | `8c458de7e1b2279695d47bb10e6efbffc402aff8eb05fb63e7fe9359d278e1c7` |
| `artifacts/r2/site/listingcard/grotti-turismo-r.webp` | `site/listingcard/grotti-turismo-r.webp` | `https://cdn.sanboard.xyz/site/listingcard/grotti-turismo-r.webp` | 51,934 | 680×329 | `1a69717cd0c2d99637f277a7b362a78809e9ecd6ebad75d36711ceb8b88c6658` |
| `artifacts/r2/site/listingcard/nagasaki-shinobi.webp` | `site/listingcard/nagasaki-shinobi.webp` | `https://cdn.sanboard.xyz/site/listingcard/nagasaki-shinobi.webp` | 54,062 | 680×542 | `dbaf67d68abf53798dea8510efd6a23e3c8f2ec7506167aa4105d0c937f900ee` |

## Versioning policy

The current semantic filenames are safe only while the files remain immutable. If visual content changes, do not overwrite a cached object under the same key. Publish a new filename such as `nagasaki-shinobi-v2.webp` or a content-hashed filename, update the homepage constant, upload the new object first, and deploy the code second.