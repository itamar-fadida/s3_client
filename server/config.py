from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket: str
    route_zarr_prefix: str
    traffic_zarr_prefix: str
    signed_url_expire: int = 3600

    class Config:
        env_file = ".env"

settings = Settings()
