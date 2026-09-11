"""
Rapid Vision™ — live transcript worker.

Pipeline:
  KVS Video Stream (HLS)
      ↓  GetHLSStreamingSessionURL
  ffmpeg  (PCM 16 kHz mono)
      ↓  4KB chunks (~128ms)
  Amazon Transcribe Streaming (speaker ID, partial + final)
      ↓
  DynamoDB (agency-scoped) + WebSocket envelope {type, data}

Invocation:
  API start: { sessionId, incidentId, agencyId, cameraId }
  Self-continue: same payload after ~13 minutes if transcriptStatus is still active.

Set VISION_TRANSCRIPT_MOCK=false for live ffmpeg/Transcribe. Default mock so CI never calls them.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_ddb = boto3.resource("dynamodb")
_kvs = boto3.client("kinesisvideo")
_lambda = boto3.client("lambda")

STAGE = os.environ.get("DEPLOYMENT_STAGE") or os.environ.get("STAGE", "dev")
TRANSCRIPTS_TABLE = os.environ.get("VISION_TRANSCRIPTS_TABLE", "")
SESSIONS_TABLE = os.environ.get("VISION_SESSIONS_TABLE", "")
WS_CONNECTIONS_TABLE = os.environ.get("WEBSOCKET_CONNECTIONS_TABLE", "")
LANGUAGE_CODE = os.environ.get("VISION_TRANSCRIPT_LANGUAGE", "en-US")
SAMPLE_RATE_HZ = 16_000
CHUNK_SIZE = 4_096
WORKER_DURATION_SECONDS = int(os.environ.get("VISION_TRANSCRIPT_WORKER_DURATION_S", "780"))
STOP_POLL_S = int(os.environ.get("VISION_TRANSCRIPT_STOP_POLL_S", "60"))
FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "/opt/bin/ffmpeg")


def _is_mock() -> bool:
    v = os.environ.get("VISION_TRANSCRIPT_MOCK", "true").strip().lower()
    return v not in ("false", "0")


def handler(event: dict, context: Any) -> dict:
    if event.get("source") == "rapid-cortex.vision.transcript":
        params = event.get("detail") or {}
    else:
        params = event

    session_id = str(params.get("sessionId") or "")
    incident_id = str(params.get("incidentId") or "")
    agency_id = str(params.get("agencyId") or "")
    camera_id = str(params.get("cameraId") or "")

    if not all([session_id, incident_id, agency_id, camera_id]):
        logger.error(json.dumps({"msg": "transcript_worker_bad_params"}))
        return {"statusCode": 400, "body": "Missing required parameters"}

    session = _get_session(incident_id, session_id, agency_id)
    if not session:
        logger.warning(json.dumps({"msg": "transcript_session_missing", "sessionId": session_id}))
        return {"statusCode": 404, "body": "Session not found"}
    if session.get("transcriptStatus") != "active":
        logger.info(json.dumps({"msg": "transcript_not_active", "sessionId": session_id}))
        return {"statusCode": 200, "body": "stopped"}

    logger.info(
        json.dumps(
            {
                "msg": "transcript_worker_start",
                "sessionId": session_id,
                "incidentId": incident_id,
                "mock": _is_mock(),
            }
        )
    )

    try:
        asyncio.run(
            _run(
                session=session,
                session_id=session_id,
                incident_id=incident_id,
                agency_id=agency_id,
                camera_id=camera_id,
                duration_seconds=WORKER_DURATION_SECONDS,
            )
        )
    except Exception as exc:
        logger.error(
            json.dumps(
                {
                    "msg": "transcript_pipeline_error",
                    "sessionId": session_id,
                    "error": str(exc),
                }
            )
        )
        return {"statusCode": 500, "body": "pipeline_error"}

    _maybe_continue(params)
    return {"statusCode": 200, "body": "ok"}


async def _run(
    *,
    session: dict,
    session_id: str,
    incident_id: str,
    agency_id: str,
    camera_id: str,
    duration_seconds: int,
) -> None:
    if _is_mock():
        await _run_mock(
            session_id=session_id,
            incident_id=incident_id,
            agency_id=agency_id,
            camera_id=camera_id,
        )
        return

    kvs_ref = (
        (session.get("kvsStreamArn") or "").strip()
        or (session.get("kvsChannelName") or "").strip()
    )
    if not kvs_ref:
        logger.warning(json.dumps({"msg": "transcript_no_kvs_ref", "sessionId": session_id}))
        return

    hls_url = _get_hls_url(str(kvs_ref))
    if not hls_url:
        return

    ffmpeg_bin = _resolve_ffmpeg()
    if not ffmpeg_bin:
        logger.error(json.dumps({"msg": "ffmpeg_missing"}))
        return

    from amazon_transcribe.client import TranscribeStreamingClient
    from amazon_transcribe.handlers import TranscriptResultStreamHandler
    from amazon_transcribe.model import TranscriptEvent

    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=64)
    deadline = time.monotonic() + duration_seconds
    region = os.environ.get("AWS_REGION", "us-east-1")
    transcribe_client = TranscribeStreamingClient(region=region)
    stream = await transcribe_client.start_stream_transcription(
        language_code=LANGUAGE_CODE,
        media_sample_rate_hz=SAMPLE_RATE_HZ,
        media_encoding="pcm",
        show_speaker_label=True,
        enable_partial_results_stabilization=True,
        partial_results_stability="medium",
        enable_channel_identification=False,
    )

    class _Handler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent) -> None:
            results = transcript_event.transcript.results or []
            for result in results:
                await _process_result(
                    result,
                    session_id=session_id,
                    incident_id=incident_id,
                    agency_id=agency_id,
                    camera_id=camera_id,
                )

    handler_obj = _Handler(stream.output_stream)
    ffmpeg_proc = _start_ffmpeg(hls_url, ffmpeg_bin)
    stop_task = asyncio.create_task(
        _watch_stop(
            incident_id=incident_id,
            session_id=session_id,
            agency_id=agency_id,
            audio_queue=audio_queue,
            deadline=deadline,
        )
    )
    try:
        await asyncio.gather(
            _read_ffmpeg_to_queue(
                ffmpeg_proc,
                audio_queue,
                deadline,
                incident_id=incident_id,
                session_id=session_id,
                agency_id=agency_id,
            ),
            _send_audio_to_transcribe(audio_queue, stream.input_stream),
            handler_obj.handle_events(),
        )
    finally:
        stop_task.cancel()
        try:
            ffmpeg_proc.terminate()
            ffmpeg_proc.wait(timeout=3)
        except Exception:
            pass


async def _run_mock(*, session_id: str, incident_id: str, agency_id: str, camera_id: str) -> None:
    lines = [
        ("SPEAKER_0", "Someone is at the back door."),
        ("SPEAKER_1", "I can hear voices inside."),
        ("SPEAKER_0", "They are moving toward the hallway."),
    ]
    for idx, (speaker, text) in enumerate(lines):
        if _session_should_stop(incident_id, session_id, agency_id):
            return
        result_id = f"mock-{session_id}-{idx}"
        now = datetime.now(timezone.utc).isoformat()
        partial = {
            "resultId": result_id,
            "incidentId": incident_id,
            "agencyId": agency_id,
            "sessionId": session_id,
            "cameraId": camera_id,
            "speakerLabel": speaker,
            "transcript": text[: max(8, len(text) // 2)],
            "isPartial": True,
            "startTime": float(idx),
            "endTime": float(idx) + 0.4,
            "confidence": 0.55,
            "language": LANGUAGE_CODE,
            "timestamp": now,
        }
        _persist_segment(partial)
        await _push_segment(agency_id, partial)
        await asyncio.sleep(0.35)
        final = {**partial, "transcript": text, "isPartial": False, "confidence": 0.91}
        final["timestamp"] = datetime.now(timezone.utc).isoformat()
        _persist_segment(final)
        await _push_segment(agency_id, final)
        await asyncio.sleep(0.45)


async def _watch_stop(
    *,
    incident_id: str,
    session_id: str,
    agency_id: str,
    audio_queue: asyncio.Queue[bytes | None],
    deadline: float,
) -> None:
    while time.monotonic() < deadline:
        if _session_should_stop(incident_id, session_id, agency_id):
            await audio_queue.put(None)
            return
        await asyncio.sleep(max(1, STOP_POLL_S))


def _resolve_ffmpeg() -> str | None:
    for candidate in (FFMPEG_BIN, "/opt/bin/ffmpeg", "/opt/ffmpeg/bin/ffmpeg", "ffmpeg"):
        if candidate == "ffmpeg":
            return candidate
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def _start_ffmpeg(hls_url: str, ffmpeg_bin: str) -> subprocess.Popen:
    cmd = [
        ffmpeg_bin,
        "-re",
        "-i",
        hls_url,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        str(SAMPLE_RATE_HZ),
        "-ac",
        "1",
        "-f",
        "s16le",
        "-loglevel",
        "quiet",
        "pipe:1",
    ]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)


async def _read_ffmpeg_to_queue(
    proc: subprocess.Popen,
    queue: asyncio.Queue[bytes | None],
    deadline: float,
    *,
    incident_id: str,
    session_id: str,
    agency_id: str,
) -> None:
    loop = asyncio.get_running_loop()
    last_poll = time.monotonic()
    try:
        while time.monotonic() < deadline:
            if time.monotonic() - last_poll >= STOP_POLL_S:
                if _session_should_stop(incident_id, session_id, agency_id):
                    logger.info(
                        json.dumps(
                            {
                                "msg": "transcript_stop_signal_detected",
                                "sessionId": session_id,
                            }
                        )
                    )
                    break
                last_poll = time.monotonic()
            if proc.stdout is None:
                break
            chunk = await loop.run_in_executor(None, proc.stdout.read, CHUNK_SIZE)
            if not chunk:
                break
            await queue.put(chunk)
    finally:
        await queue.put(None)


async def _send_audio_to_transcribe(queue: asyncio.Queue[bytes | None], input_stream) -> None:
    try:
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            await input_stream.send_audio_event(audio_chunk=chunk)
    finally:
        await input_stream.end_stream()


async def _process_result(result, *, session_id, incident_id, agency_id, camera_id) -> None:
    if not result.alternatives:
        return
    best = result.alternatives[0]
    text = (best.transcript or "").strip()
    if not text:
        return
    speaker_label = _dominant_speaker(best.items or [])
    confidence = _average_confidence(best.items or [])
    now = datetime.now(timezone.utc).isoformat()
    result_id = result.result_id or str(uuid.uuid4())
    segment = {
        "resultId": result_id,
        "incidentId": incident_id,
        "agencyId": agency_id,
        "sessionId": session_id,
        "cameraId": camera_id,
        "speakerLabel": speaker_label,
        "transcript": text,
        "isPartial": bool(result.is_partial),
        "startTime": float(result.start_time or 0),
        "endTime": float(result.end_time or 0),
        "confidence": confidence,
        "language": LANGUAGE_CODE,
        "timestamp": now,
    }
    _persist_segment(segment)
    await _push_segment(agency_id, segment)


def _dominant_speaker(items: list) -> str:
    labels = [
        getattr(item, "speaker", None)
        for item in items
        if getattr(item, "type", "") == "pronunciation"
    ]
    labels = [label for label in labels if label]
    if not labels:
        return "SPEAKER_0"
    most_common = Counter(labels).most_common(1)[0][0]
    return str(most_common).upper().replace("SPK_", "SPEAKER_")


def _average_confidence(items: list) -> float:
    confs: list[float] = []
    for item in items:
        if getattr(item, "type", "") == "pronunciation":
            c = getattr(item, "confidence", None)
            if c is not None:
                try:
                    confs.append(float(c))
                except (TypeError, ValueError):
                    pass
    return round(sum(confs) / len(confs), 3) if confs else 0.0


def _ddb_num(value: float) -> Decimal:
    return Decimal(str(round(float(value), 3)))


def _persist_segment(segment: dict) -> None:
    if not TRANSCRIPTS_TABLE:
        return
    ttl = int(time.time()) + 86400 * 30
    item = {
        "pk": f"INCIDENT#{segment['incidentId']}",
        "sk": f"SEG#{segment['sessionId']}#{segment['resultId']}",
        "resultId": segment["resultId"],
        "incidentId": segment["incidentId"],
        "agencyId": segment["agencyId"],
        "sessionId": segment["sessionId"],
        "cameraId": segment["cameraId"],
        "speakerLabel": segment["speakerLabel"],
        "transcript": segment["transcript"],
        "isPartial": segment["isPartial"],
        "startTime": _ddb_num(segment["startTime"]),
        "endTime": _ddb_num(segment["endTime"]),
        "confidence": _ddb_num(segment["confidence"]),
        "language": segment["language"],
        "timestamp": segment["timestamp"],
        "ttl": ttl,
    }
    try:
        _ddb.Table(TRANSCRIPTS_TABLE).put_item(Item=item)
    except Exception as exc:
        logger.warning(json.dumps({"msg": "transcript_put_failed", "error": str(exc)}))


def _get_session(incident_id: str, session_id: str, agency_id: str) -> dict | None:
    if not SESSIONS_TABLE:
        return None
    try:
        result = _ddb.Table(SESSIONS_TABLE).get_item(
            Key={"pk": f"INCIDENT#{incident_id}", "sk": f"SESSION#{session_id}"}
        )
        item = result.get("Item") or {}
        if not item or item.get("agencyId") != agency_id:
            return None
        return item
    except Exception as exc:
        logger.warning(json.dumps({"msg": "get_session_failed", "error": str(exc)}))
        return None


def _session_should_stop(incident_id: str, session_id: str, agency_id: str) -> bool:
    session = _get_session(incident_id, session_id, agency_id)
    if not session:
        return True
    if session.get("transcriptStatus") != "active":
        return True
    if session.get("status") not in ("active", "pending"):
        return True
    expires = session.get("expiresAt")
    if expires and str(expires) <= datetime.now(timezone.utc).isoformat():
        return True
    return False


def _get_hls_url(stream_ref: str) -> str | None:
    try:
        is_arn = stream_ref.startswith("arn:")
        kwargs = {"StreamARN": stream_ref} if is_arn else {"StreamName": stream_ref}
        ep = _kvs.get_data_endpoint(**kwargs, APIName="GET_HLS_STREAMING_SESSION_URL")
        endpoint = ep["DataEndpoint"]
        kvs_archived = boto3.client("kinesis-video-archived-media", endpoint_url=endpoint)
        resp = kvs_archived.get_hls_streaming_session_url(
            **kwargs,
            PlaybackMode="LIVE",
            Expires=WORKER_DURATION_SECONDS + 120,
            HLSFragmentSelector={"FragmentSelectorType": "SERVER_TIMESTAMP"},
        )
        return resp.get("HLSStreamingSessionURL")
    except Exception as exc:
        logger.error(json.dumps({"msg": "kvs_hls_failed", "error": str(exc)}))
        return None


def _ws_client():
    endpoint = os.environ.get("WEBSOCKET_API_ENDPOINT", "").strip()
    if not endpoint:
        return None
    return boto3.client("apigatewaymanagementapi", endpoint_url=endpoint)


async def _push_segment(agency_id: str, segment: dict) -> None:
    connections = _get_ws_connections(agency_id, str(segment.get("incidentId") or ""))
    if not connections:
        return
    client = _ws_client()
    if client is None:
        return
    payload = json.dumps(
        {
            "type": "rapid-vision.transcript.segment",
            "data": {
                "segment": segment,
                "incidentId": segment["incidentId"],
                "sessionId": segment["sessionId"],
            },
        }
    ).encode()
    loop = asyncio.get_running_loop()
    for conn_id in connections:
        try:
            await loop.run_in_executor(
                None,
                lambda c=conn_id: client.post_to_connection(ConnectionId=c, Data=payload),
            )
        except Exception:
            pass


def _connection_ids(items: list) -> list[str]:
    return [item["connectionId"] for item in items if item.get("connectionId")]


def _get_ws_connections(agency_id: str, incident_id: str) -> list[str]:
    """Prefer ByAgencyIncident when present; this repo's connections table uses GSI2."""
    if not WS_CONNECTIONS_TABLE:
        return []
    table = _ddb.Table(WS_CONNECTIONS_TABLE)
    if incident_id:
        try:
            result = table.query(
                IndexName="ByAgencyIncident",
                KeyConditionExpression="agencyId = :a AND incidentId = :i",
                ExpressionAttributeValues={":a": agency_id, ":i": incident_id},
            )
            ids = _connection_ids(result.get("Items", []))
            if ids:
                return ids
        except Exception:
            pass
    try:
        result = table.query(
            IndexName="GSI2",
            KeyConditionExpression=Key("GSI2PK").eq(f"AGENCY#{agency_id}"),
        )
        return _connection_ids(result.get("Items", []))
    except Exception as exc:
        logger.warning(json.dumps({"msg": "ws_connections_query_failed", "error": str(exc)}))
        return []


def _maybe_continue(params: dict) -> None:
    if _is_mock():
        return
    session_id = str(params.get("sessionId") or "")
    incident_id = str(params.get("incidentId") or "")
    agency_id = str(params.get("agencyId") or "")
    if _session_should_stop(incident_id, session_id, agency_id):
        return
    fn = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "")
    if not fn:
        return
    try:
        _lambda.invoke(
            FunctionName=fn,
            InvocationType="Event",
            Payload=json.dumps(params).encode(),
        )
        logger.info(json.dumps({"msg": "transcript_continuation_invoked", "sessionId": session_id}))
    except Exception as exc:
        logger.warning(json.dumps({"msg": "transcript_continuation_failed", "error": str(exc)}))
