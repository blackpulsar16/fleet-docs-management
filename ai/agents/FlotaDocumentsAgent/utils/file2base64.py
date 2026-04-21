import base64


def _file2base64(file_path):
    file_bytes = open(file_path, "rb").read()
    file_base64 = base64.b64encode(file_bytes).decode("utf-8")

    if file_path.suffix.lower() == ".pdf":
        type = "file"
        mime_type = "application/pdf"
    elif file_path.suffix.lower() in [".jpg", ".jpeg"]:
        type = "image"
        mime_type = "image/jpeg"
    elif file_path.suffix.lower() == ".png":
        type = "image"
        mime_type = "image/png"

    return file_base64, type, mime_type
