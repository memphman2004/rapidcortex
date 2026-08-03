/**
 * CloudFront Function (viewer-request): map Next.js trailingSlash routes to S3 keys.
 *
 * Marketing static export uses trailingSlash:true → objects at `{route}/index.html`
 * plus extensionless `{route}` keys. CloudFront+S3 REST does not auto-resolve
 * `/privacy/` → `privacy/index.html`. Without this rewrite, `/privacy/` 404s and
 * CustomErrorResponses maps that to `/index.html` (homepage) with HTTP 200 —
 * which breaks Twilio/TCR policy URL checks that often append a trailing slash.
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Leave asset / file URLs alone (css, js, images, txt, json, …).
  if (uri.indexOf(".") !== -1) {
    return request;
  }

  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
  }

  return request;
}
