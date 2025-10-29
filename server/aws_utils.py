import boto3
from botocore.client import Config
from typing import List
from config import settings



# Create a reusable S3 client
s3 = boto3.client(
    "s3",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    config=Config(signature_version="s3v4")
)


def generate_presigned_url(key: str, expires_in: int = settings.signed_url_expire) -> str:
    """Generate a signed URL for S3 GET access."""
    return s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def list_zarr_keys(prefix: str) -> List[str]:
    """List all object keys under a Zarr prefix (e.g., route.zarr/)."""
    paginator = s3.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys
