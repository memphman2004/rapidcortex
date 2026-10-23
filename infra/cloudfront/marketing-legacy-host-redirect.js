/**
 * CloudFront Function (cloudfront-js-2.0) for marketing dist EWZ286WS69KX1.
 *
 * Phase B brand cutover: path-preserving 301 from Rapid Cortex marketing hosts
 * to www.nexcortiq.us. NexCort hosts continue to origin (optionally apex → www).
 *
 * Also rewrites trailing-slash URIs to .../index.html for S3 static export
 * (same behavior as marketing-uri-rewrite.js) when not redirecting.
 */
/**
 * Public contact cards live on the app. Marketing S3 has no /c or /card
 * objects, and a missing key is rewritten to the homepage. Send those paths
 * to the app before any host or index.html rewrite.
 */
function isContactCardPath(uri) {
  return (
    uri === "/c" ||
    uri === "/card" ||
    uri.indexOf("/c/") === 0 ||
    uri.indexOf("/card/") === 0
  );
}

function queryString(request) {
  if (!request.querystring || Object.keys(request.querystring).length === 0) {
    return "";
  }
  var parts = [];
  for (var key in request.querystring) {
    if (!Object.prototype.hasOwnProperty.call(request.querystring, key)) continue;
    var q = request.querystring[key];
    if (q.multiValue) {
      for (var i = 0; i < q.multiValue.length; i++) {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(q.multiValue[i].value));
      }
    } else if (q.value !== undefined) {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(q.value));
    }
  }
  return parts.length > 0 ? "?" + parts.join("&") : "";
}

function redirect(statusCode, location) {
  return {
    statusCode: statusCode,
    statusDescription: statusCode === 301 ? "Moved Permanently" : "Found",
    headers: {
      location: { value: location },
      "cache-control": { value: statusCode === 301 ? "max-age=3600" : "no-store" },
    },
  };
}

function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var hostHeader = headers.host && headers.host.value ? headers.host.value : "";
  var host = hostHeader.toLowerCase().split(":")[0];

  if (isContactCardPath(request.uri)) {
    return redirect(302, "https://app.rapidcortex.us" + request.uri + queryString(request));
  }

  var legacy =
    host === "rapidcortex.us" ||
    host === "www.rapidcortex.us";

  if (legacy) {
    return redirect(301, "https://www.nexcortiq.us" + request.uri + queryString(request));
  }

  // Prefer www for apex nexcortiq.us (canonical host).
  if (host === "nexcortiq.us") {
    return redirect(301, "https://www.nexcortiq.us" + request.uri + queryString(request));
  }

  var uri = request.uri;
  if (uri.indexOf(".") === -1 && uri.endsWith("/")) {
    request.uri = uri + "index.html";
  }
  return request;
}
