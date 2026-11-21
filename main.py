
import os
import uuid
from pathlib import Path
import json

import psycopg
from dotenv import load_dotenv
from kafka import KafkaProducer

from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


load_dotenv()

app = FastAPI()
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")

producer = None

if KAFKA_BOOTSTRAP_SERVERS:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda data: json.dumps(data).encode("utf-8")
    )


# Allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database connection settings
def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


# Folder where uploaded files will be stored
UPLOAD_FOLDER = Path(__file__).resolve().parent / "uploads"

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_FOLDER),
    name="uploads"
)


# Save uploaded files permanently
async def save_uploaded_file(file: UploadFile, folder_name: str):
    if not file or not file.filename:
        return None

    folder_path = UPLOAD_FOLDER / folder_name
    folder_path.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename).suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{extension}"

    file_path = folder_path / unique_filename

    with open(file_path, "wb") as destination:
        while True:
            chunk = await file.read(1024 * 1024)

            if not chunk:
                break

            destination.write(chunk)

    return {
        "original_filename": file.filename,
        "saved_path": str(file_path.relative_to(UPLOAD_FOLDER.parent))
    }


# Home endpoint
@app.get("/")
def home():
    return {"message": "ContentShield API is running"}


#
@app.get("/submissions")
def get_submissions():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
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
                    ORDER BY s.id DESC
                """)

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

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error. Could not retrieve submissions."
        )

# ContentShield submission endpoint
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
):

    if len(screenshots) > 8:
        raise HTTPException(
            status_code=400,
            detail="Maximum 8 screenshots are allowed"
        )

    # Save uploaded files
    saved_basic_image = await save_uploaded_file(
        basic_info_image,
        "basic_info_images"
    ) if basic_info_image else None

    saved_app_icon = await save_uploaded_file(
        app_icon,
        "app_icons"
    ) if app_icon else None

    saved_screenshots = []

    for file in screenshots:
        saved_file = await save_uploaded_file(
            file,
            "screenshots"
        )
        saved_screenshots.append(saved_file)

    # Save submission details in PostgreSQL
    try:
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
                        app_icon
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
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
                        if saved_app_icon else None
                    )
                )

                submission_id = cursor.fetchone()[0]

                # Save screenshot paths with their submission ID
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

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error. Submission could not be saved."
        )

    # Generate a unique ID for this analysis run
    analysis_run_id = str(uuid.uuid4())

    # Send submission ID and analysis run ID to Kafka
    if producer:
    producer.send(
        "content-submissions",
        {
            "submission_id": submission_id,
            "analysis_run_id": analysis_run_id
        }
    )
    producer.flush()

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



# Get moderation results for a submission
@app.get("/submissions/{submission_id}/moderation-results")
def get_moderation_results(submission_id: int):

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:

                # Check whether the submission exists
                cursor.execute(
                    """
                    SELECT id
                    FROM submissions
                    WHERE id = %s
                    """,
                    (submission_id,)
                )

                submission = cursor.fetchone()

                if submission is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Submission not found"
                    )

                # Retrieve the latest analysis
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

                # Retrieve image moderation results
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

        # Prepare image results for React
        images = []

        for row in image_rows:
            image_path = row[1].replace("\\", "/")
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

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error. Could not retrieve moderation results."
        )
