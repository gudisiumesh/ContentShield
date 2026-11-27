# ContentShield – AI-Powered Content Screening Platform

ContentShield is an AI-powered content screening platform designed to analyze and moderate text and image content using artificial intelligence. It helps identify potentially harmful content through automated text moderation, image analysis and Optical Character Recognition (OCR).

## Features

- **Text Moderation:** Detects potentially harmful text using AI.
- **Image Moderation:** Analyzes uploaded images using an NSFW detection model.
- **OCR (Optical Character Recognition):** Extracts text from images using EasyOCR.
- **Automated Processing:** Uses local Apache Kafka for asynchronous content processing.
- **Database Integration:** Stores user information, submissions and moderation results in PostgreSQL.
- **User Authentication:** Provides signup and login functionality with JWT-based authentication.
- **React Interface:** Provides a user-friendly frontend for submitting and reviewing content.
- **Moderation Scores:** Generates AI-based text and image moderation scores.
- **Submission History:** Allows users to view their submitted content and moderation results.

## Technologies Used

### Frontend

- React.js
- JavaScript
- HTML
- CSS
- Vite

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic

### AI and Image Processing

- Detoxify
- Transformers
- PyTorch
- EasyOCR
- Falconsai NSFW Image Detection Model

### Database and Messaging

- PostgreSQL
- Apache Kafka (Local)
- psycopg

### Authentication

- JWT (JSON Web Tokens)
- pwdlib

## Project Architecture

The application follows an asynchronous content-processing workflow.

1. Users submit content through the React frontend.
2. FastAPI receives and validates the submission.
3. Submission information is stored in PostgreSQL.
4. A Kafka message is sent to the local Kafka broker.
5. The Kafka consumer retrieves the submission.
6. EasyOCR extracts text from uploaded images.
7. The NSFW detection model analyzes the uploaded images.
8. Detoxify analyzes the original submission text together with the text extracted from images.
9. Moderation scores and analysis results are saved in PostgreSQL.
10. Users can view their submission and moderation results.

## Project Structure

```text
ContentShield/
│
├── public/
├── src/
├── main.py
├── kafka_consumer.py
├── text_moderation.py
├── image_moderation.py
├── image_ocr.py
├── requirements.txt
├── package.json
├── package-lock.json
├── index.html
├── vite.config.js
├── eslint.config.js
├── .gitignore
└── README.md
```

## Database Structure

The application uses PostgreSQL to store user information, submissions and moderation results.

Main database tables:

- **users:** Stores registered user information.
- **submissions:** Stores submitted content details.
- **submission_screenshots:** Stores screenshot paths associated with submissions.
- **moderation_results:** Stores text moderation results, analysis status and processing information.
- **image_moderation_results:** Stores image moderation scores and extracted text.

Database name:

```text
Contentshield_db
```

## Local Setup and Installation

### Prerequisites

Install the following software before running the project:

- Python
- Node.js and npm
- PostgreSQL
- Apache Kafka

### 1. Clone the Repository

```bash
git clone https://github.com/gudisiumesh/ContentShield.git
cd ContentShield
```

### 2. Frontend Setup

Install the frontend dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev
```

Vite will display the local frontend URL in the terminal.

### 3. Backend Setup

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI application:

```bash
python -m uvicorn main:app --reload
```

### 4. Database Setup

Create a PostgreSQL database named:

```text
Contentshield_db
```

Create the required database tables using the project's database schema.

Configure your database connection through a `.env` file in the backend project directory.

Example environment configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Contentshield_db
DB_USER=postgres
DB_PASSWORD=your_password
```

Replace `your_password` with your actual PostgreSQL password.

Never upload your actual `.env` file or database credentials to GitHub.

### 5. Apache Kafka Setup

Start your local Apache Kafka broker.

Configure the Kafka broker to use:

```text
localhost:9092
```

The application uses the following Kafka topic:

```text
content-submissions
```

Start the Kafka consumer in a separate terminal:

```bash
python kafka_consumer.py
```

The consumer processes submitted content, performs AI moderation and saves the results in PostgreSQL.

## Application URLs

After starting the local application:

| Service                   | URL                                                      |
| ------------------------- | -------------------------------------------------------- |
| React Frontend            | [http://localhost:5173/](http://localhost:5173/)         |
| FastAPI Backend           | [http://127.0.0.1:8000](http://127.0.0.1:8000)           |
| Swagger API Documentation | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |

## Screenshots

Add actual application screenshots here to demonstrate:

- Login and Signup Pages
- Basic Information Form
- App Details Form
- Review and Submission Page
- Submission Results
- AI Moderation Scores

## Future Enhancements

- Improve AI moderation accuracy.
- Support additional content formats.
- Enhance moderation result visualization.
- Improve application performance and scalability.
- Expand automated content screening capabilities.

## Project Objective

The objective of ContentShield is to provide an integrated platform for screening text and image content through AI-powered moderation, OCR and automated processing.

The project demonstrates the integration of frontend development, backend API development, database management, asynchronous messaging and AI-based content moderation.

## Author

**Umesh Kumar**

GitHub: [https://github.com/gudisiumesh](https://github.com/gudisiumesh)
