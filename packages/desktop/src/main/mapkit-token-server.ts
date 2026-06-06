import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import { app } from "electron";
import dotenv from "dotenv";

interface MapKitConfig {
  keyId: string;
  teamId: string;
  keyPath: string;
}

function desktopRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "desktop")
    : path.join(__dirname, "../..");
}

export class MapKitTokenServer {
  private readonly config: MapKitConfig;
  private readonly privateKey: string;

  constructor() {
    const root = desktopRoot();
    dotenv.config({ path: path.join(root, ".env.mapkit") });

    this.config = {
      keyId: process.env.MAPKIT_KEY_ID ?? "",
      teamId: process.env.MAPKIT_TEAM_ID ?? "",
      keyPath: process.env.MAPKIT_KEY_PATH ?? "",
    };

    if (!this.config.keyId || !this.config.teamId || !this.config.keyPath) {
      throw new Error("MapKit credentials not configured. Check .env.mapkit file.");
    }

    const keyFullPath = path.isAbsolute(this.config.keyPath)
      ? this.config.keyPath
      : path.join(root, this.config.keyPath);

    if (!fs.existsSync(keyFullPath)) {
      throw new Error(`MapKit private key not found at: ${keyFullPath}`);
    }

    this.privateKey = fs.readFileSync(keyFullPath, "utf8");
    console.log("[mapkit] token server initialized");
  }

  generateToken(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.teamId,
      iat: now,
      exp: now + 3600,
    };
    const header = {
      kid: this.config.keyId,
      typ: "JWT",
      alg: "ES256",
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: "ES256",
      header,
    });
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      if (!decoded?.exp) return true;
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp - now < 300;
    } catch {
      return true;
    }
  }
}

let tokenServerInstance: MapKitTokenServer | null = null;

export function getMapKitTokenServer(): MapKitTokenServer {
  if (!tokenServerInstance) {
    tokenServerInstance = new MapKitTokenServer();
  }
  return tokenServerInstance;
}
