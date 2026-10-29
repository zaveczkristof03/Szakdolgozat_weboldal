
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

DATABASE_PATH = Path(__file__).parent / "ekg_metadata.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


def create_db_and_tables():
    # Create tables that do not exist yet.
    SQLModel.metadata.create_all(engine)

    # Add new columns to an existing SQLite table when needed.
    with engine.connect() as connection:
        inspector = inspect(connection)

        if "ecgdatabase" not in inspector.get_table_names():
            return

        existing_columns = {
            column["name"]
            for column in inspector.get_columns("ecgdatabase")
        }

        new_columns = {
            "source_url": "TEXT NOT NULL DEFAULT ''",
            "description": "TEXT NOT NULL DEFAULT ''",
            "license": "TEXT",
            "last_verified": "DATE",
        }

        for column_name, column_type in new_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(
                        f"ALTER TABLE ecgdatabase "
                        f"ADD COLUMN {column_name} {column_type}"
                    )
                )

        connection.commit()


def get_session():
    with Session(engine) as session:
        yield session
