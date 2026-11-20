# ContentShield – AI-Powered Content Screening Platform

ContentShield is an AI-powered content screening platform designed to analyze and moderate text and image content using artificial intelligence.

## Features

- **Text Moderation:** Detects potentially harmful text using AI.
- **Image Moderation:** Analyzes uploaded images using AI models.
- **OCR:** Extracts text from images using EasyOCR.
- **Automated Processing:** Uses Apache Kafka for asynchronous content processing.
- **Database Integration:** Uses PostgreSQL to store application data.
- **React Interface:** Provides a user-friendly frontend for submitting and reviewing content.

## Technologies Used

**Frontend**
- React.js
- JavaScript
- HTML
- CSS
- Vite

**Backend**
- Python
- FastAPI

**AI and Processing**
- Detoxify
- Transformers
- PyTorch
- EasyOCR

**Database and Messaging**
- PostgreSQL
- Apache Kafka
- Docker

## Project Structure

- `React frontend files` – React application
- `main.py` – FastAPI application
- `kafka_consumer.py` – Kafka consumer
- `text_moderation.py` – Text moderation
- `image_moderation.py` – Image moderation
- `image_ocr.py` – Image text extraction
- `requirements.txt` – Python dependencies

## Project Objective

The objective of ContentShield is to provide an integrated platform for screening text and image content through AI-powered moderation and automated processing.

## Author

**Umesh Kumar**
