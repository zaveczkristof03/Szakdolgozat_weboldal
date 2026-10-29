
from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class ECGDatabase(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    name: str = Field(index=True, unique=True)
    records: int
    frequency: int
    leads: int
    category: str

    source_url: str
    description: str
    license: Optional[str] = None
    last_verified: Optional[date] = None
