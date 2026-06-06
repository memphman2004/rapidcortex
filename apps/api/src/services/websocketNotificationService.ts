import { broadcastToAgency, sendWebSocketMessage } from "../lib/websocket/send-message.js";

export class WebSocketNotificationService {
  async notifyIncomingTransfer(params: {
    userId: string;
    callId: string;
    fromUsername: string;
    method: "api" | "deeplink" | "notification";
    deepLink?: string;
  }): Promise<void> {
    await sendWebSocketMessage({
      userId: params.userId,
      message: {
        type: "INCOMING_TRANSFER",
        data: {
          callId: params.callId,
          fromUsername: params.fromUsername,
          method: params.method,
          deepLink: params.deepLink,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  async notifyCallTransferred(params: {
    userId: string;
    callId: string;
    newHandler: string;
  }): Promise<void> {
    await sendWebSocketMessage({
      userId: params.userId,
      message: {
        type: "CALL_TRANSFERRED",
        data: {
          callId: params.callId,
          newHandler: params.newHandler,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  async notifyTransferStatus(params: {
    userId: string;
    callId: string;
    status: "accepted" | "declined" | "completed" | "failed";
    targetUsername: string;
  }): Promise<void> {
    await sendWebSocketMessage({
      userId: params.userId,
      message: {
        type: "TRANSFER_STATUS",
        data: {
          callId: params.callId,
          status: params.status,
          targetUsername: params.targetUsername,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  async broadcastNewCall(params: {
    agencyId: string;
    callId: string;
    callerPhone: string;
    priority: number;
  }): Promise<void> {
    await broadcastToAgency({
      agencyId: params.agencyId,
      message: {
        type: "NEW_CALL",
        data: {
          callId: params.callId,
          callerPhone: params.callerPhone,
          priority: params.priority,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
