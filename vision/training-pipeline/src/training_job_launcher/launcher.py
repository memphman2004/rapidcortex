"""Call create_project_version and store status TRAINING. Tests pass a fake client."""

import uuid
from datetime import datetime, timezone


def _s3_key(uri: str, bucket: str) -> str:
    prefix = f"s3://{bucket}/"
    if not uri.startswith(prefix):
        raise ValueError(f"Manifest {uri} is not in bucket {bucket}.")
    return uri[len(prefix) :]


def launch_training_job(
    *,
    dataset_version: str,
    train_manifest_s3_uri: str,
    validation_manifest_s3_uri: str,
    rekognition,
    jobs_table,
    project_arn: str,
    studio_bucket: str,
) -> dict:
    job_id = str(uuid.uuid4())
    version_name = f"nexcortiq-vision-{dataset_version}-{job_id[:8]}"
    output_prefix = f"training-output/{dataset_version}/{job_id}/"
    response = rekognition.create_project_version(
        ProjectArn=project_arn,
        VersionName=version_name,
        OutputConfig={"S3Bucket": studio_bucket, "S3KeyPrefix": output_prefix},
        TrainingData={"Assets": [{"GroundTruthManifest": {"S3Object": {"Bucket": studio_bucket, "Name": _s3_key(train_manifest_s3_uri, studio_bucket)}}}]},
        TestingData={
            "Assets": [{"GroundTruthManifest": {"S3Object": {"Bucket": studio_bucket, "Name": _s3_key(validation_manifest_s3_uri, studio_bucket)}}}],
            "AutoCreate": False,
        },
    )
    project_version_arn = response["ProjectVersionArn"]
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "jobId": job_id,
        "datasetVersion": dataset_version,
        "status": "TRAINING",
        "rekognitionProjectArn": project_arn,
        "rekognitionProjectVersionArn": project_version_arn,
        "rekognitionJobName": version_name,
        "isActiveProductionModel": False,
        "startedAt": now,
        "createdAt": now,
        "updatedAt": now,
    }
    jobs_table.put_item(Item=item)
    return item
