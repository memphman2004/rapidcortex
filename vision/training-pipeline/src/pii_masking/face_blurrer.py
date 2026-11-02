"""Blur faces, write the processed object, then delete the raw object."""

import hashlib


def mask_raw_object(*, s3, rekognition, bucket: str, raw_key: str, blur) -> dict:
    raw_bytes = s3.get_object(Bucket=bucket, Key=raw_key)["Body"].read()
    original_hash = hashlib.sha256(raw_bytes).hexdigest()
    faces = rekognition.detect_faces(Image={"Bytes": raw_bytes}, Attributes=["DEFAULT"])
    face_count = len(faces.get("FaceDetails", []))
    processed = blur(raw_bytes, faces.get("FaceDetails", []))
    parts = raw_key.split("/")
    if len(parts) < 3 or parts[0] != "raw":
        raise ValueError("Raw key must look like raw/{ingestionId}/{filename}.")
    ingestion_id, filename = parts[1], parts[2]
    processed_key = f"processed/{ingestion_id}/{filename}"
    s3.put_object(Bucket=bucket, Key=processed_key, Body=processed, ContentType="image/jpeg", ServerSideEncryption="aws:kms")
    s3.delete_object(Bucket=bucket, Key=raw_key)
    return {
        "ingestionId": ingestion_id,
        "originalHash": original_hash,
        "facesBlurred": face_count,
        "processedKey": processed_key,
    }
