from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import boto3
from pydantic_settings import BaseSettings, SettingsConfigDict
from botocore.exceptions import ClientError

class Settings(BaseSettings):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket: str
    route_zarr_prefix: str
    traffic_zarr_prefix: str
    signed_url_expire: int

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()

app = FastAPI(title="Traffic Route API", version="1.0")

# --- CORS ---
origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/proxy/route")
def get_route_base_url():
    """Return the proxy base URL for the client to use"""
    return {"base_url": "http://localhost:8000/proxy/route"}

@app.get("/proxy/route/{path:path}")
async def proxy_s3_file(path: str):
    """Proxy S3 files to the client, avoiding CORS and authentication issues"""
    s3_key = f"data/route.zarr/{path}"
    
    try:
        s3 = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        
        print(f"Fetching: {s3_key}")
        
        response = s3.get_object(Bucket=settings.s3_bucket, Key=s3_key)
        content = response['Body'].read()
        content_type = response.get('ContentType', 'application/octet-stream')
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise HTTPException(status_code=404, detail=f"File not found: {s3_key}")
        else:
            print(f"S3 Error: {e}")
            raise HTTPException(status_code=500, detail=f"S3 error: {error_code}")
