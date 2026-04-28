from ..state import ClassifiedDocState
from langchain_google_genai import ChatGoogleGenerativeAI
from ..llms.config import (
    ANALYSIS_MODEL,
    ANALYSIS_THINKING_MODEL,
    ANALYSIS_IMAGE_RESOLUTION,
)
from langchain.messages import HumanMessage
from pydantic import BaseModel, Field
from ..file2base64 import _file2base64
from ..prompt_loader import load_prompt
from ..types import VinStr

date_format = "%d/%m/%Y"


class VehicleInfo(BaseModel):
    make: str = Field(description="Vehicle brand")
    version: str = Field(description="Vehicle version or trim level")
    model: str = Field(description="Vehicle model year (4-digit number)")
    niv: VinStr = Field(description="Vehicle Identification Number — exactly 17 alphanumeric characters")
    motor_serial_numer: str = Field(description="Motor/engine serial number")
    number_cylinders: str = Field(description="Number of engine cylinders")
    vehicle_id: int = Field(description="7-digit internal vehicle key (Clave Vehicular)")


class Bill(BaseModel):
    issue_date: str = Field(
        description=f"Date of issue of the document in format {date_format}"
    )
    uuid: str = Field(description="Fiscal folio UUID (Folio Fiscal)")
    client_name: str = Field(description="Full name of the buyer/client")
    vehicle_info: VehicleInfo = Field(
        description="Nested object with vehicle details"
    )
    confidence_score: float = Field(
        description="Confidence score between 0.0 and 100.0 indicating how clearly and accurately the data was extracted from the document."
    )
    extraction_notes: str = Field(
        description="Any notes, warnings, or anomalies found during extraction (e.g. 'Document is blurry, VIN is hard to read'). Leave empty if everything is clear.",
        default=""
    )


def bill_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": load_prompt("bill_make", date_format=date_format),
            },
            {
                "type": type,
                "base64": file_base64,
                "mime_type": mime_type,
            },
        ]
    )
    response = (
        ChatGoogleGenerativeAI(
            model=ANALYSIS_MODEL,
            thinking_level=ANALYSIS_THINKING_MODEL,
            media_resolution=ANALYSIS_IMAGE_RESOLUTION,
        )
        .with_structured_output(Bill)
        .invoke([messages])
    )

    return {
        "final_results": [
            {
                "file_path": file_path,
                "doc_type": state["doc_type"],
                "data": response.model_dump(),
            }
        ]
    }
