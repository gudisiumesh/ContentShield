
import os
import uuid
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.errors import UniqueViolation
from dotenv import load_dotenv
from kafka import KafkaProducer
from pydantic import BaseModel
from pwdlib import PasswordHash
import jwt

from fastapi import (
    FastAPI,
    HTTPException,
    Form,
    File,
    UploadFile,
    Depends,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


# --------------------------------------------------
# Environment configuration
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(title="ContentShield API")


# --------------------------------------------------
# Authentication configuration
# --------------------------------------------------

password_hash = PasswordHash.recommended()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


# --------------------------------------------------
# JWT token verification
# --------------------------------------------------

def verify_token(token: str):

    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="JWT secret key is not configured."
        )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired."
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token."
        )


# --------------------------------------------------
# HTTP Bearer authentication
# --------------------------------------------------

security = HTTPBearer()


# --------------------------------------------------
# Get current authenticated user
# --------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    payload = verify_token(token)

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload."
        )

    return user_id


# --------------------------------------------------
# Authentication request models
# --------------------------------------------------

class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# --------------------------------------------------
# CORS configuration
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5175",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --------------------------------------------------
# Local image storage
# --------------------------------------------------

UPLOAD_FOLDER = BASE_DIR / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_FOLDER),
    name="uploads"
)

MAX_FILE_SIZE = 5 * 1024 * 1024

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


async def save_uploaded_file(file: UploadFile, folder_name: str):

    if not file or not file.filename:
        return None

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG, PNG and WEBP images are allowed."
        )

    try:
        file_content = await file.read(MAX_FILE_SIZE + 1)

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Each image must be smaller than 5 MB."
            )

        folder_path = UPLOAD_FOLDER / folder_name
        folder_path.mkdir(parents=True, exist_ok=True)

        saved_filename = f"{uuid.uuid4().hex}{extension}"
        saved_file_path = folder_path / saved_filename

        saved_file_path.write_bytes(file_content)

        relative_path = (
            Path("uploads") / folder_name / saved_filename
        ).as_posix()

        return {
            "original_filename": file.filename,
            "saved_path": relative_path
        }

    except HTTPException:
        raise

    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not save uploaded image locally."
        ) from exc

    finally:
        await file.close()


# --------------------------------------------------
# Kafka producer - local Kafka
# --------------------------------------------------

producer = None


def get_kafka_producer():

    global producer

    if producer is None:
        try:
            producer = KafkaProducer(
                bootstrap_servers="localhost:9092",
                value_serializer=lambda data: json.dumps(data).encode("utf-8"),
                request_timeout_ms=30000
            )

        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Local Kafka service is currently unavailable."
            ) from exc

    return producer


# --------------------------------------------------
# PostgreSQL database connection
# --------------------------------------------------

def get_db_connection():

    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "Contentshield_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD")
    )


# --------------------------------------------------
# Signup endpoint
# --------------------------------------------------

@app.post("/auth/signup")
def signup(request: SignupRequest):

    full_name = request.full_name.strip()
    email = request.email.strip().lower()

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Full name is required."
        )

    if len(full_name) > 100:
        raise HTTPException(
            status_code=400,
            detail="Full name must not exceed 100 characters."
        )

    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address."
        )

    if len(email) > 255:
        raise HTTPException(
            status_code=400,
            detail="Email address is too long."
        )

    if len(request.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters."
        )

    hashed_password = password_hash.hash(request.password)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    INSERT INTO users (
                        full_name,
                        email,
                        hashed_password
                    )
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (full_name, email, hashed_password)
                )

                user_id = cursor.fetchone()[0]

        return {
            "message": "Account created successfully.",
            "user": {
                "id": user_id,
                "full_name": full_name,
                "email": email
            }
        }

    except UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="Email already registered."
        )

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Database error. Account could not be created."
        ) from exc


# --------------------------------------------------
# Login endpoint
# --------------------------------------------------

