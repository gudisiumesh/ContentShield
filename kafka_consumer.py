
from image_moderation import analyze_image
from image_ocr import extract_text_from_image

import os
import json
import psycopg

from dotenv import load_dotenv
from kafka import KafkaConsumer
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from text_moderation import analyze_text
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DETOXIFY_MODEL = "original"
NSFW_MODEL = "Falconsai/nsfw_image_detection"


# Database connection
def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "Contentshield_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD")
    )


# Resolve locally stored image paths
def resolve_image_path(stored_path):
    if not stored_path:
        raise FileNotFoundError("Image path is empty.")

    # Cloudinary URLs belong to the previous cloud setup.
    # Do not treat a URL as a local filesystem path.
    if stored_path.startswith(("http://", "https://")):
        raise ValueError(
            "This image is stored as a cloud URL, not a local file. "
            "It cannot be processed by the local consumer."
        )

    image_path = Path(stored_path)

    if not image_path.is_absolute():
        image_path = BASE_DIR / image_path

    image_path = image_path.resolve()

    if not image_path.is_file():
        raise FileNotFoundError(
            f"Image file was not found: {image_path}"
        )

    return image_path


# Retrieve submission details and screenshot paths
def get_submission(submission_id):
    conn = get_db_connection()

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT *
                FROM submissions
                WHERE id = %s
                """,
                (submission_id,)
            )

            submission = cur.fetchone()

            cur.execute(
                """
                SELECT screenshot_path
                FROM submission_screenshots
                WHERE submission_id = %s
                """,
                (submission_id,)
            )

            screenshots = cur.fetchall()

            return submission, screenshots

    finally:
        conn.close()


# Create a new analysis record or recover an existing run
def create_analysis_run(submission_id, analysis_run_id):
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO moderation_results (
                    submission_id,
                    analysis_run_id,
                    status,
                    started_at
                )
                VALUES (%s, %s, 'processing', CURRENT_TIMESTAMP)
                ON CONFLICT (analysis_run_id) DO NOTHING
                RETURNING id
                """,
                (submission_id, analysis_run_id)
            )

            result = cur.fetchone()

            if result is not None:
                moderation_result_id = result[0]

                conn.commit()

                print("New analysis record created:", moderation_result_id)

                return moderation_result_id

            # Find the existing analysis record
            cur.execute(
                """
                SELECT id, status
                FROM moderation_results
                WHERE analysis_run_id = %s
                FOR UPDATE
                """,
                (analysis_run_id,)
            )

            existing_result = cur.fetchone()

            if existing_result is None:
                raise Exception(
                    "Existing analysis record could not be found."
                )

            moderation_result_id, status = existing_result

            # Skip analyses already completed
            if status == "completed":
                conn.commit()

                print("Analysis already completed.")

                return None

            # Recover failed or interrupted analyses
            cur.execute(
                """
                UPDATE moderation_results
                SET
                    status = 'processing',
                    started_at = CURRENT_TIMESTAMP,
                    completed_at = NULL,
                    error_message = NULL
                WHERE id = %s
                """,
                (moderation_result_id,)
            )

            # Remove previous image results before retrying
            cur.execute(
                """
                DELETE FROM image_moderation_results
                WHERE moderation_result_id = %s
                """,
                (moderation_result_id,)
            )

            conn.commit()

            print("Recovering existing analysis:", moderation_result_id)

            return moderation_result_id

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# Save all ML results in PostgreSQL
def save_moderation_results(
    moderation_result_id,
    original_text,
    combined_ocr_text,
    text_scores,
    image_results
):
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:

            # Save one result for each analyzed image
            for image_result in image_results:
                cur.execute(
                    """
                    INSERT INTO image_moderation_results (
                        moderation_result_id,
                        image_path,
                        image_type,
                        extracted_text,
                        nsfw_scores,
                        nsfw_model
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        moderation_result_id,
                        image_result["image_path"],
                        image_result["image_type"],
                        image_result["extracted_text"],
                        Jsonb(image_result["nsfw_scores"]),
                        NSFW_MODEL
                    )
                )

            # Save combined text results and complete the analysis
            cur.execute(
                """
                UPDATE moderation_results
                SET
                    original_text = %s,
                    combined_ocr_text = %s,
                    detoxify_scores = %s,
                    detoxify_model = %s,
                    status = 'completed',
                    completed_at = CURRENT_TIMESTAMP,
                    error_message = NULL
                WHERE id = %s
                """,
                (
                    original_text,
                    combined_ocr_text,
                    Jsonb(text_scores),
                    DETOXIFY_MODEL,
                    moderation_result_id
                )
            )

        conn.commit()

        print("All moderation results saved successfully.")

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# Mark an analysis as failed if an error occurs
def mark_analysis_failed(moderation_result_id, error):
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE moderation_results
                SET
                    status = 'failed',
                    error_message = %s
                WHERE id = %s
                """,
                (str(error), moderation_result_id)
            )

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# Kafka consumer
consumer = KafkaConsumer(
    "content-submissions",
    bootstrap_servers="localhost:9092",
    group_id="contentshield-ml-group",
    auto_offset_reset="earliest",
    enable_auto_commit=False,
    value_deserializer=lambda data: json.loads(data.decode("utf-8"))
)


