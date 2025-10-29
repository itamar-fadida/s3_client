from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from aws_utils import generate_presigned_url, list_zarr_keys
from config import settings

app = FastAPI(title="Traffic Route API", version="1.0")

# CORS (allow frontend dev and prod)
origins = [
    "http://localhost:5173",       # vite dev
    "https://your-prod-domain.com" # your future prod domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


from fastapi import FastAPI
import boto3
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket: str

settings = Settings()

app = FastAPI()

@app.get("/signed-url/route")
def get_route_signed_url():
    s3 = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

    url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": "data/route.zarr/.zattrs"
        },
        ExpiresIn=3600,  # 1 hour
    )
    return {"signed_url": url}


