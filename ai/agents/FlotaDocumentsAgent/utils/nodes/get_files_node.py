from pathlib import Path

from ..state import FlotaDocumentsState


def _get_files(path):
    folder = Path(path)
    files = [
        file
        for file in folder.iterdir()
        if file.is_file() and file.suffix.lower() in [".pdf", ".jpg", ".jpeg", ".png"]
    ]
    return files


def get_files_node(state: FlotaDocumentsState):
    folder = state["folder_path"]
    files = _get_files(folder)
    return {"list_of_files": files}
