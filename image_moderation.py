
from transformers import pipeline
from PIL import Image

# Load the NSFW image detection model
model = pipeline(
    "image-classification",
    model="Falconsai/nsfw_image_detection"
)


def analyze_image(image_path):
    image = Image.open(image_path)

    result = model(image)

    return result
