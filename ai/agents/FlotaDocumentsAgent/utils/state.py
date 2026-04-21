from typing_extensions import TypedDict, Annotated
import operator
from langchain.messages import AnyMessage


class FlotaDocumentsState:
    messages: Annotated[list[AnyMessage], operator.add]
    folder_path: str
    list_of_files: list
    classified_docs: Annotated[list[dict],operator.add]
    final_results: Annotated[list[dict], operator.add]

class FileState(TypedDict):
    file_path: str
    
class ClassifiedDocState(TypedDict):
    file_path: str
    doc_type: str


class SingleFileState:
    messages: Annotated[list[AnyMessage], operator.add]
    file_path: str
    classified_docs: Annotated[list[dict],operator.add]
    final_results: Annotated[list[dict], operator.add]