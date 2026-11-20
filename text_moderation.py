from detoxify import Detoxify

# Load the model
model = Detoxify("original")


def analyze_text(text):
    result = model.predict(text)
    return result