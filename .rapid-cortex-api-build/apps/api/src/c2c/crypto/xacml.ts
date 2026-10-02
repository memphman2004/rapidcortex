export type AccessAction = "READ_INCIDENTS" | "WRITE_INCIDENTS" | "READ_UNITS" | "READ_AVL";

export interface PolicyCondition {
  type: string;
  value: string;
}

export interface AccessPolicy {
  subjectAgencyId: string;
  resourceAgencyId: string;
  allowedActions: AccessAction[];
  conditions?: PolicyCondition[];
}

export class XACMLEngine {
  constructor(private readonly policies: AccessPolicy[] = []) {}

  async evaluate(
    subjectAgencyId: string,
    resourceAgencyId: string,
    action: string,
  ): Promise<"PERMIT" | "DENY" | "NOT_APPLICABLE"> {
    const forward = this.policies.find(
      (p) => p.subjectAgencyId === subjectAgencyId && p.resourceAgencyId === resourceAgencyId,
    );
    const reverse = this.policies.find(
      (p) => p.subjectAgencyId === resourceAgencyId && p.resourceAgencyId === subjectAgencyId,
    );
    if (!forward && !reverse) return "NOT_APPLICABLE";
    if (!forward || !reverse) return "DENY";
    const allowed = forward.allowedActions.includes(action as AccessAction);
    return allowed ? "PERMIT" : "DENY";
  }

  addPolicy(policy: AccessPolicy): void {
    this.policies.push(policy);
  }
}
