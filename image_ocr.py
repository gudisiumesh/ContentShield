
import easyocr

# Load the OCR model
reader = easyocr.Reader(['en'])


def extract_text_from_image(image_path):
    result = reader.readtext(image_path)

    extracted_text = []

    for item in result:
        extracted_text.append(item[1])

    return " ".join(extracted_text)
