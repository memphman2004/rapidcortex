import type { Handler } from "aws-lambda";
import { rcAdminProvisioningInvokeSchema } from "rapid-cortex-shared";
import { RcAdminAdobeProvisioningService } from "../services/rcAdminAdobeProvisioningService.js";

const svc = new RcAdminAdobeProvisioningService();

/** Async target invoked by Adobe Sign webhook (RC Lite auto-provision / platform notify). */
export const handler: Handler = async (event) => {
  const parsed = rcAdminProvisioningInvokeSchema.safeParse(event);
  if (!parsed.success) {
    console.error("[rc-admin-provisioning] invalid payload", parsed.error.flatten());
    throw new Error("INVALID_PROVISIONING_PAYLOAD");
  }
  const result = await svc.processInvoke(parsed.data);
  console.info("[rc-admin-provisioning] completed", result);
  return result;
};
