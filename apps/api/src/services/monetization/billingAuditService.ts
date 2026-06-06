import type { BillingAuditEventRecord } from "rapid-cortex-shared";
import { BillingAuditRepository } from "../../repositories/billingAuditRepository.js";

const repo = new BillingAuditRepository();

export class BillingAuditService {
  async write(event: BillingAuditEventRecord): Promise<void> {
    await repo.append(event);
  }
}