@app.post("/auth/login")
def login(request: LoginRequest):

    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="JWT secret key is not configured."
        )

    email = request.email.strip().lower()

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        id,
                        full_name,
                        email,
                        hashed_password
                    FROM users
                    WHERE email = %s
                    """,
                    (email,)
                )

                user = cursor.fetchone()

        if not user or not password_hash.verify(
            request.password,
            user[3]
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password."
            )

        payload = {
            "sub": str(user[0]),
            "exp": datetime.now(timezone.utc)
            + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }

        token = jwt.encode(
            payload,
            JWT_SECRET_KEY,
            algorithm=JWT_ALGORITHM
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user[0],
                "full_name": user[1],
                "email": user[2]
            }
        }

    except HTTPException:
        raise

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Database error. Login could not be completed."
        ) from exc


# --------------------------------------------------
# Home endpoint
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "message": "ContentShield API is running"
    }


# --------------------------------------------------
# Get submissions belonging to logged-in user
# --------------------------------------------------

@app.get("/submissions")
def get_submissions(
    current_user: str = Depends(get_current_user)
):

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        s.id,
                        s.content_title,
                        s.category,
                        s.language,
                        s.content_source,
                        s.description,
                        s.basic_info_image,
                        s.app_icon,
                        s.created_at,
                        ss.screenshot_path
                    FROM submissions s
                    LEFT JOIN submission_screenshots ss
                    ON s.id = ss.submission_id
                    WHERE s.user_id = %s
                    ORDER BY s.id DESC
                    """,
                    (int(current_user),)
                )

                rows = cursor.fetchall()

        submissions = {}

        for row in rows:

            submission_id = row[0]

            if submission_id not in submissions:
                submissions[submission_id] = {
                    "id": row[0],
                    "contentTitle": row[1],
                    "category": row[2],
                    "language": row[3],
                    "contentSource": row[4],
                    "description": row[5],
                    "basic_info_image": row[6],
                    "app_icon": row[7],
                    "created_at": row[8],
                    "screenshots": []
                }

            if row[9] is not None:
                submissions[submission_id]["screenshots"].append(row[9])

        return list(submissions.values())

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Database error. Could not retrieve submissions."
        ) from exc


# --------------------------------------------------
# Create submission - save authenticated user ID
# --------------------------------------------------

@app.post("/submissions")
async def create_submission(

    contentTitle: str = Form(...),
    category: str = Form(...),
    language: str = Form(...),
    contentSource: str = Form(...),
    description: str = Form(...),

    basic_info_image: UploadFile | None = File(None),
    app_icon: UploadFile | None = File(None),
    screenshots: list[UploadFile] = File(default=[]),

    current_user: str = Depends(get_current_user)

):

    if len(screenshots) > 8:
        raise HTTPException(
            status_code=400,
            detail="Maximum 8 screenshots are allowed."
        )

    saved_basic_image = None
    saved_app_icon = None
    saved_screenshots = []

    try:

        if basic_info_image:
            saved_basic_image = await save_uploaded_file(
                basic_info_image,
                "basic_info_images"
            )

        if app_icon:
            saved_app_icon = await save_uploaded_file(
                app_icon,
                "app_icons"
            )

        for file in screenshots:

            saved_file = await save_uploaded_file(
                file,
                "screenshots"
            )

            if saved_file:
                saved_screenshots.append(saved_file)

        # Save submission and authenticated user's ID in PostgreSQL.

        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    INSERT INTO submissions (
                        content_title,
                        category,
                        language,
                        content_source,
                        description,
                        basic_info_image,
                        app_icon,
                        user_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        contentTitle,
                        category,
                        language,
                        contentSource,
                        description,
                        saved_basic_image["saved_path"]
                        if saved_basic_image else None,
                        saved_app_icon["saved_path"]
                        if saved_app_icon else None,
                        int(current_user)
                    )
                )

                submission_id = cursor.fetchone()[0]

                for screenshot in saved_screenshots:

                    cursor.execute(
                        """
                        INSERT INTO submission_screenshots (
                            submission_id,
                            screenshot_path
                        )
                        VALUES (%s, %s)
                        """,
                        (
                            submission_id,
                            screenshot["saved_path"]
                        )
                    )

    except HTTPException:
        raise

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Database error. Submission could not be saved."
        ) from exc

    # Generate a unique analysis run ID.

    analysis_run_id = str(uuid.uuid4())

    # Send the submission event to local Kafka.

    try:

        kafka_producer = get_kafka_producer()

        kafka_producer.send(
            "content-submissions",
            {
                "submission_id": submission_id,
                "analysis_run_id": analysis_run_id
            }
        ).get(timeout=30)

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Submission saved, but Kafka event delivery failed."
        ) from exc

    return {
        "message": "Content submission received and saved successfully",
        "submission_id": submission_id,
        "submission": {
            "contentTitle": contentTitle,
            "category": category,
            "language": language,
            "contentSource": contentSource,
            "description": description
        },
        "files": {
            "basic_info_image": saved_basic_image,
            "app_icon": saved_app_icon,
            "screenshots": saved_screenshots
        }
    }


