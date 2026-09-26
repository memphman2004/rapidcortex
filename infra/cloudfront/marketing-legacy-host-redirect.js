/**
 * CloudFront Function (cloudfront-js-2.0) for marketing dist EWZ286WS69KX1.
 *
 * Phase B brand cutover: path-preserving 301 from Rapid Cortex marketing hosts
 * to www.nexcortiq.us. NexCort hosts continue to origin (optionally apex → www).
 *
 * Also rewrites trailing-slash URIs to .../index.html for S3 static export
 * (same behavior as marketing-uri-rewrite.js) when not redirecting.
 */
function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var hostHeader = headers.host && headers.host.value ? headers.host.value : "";
  var host = hostHeader.toLowerCase().split(":")[0];

  var legacy =
    host === "rapidcortex.us" ||
    host === "www.rapidcortex.us";

  if (legacy) {
    var loc = "https://www.nexcortiq.us" + request.uri;
    if (request.querystring && Object.keys(request.querystring).length > 0) {
      var parts = [];
      for (var key in request.querystring) {
        if (!Object.prototype.hasOwnProperty.call(request.querystring, key)) continue;
        var q = request.querystring[key];
        if (q.multiValue) {
          for (var i = 0; i < q.multiValue.length; i++) {
            parts.push(
              encodeURIComponent(key) + "=" + encodeURIComponent(q.multiValue[i].value)
            );
          }
        } else if (q.value !== undefined) {
          parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(q.value));
        }
      }
      if (parts.length > 0) {
        loc += "?" + parts.join("&");
      }
    }
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: loc },
        "cache-control": { value: "max-age=3600" },
      },
    };
  }

  // Prefer www for apex nexcortiq.us (canonical host).
  if (host === "nexcortiq.us") {
    var wwwLoc = "https://www.nexcortiq.us" + request.uri;
    if (request.querystring && Object.keys(request.querystring).length > 0) {
      var wwwParts = [];
      for (var k in request.querystring) {
        if (!Object.prototype.hasOwnProperty.call(request.querystring, k)) continue;
        var qq = request.querystring[k];
        if (qq.multiValue) {
          for (var j = 0; j < qq.multiValue.length; j++) {
            wwwParts.push(
              encodeURIComponent(k) + "=" + encodeURIComponent(qq.multiValue[j].value)
            );
          }
        } else if (qq.value !== undefined) {
          wwwParts.push(encodeURIComponent(k) + "=" + encodeURIComponent(qq.value));
        }
      }
      if (wwwParts.length > 0) {
        wwwLoc += "?" + wwwParts.join("&");
      }
    }
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: wwwLoc },
        "cache-control": { value: "max-age=3600" },
      },
    };
  }

  var uri = request.uri;
  if (uri.indexOf(".") === -1 && uri.endsWith("/")) {
    request.uri = uri + "index.html";
  }
  return request;
}
