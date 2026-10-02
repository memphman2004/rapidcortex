import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { ConnectSource } from "../connect-types.js";

const sm = new SecretsManagerClient({});

async function getCredentials(secretArn: string): Promise<{ username: string; password: string }> {
  const result = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secretString = result.SecretString;
  if (!secretString) throw new Error(`Missing SecretString for ${secretArn}`);
  const parsed = JSON.parse(secretString) as { username?: string; password?: string };
  if (!parsed.username || !parsed.password) {
    throw new Error(`Invalid ONVIF credential payload in ${secretArn}`);
  }
  return { username: parsed.username, password: parsed.password };
}

type OnvifDeviceCtor = new (options: {
  xaddr: string;
  user?: string;
  pass?: string;
}) => {
  init(): Promise<void>;
  getCurrentProfile(): { token?: string } | null;
  fetchStreamUri(options: { ProfileToken: string; Protocol: "RTSP" }): Promise<{ uri?: string }>;
};

export async function resolveOnvifStreamUri(source: ConnectSource): Promise<string> {
  if (!source.onvifHost) {
    throw new Error(`ONVIF source ${source.sourceId} has no onvifHost`);
  }

  const creds = source.credentialsSecretArn
    ? await getCredentials(source.credentialsSecretArn)
    : undefined;

  const imported = (await import("node-onvif")) as { OnvifDevice?: OnvifDeviceCtor };
  if (!imported.OnvifDevice) {
    throw new Error("node-onvif module missing OnvifDevice export");
  }

  const device = new imported.OnvifDevice({
    xaddr: `http://${source.onvifHost}/onvif/device_service`,
    user: creds?.username,
    pass: creds?.password,
  });

  await device.init();
  const profile = device.getCurrentProfile();
  if (!profile?.token) {
    throw new Error(`ONVIF device at ${source.onvifHost} returned no profiles`);
  }

  const { uri } = await device.fetchStreamUri({
    ProfileToken: profile.token,
    Protocol: "RTSP",
  });
  if (!uri) {
    throw new Error(`ONVIF device at ${source.onvifHost} did not provide a stream URI`);
  }
  return uri;
}
