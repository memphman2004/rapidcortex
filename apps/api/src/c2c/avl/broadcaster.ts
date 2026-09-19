import type { UnitLocation } from "./types.js";

export type AVLPushFn = (connectionId: string, payload: unknown) => Promise<void>;

export class AVLBroadcaster {
  private connections = new Map<string, { connectionId: string; agencyIds: string[] }>();

  constructor(private readonly push: AVLPushFn = async () => undefined) {}

  register(connectionId: string, agencyIds: string[]): void {
    this.connections.set(connectionId, { connectionId, agencyIds });
  }

  unregister(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  async broadcast(position: UnitLocation): Promise<void> {
    for (const conn of this.connections.values()) {
      if (!conn.agencyIds.includes(position.agencyId)) continue;
      await this.push(conn.connectionId, { type: "c2c.avl.updated", data: position });
    }
  }
}
