import { randomUUID } from "node:crypto";
import { normalizeCallLanguageCode, isSupportedCallLanguage } from "rapid-cortex-shared";
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  type LanguageCode,
  type StartTranscriptionJobCommandInput,
  TranscribeClient,
  TranscriptionJobStatus,
} from "@aws-sdk/client-transcribe";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ISpeechToTextProvider, SttChunkResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { pcm16leMonoToWav } from "../audio/wavFromPcm16le.js";
import {
  AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS,
  buildAwsTranscribeIdentifyLanguageOptions,
  toAwsTranscribeLanguageCode,
} from "./transcribeLanguageMapping.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";
import { sleepMs } from "../providerRuntime.js";
import { logVoiceMetric } from "../voiceMetrics.js";
import { voiceErrorFromTranscribeSdk } from "./transcribeSdkErrors.js";

type AwsTranscriptFile = {
  results?: {
    transcripts?: { transcript?: string }[];
    language_code?: string;
    language_identification?: { code?: string; score?: number }[];
    items?: { alternatives?: { confidence?: string; content?: string }[] }[];
  };
};

function jobSafeName(): string {
  const u = randomUUID().replace(/-/g, "");
  return `rcstt${u}`.slice(0, 180);
}

function mediaFormatForUpload(format: string): "wav" | "mp3" | "mp4" | "flac" | "ogg" | "webm" {
  if (format === "webm") return "webm";
  if (format === "wav") return "wav";
  return "wav";
}

function buildUploadBody(input: { audioBytes: Uint8Array; format: string }): Uint8Array {
  if (input.format === "wav") return input.audioBytes;
  if (input.format === "pcm16le" || input.format === "opaque") return pcm16leMonoToWav(input.audioBytes);
  return input.audioBytes;
}

