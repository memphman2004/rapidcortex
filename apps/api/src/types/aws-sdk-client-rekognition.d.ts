declare module "@aws-sdk/client-rekognition" {
  export class RekognitionClient {
    constructor(cfg?: object);
    send(cmd: unknown): Promise<{
      Labels?: Array<{ Name?: string; Confidence?: number; Instances?: unknown[] }>;
    }>;
  }
  export class DetectLabelsCommand {
    constructor(input: object);
  }
}
