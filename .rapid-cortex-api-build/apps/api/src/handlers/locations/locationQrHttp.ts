/**
 * Admin QR asset generation.
 * GET /api/admin/tenants/{agencyId}/locations/{rcli}/qr?format=png|svg|pdf&size=400
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canViewQrLocations } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { renderQrPdf, renderQrPng, renderQrSvg } from "../../locations/qr-asset-service.js";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "../../lib/response.js";
import { QRLocationsRepository } from "../../repositories/qrLocationsRepository.js";

const repo = new QRLocationsRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const agencyId = event.pathParameters?.agencyId?.trim() ?? "";
    const rcli = event.pathParameters?.rcli?.trim().toUpperCase() ?? "";
    if (!agencyId || !rcli) return withCorrelationHeaders(event, badRequest("agencyId and rcli required"));

    if (!canViewQrLocations(user, agencyId)) return withCorrelationHeaders(event, forbidden());

    const location = await repo.getByRcli(rcli);
    if (!location || location.agencyId !== agencyId) {
      return withCorrelationHeaders(event, notFound("Location not found"));
    }

    const format = (event.queryStringParameters?.format ?? "png").toLowerCase();
    const size = Math.min(1200, Math.max(128, Number.parseInt(event.queryStringParameters?.size ?? "400", 10) || 400));

    if (format === "svg") {
      const svg = await renderQrSvg(location, size);
      return withCorrelationHeaders(event, {
        statusCode: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `inline; filename="${rcli}.svg"`,
        },
        body: svg,
      });
    }

    if (format === "pdf") {
      const pdf = await renderQrPdf(location);
      return withCorrelationHeaders(event, {
        statusCode: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${rcli}.pdf"`,
        },
        body: pdf.toString("base64"),
        isBase64Encoded: true,
      });
    }

    if (format !== "png") {
      return withCorrelationHeaders(event, badRequest("format must be png, svg, or pdf"));
    }

    const png = await renderQrPng(location, size);
    return withCorrelationHeaders(event, {
      statusCode: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${rcli}.png"`,
      },
      body: png.toString("base64"),
      isBase64Encoded: true,
    });
  } catch (error) {
    console.error("[location-qr]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