function extractTranscriptConfidence(raw: AwsTranscriptFile): number {
  const lid = raw.results?.language_identification?.[0];
  if (lid && typeof lid.score === "number" && Number.isFinite(lid.score)) {
    return Math.min(1, Math.max(0, lid.score));
  }
  const alts = raw.results?.items?.[0]?.alternatives;
  const c = alts?.[0]?.confidence;
  if (c != null) {
    const n = Number.parseFloat(c);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return 0.82;
}

export type AwsTranscribeSttProviderDeps = {
  transcribeClient?: TranscribeClient;
  s3Client?: S3Client;
};

export class AwsTranscribeSttProvider implements ISpeechToTextProvider {
  readonly name: string;
  private readonly sttModelLabel: string;
  private readonly transcribe: TranscribeClient;
  private readonly s3: S3Client;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string; sttModelUsed?: string } & AwsTranscribeSttProviderDeps,
  ) {
    this.name = opts?.name ?? "aws-transcribe";
    this.sttModelLabel =
      opts?.sttModelUsed ??
      cfg.sttModelTertiary;
    const region = cfg.awsTranscribeRegion.trim() || process.env.AWS_REGION || "us-east-1";
    this.transcribe = opts?.transcribeClient ?? new TranscribeClient({ region });
    this.s3 = opts?.s3Client ?? new S3Client({ region });
  }

  async transcribeAudioChunk(
    input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
    options?: { signal?: AbortSignal },
  ): Promise<SttChunkResult> {
    if (this.cfg.awsTranscribeEnablePartialResults) {
      logVoiceMetric({
        metric: "aws_transcribe_partial_results_unavailable",
        provider: this.name,
        note: "Batch StartTranscriptionJob returns final transcripts only; partial streaming is not used.",
      });
    }

    const bucket = this.cfg.assetsBucket.trim();
    if (!bucket) {
      throw new VoiceProviderError("ASSETS_BUCKET required for Transcribe", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
        retryable: false,
      });
    }

    const jobName = jobSafeName();
    const key = `voice-stt/${jobName}.${mediaFormatForUpload(input.format)}`;
    const body = buildUploadBody(input);
    const t0 = Date.now();

    logVoiceMetric({ metric: "aws_transcribe_attempt_started", provider: this.name, jobName });

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(body),
        ContentType: input.format === "webm" ? "audio/webm" : "audio/wav",
      }),
      { abortSignal: options?.signal },
    );

    const mediaUri = `s3://${bucket}/${key}`;
    const mediaFormat = mediaFormatForUpload(input.format);
    const hint = input.hintLanguage?.trim();
    const normalizedHint = hint ? normalizeCallLanguageCode(hint) : "und";
    const hasUsableHint = Boolean(hint) && normalizedHint !== "und";

    let startInput: StartTranscriptionJobCommandInput;

    if (hasUsableHint) {
      const lang = toAwsTranscribeLanguageCode(hint) as LanguageCode;
      startInput = {
        TranscriptionJobName: jobName,
        LanguageCode: lang,
        Media: { MediaFileUri: mediaUri },
        MediaFormat: mediaFormat,
      };
    } else if (this.cfg.awsTranscribeLanguageIdentification) {
      const languageOptions = buildAwsTranscribeIdentifyLanguageOptions(
        this.cfg.awsTranscribeLanguageOptionsCsv,
        this.cfg.awsTranscribePreferredLanguageOptionsCsv,
      ) as LanguageCode[];
      if (languageOptions.length < AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
        throw new VoiceProviderError(
          `AWS Transcribe IdentifyLanguage requires at least ${AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS} language options; got ${languageOptions.length}`,
          VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR,
          { retryable: false },
        );
      }
      startInput = {
        TranscriptionJobName: jobName,
        IdentifyLanguage: true,
        LanguageOptions: languageOptions,
        Media: { MediaFileUri: mediaUri },
        MediaFormat: mediaFormat,
      };
    } else {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      throw new VoiceProviderError(
        "AWS Transcribe: no language hint on chunk and AWS_TRANSCRIBE_LANGUAGE_IDENTIFICATION is false — enable identification or supply session.detectedLanguage / preferredLanguageHint.",
        VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR,
        { retryable: false },
      );
    }

    const start = new StartTranscriptionJobCommand(startInput);
    try {
      await this.transcribe.send(start, { abortSignal: options?.signal });
    } catch (e) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      logVoiceMetric({ metric: "aws_transcribe_attempt_failed", provider: this.name, jobName, phase: "start" });
      throw voiceErrorFromTranscribeSdk(e);
    }

    const pollBudget = Math.min(
      this.cfg.awsTranscribeTimeoutMs > 0 ? this.cfg.awsTranscribeTimeoutMs : this.cfg.providerRequestTimeoutMs,
      110_000,
    );
    const deadline = Date.now() + pollBudget;
    let status: TranscriptionJobStatus | string | undefined = "IN_PROGRESS";

    while (status === "IN_PROGRESS" || status === "QUEUED") {
      if (options?.signal?.aborted) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
        throw new VoiceProviderError("Transcribe aborted", VOICE_ERROR_CODES.STT_TIMEOUT, { retryable: false });
      }
      if (Date.now() > deadline) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
        throw new VoiceProviderError("Transcribe poll timeout", VOICE_ERROR_CODES.STT_TIMEOUT, { retryable: true });
      }
      let got;
      try {
        got = await this.transcribe.send(
          new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
          { abortSignal: options?.signal },
        );
      } catch (e) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
        logVoiceMetric({ metric: "aws_transcribe_attempt_failed", provider: this.name, jobName, phase: "poll" });
        throw voiceErrorFromTranscribeSdk(e);
      }
      status = got.TranscriptionJob?.TranscriptionJobStatus;
      if (status === "FAILED") {
        const reason = got.TranscriptionJob?.FailureReason ?? "unknown";
        await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
        logVoiceMetric({ metric: "aws_transcribe_attempt_failed", provider: this.name, jobName, phase: "job", reason });
        throw new VoiceProviderError(`Transcribe failed: ${reason}`, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
          retryable: false,
        });
      }
      if (status === "COMPLETED") {
        const uri = got.TranscriptionJob?.Transcript?.TranscriptFileUri;
        if (!uri) {
          await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
          throw new VoiceProviderError("Transcribe missing transcript URI", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
            retryable: false,
          });
        }
        const tr = await fetch(uri, { signal: options?.signal });
        if (!tr.ok) {
          await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
          throw new VoiceProviderError(`Transcript fetch HTTP ${tr.status}`, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
            retryable: tr.status >= 500,
            httpStatus: tr.status,
          });
        }
        const rawJson = (await tr.json()) as AwsTranscriptFile;
        const transcript = rawJson.results?.transcripts?.[0]?.transcript?.trim() ?? "";
        const langRaw =
          rawJson.results?.language_code ?? rawJson.results?.language_identification?.[0]?.code ?? "en-US";
        if (!transcript) {
          await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
          throw new VoiceProviderError("Transcribe empty transcript", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
            retryable: false,
          });
        }
        await this.s3
          .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: options?.signal })
          .catch(() => undefined);

        const languageCanon = normalizeCallLanguageCode(langRaw);
        if (!isSupportedCallLanguage(languageCanon, this.cfg.supportedLanguages)) {
          logVoiceMetric({
            metric: "aws_transcribe_unsupported_language_hint",
            provider: this.name,
            awsLanguage: langRaw,
            normalized: languageCanon,
          });
        }

        const confidence = extractTranscriptConfidence(rawJson);
        const latencyMs = Date.now() - t0;
        logVoiceMetric({
          metric: "aws_transcribe_attempt_succeeded",
          provider: this.name,
          jobName,
          language: languageCanon,
          confidence,
          latencyMs,
        });

        return {
          transcript,
          languageCode: languageCanon,
          confidence,
          isPartial: false,
          sttModelUsed: this.sttModelLabel,
          startTimeMs: 0,
          endTimeMs: undefined,
          sttProviderLatencyMs: latencyMs,
          providerRequestId: jobName,
        };
      }
      await sleepMs(2000, options?.signal);
    }
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    logVoiceMetric({ metric: "aws_transcribe_attempt_failed", provider: this.name, jobName, phase: "unexpected_status" });
    throw new VoiceProviderError(`Transcribe unexpected status ${status}`, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      retryable: false,
    });
  }
}
