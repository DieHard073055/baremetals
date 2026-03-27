from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:baremetals@localhost:5432/baremetals"
    secret_key: str = "changeme-use-a-long-random-string-in-production"
    metal_price_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