print("ContentShield consumer started...")


for message in consumer:

    submission_id = message.value["submission_id"]
    analysis_run_id = message.value.get("analysis_run_id")

    print("Received submission ID:", submission_id)

    # Ignore old messages without an analysis UUID
    if not analysis_run_id:
        print("Skipping old message without analysis run ID.")

        consumer.commit()
        continue

    print("Received analysis run ID:", analysis_run_id)

    # Create or recover the analysis record
    moderation_result_id = create_analysis_run(
        submission_id,
        analysis_run_id
    )

    # Skip an analysis that has already completed
    if moderation_result_id is None:
        print("Duplicate completed analysis. Skipping.")

        consumer.commit()
        continue

    try:
        # Retrieve submission details
        submission, screenshots = get_submission(submission_id)

        if submission is None:
            raise Exception(
                f"Submission {submission_id} was not found."
            )

        print("Submission details:", submission)
        print("Screenshots:", screenshots)

        # Collect image paths and their types
        image_items = []

        if submission["basic_info_image"]:
            image_items.append({
                "image_path": submission["basic_info_image"],
                "image_type": "basic_info_image"
            })

        if submission["app_icon"]:
            image_items.append({
                "image_path": submission["app_icon"],
                "image_type": "app_icon"
            })

        for screenshot in screenshots:
            image_items.append({
                "image_path": screenshot["screenshot_path"],
                "image_type": "screenshot"
            })

        # Extract OCR text and analyze every image
        extracted_image_text = []
        image_results = []

        for image_item in image_items:

            stored_path = image_item["image_path"]

            # Locate the image in the local uploads folder
            full_path = resolve_image_path(stored_path)

            # Extract text from this image
            extracted_text = extract_text_from_image(str(full_path))

            extracted_image_text.append(extracted_text)

            print("Extracted image text:", extracted_text)

            # Analyze this image using the NSFW model
            nsfw_scores = analyze_image(str(full_path))

            image_results.append({
                "image_path": stored_path,
                "image_type": image_item["image_type"],
                "extracted_text": extracted_text,
                "nsfw_scores": nsfw_scores
            })

            print("Image moderation scores:", nsfw_scores)

        # Combine original submission text
        original_text = " ".join([
            submission["content_title"] or "",
            submission["content_source"] or "",
            submission["description"] or ""
        ])

        # Combine OCR text from all images
        combined_ocr_text = " ".join(extracted_image_text)

        # Analyze original text and combined OCR text
        text_to_analyze = original_text + " " + combined_ocr_text

        text_scores = analyze_text(text_to_analyze)

        print("Text moderation scores:", text_scores)

        # Save all results in PostgreSQL
        save_moderation_results(
            moderation_result_id,
            original_text,
            combined_ocr_text,
            text_scores,
            image_results
        )

        # Commit Kafka message after successful database save
        consumer.commit()

        print(
            "Analysis completed successfully:",
            moderation_result_id
        )

    except Exception as error:

        print("Analysis failed:", error)

        mark_analysis_failed(moderation_result_id, error)

        # Do not commit the Kafka message.
        # Kafka can deliver it again when the consumer restarts.
        raise