# --------------------------------------------------
# Get moderation results - verify submission ownership
# --------------------------------------------------

@app.get("/submissions/{submission_id}/moderation-results")
def get_moderation_results(
    submission_id: int,
    current_user: str = Depends(get_current_user)
):

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                # Verify that this submission belongs to the logged-in user.

                cursor.execute(
                    """
                    SELECT id
                    FROM submissions
                    WHERE id = %s AND user_id = %s
                    """,
                    (submission_id, int(current_user))
                )

                submission = cursor.fetchone()

                if submission is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Submission not found"
                    )

                cursor.execute(
                    """
                    SELECT
                        id,
                        analysis_run_id,
                        status,
                        original_text,
                        combined_ocr_text,
                        detoxify_scores,
                        detoxify_model,
                        error_message,
                        created_at,
                        started_at,
                        completed_at
                    FROM moderation_results
                    WHERE submission_id = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                    """,
                    (submission_id,)
                )

                moderation = cursor.fetchone()

                if moderation is None:
                    return {
                        "submission_id": submission_id,
                        "status": "pending",
                        "message": "Moderation analysis has not started yet",
                        "images": []
                    }

                moderation_result_id = moderation[0]

                cursor.execute(
                    """
                    SELECT
                        id,
                        image_path,
                        image_type,
                        extracted_text,
                        nsfw_scores,
                        nsfw_model,
                        created_at
                    FROM image_moderation_results
                    WHERE moderation_result_id = %s
                    ORDER BY id ASC
                    """,
                    (moderation_result_id,)
                )

                image_rows = cursor.fetchall()

        images = []

        for row in image_rows:

            image_path = row[1] or ""

            # Keep existing Cloudinary URLs working.

            if image_path.startswith(("https://", "http://")):
                image_url = image_path

            else:
                image_path = image_path.replace("\\", "/")
                image_url = "/" + image_path.lstrip("/")

            images.append({
                "id": row[0],
                "image_url": image_url,
                "image_type": row[2],
                "extracted_text": row[3],
                "nsfw_scores": row[4],
                "nsfw_model": row[5],
                "created_at": row[6]
            })

        return {
            "submission_id": submission_id,
            "moderation_result_id": moderation[0],
            "analysis_run_id": str(moderation[1]),
            "status": moderation[2],
            "original_text": moderation[3],
            "combined_ocr_text": moderation[4],
            "detoxify_scores": moderation[5],
            "detoxify_model": moderation[6],
            "error_message": moderation[7],
            "created_at": moderation[8],
            "started_at": moderation[9],
            "completed_at": moderation[10],
            "images": images
        }

    except HTTPException:
        raise

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Database error. Could not retrieve moderation results."
        ) from exc
