from ..state import ClassifiedDocState
from langchain_google_genai import ChatGoogleGenerativeAI
from ..llms.config import (
    ANALYSIS_MODEL,
    ANALYSIS_THINKING_MODEL,
    ANALYSIS_IMAGE_RESOLUTION,
)
from langchain.messages import HumanMessage
from pydantic import BaseModel, Field
from typing import Literal, Optional
from ..file2base64 import _file2base64
from ..prompt_loader import load_prompt
from ..types import VinStr

date_format = "%d/%m/%Y"


class CirculationCard(BaseModel):
    name: str = Field(description="Full name of the registered owner")
    issue_date: str = Field(description=f"Date of issue in format {date_format}")
    is_permanent: bool = Field(
        default=False,
        description="True if the card is permanent (no expiration date or says 'Permanente')",
    )
    expiration_date: Optional[str] = Field(
        default=None,
        description=f"Expiration date in {date_format} format. Return null if is_permanent is true.",
    )
    niv: VinStr = Field(description="Vehicle Identification Number — exactly 17 alphanumeric characters")
    folio: str = Field(description="Document folio number")
    placa: str = Field(description="Vehicle license plate code")
    use: Literal["particular", "federal"] = Field(description="Vehicle use type")
    federal_entity: str = Field(
        description="Mexican federal entity (state) that issued the card"
    )
    confidence_score: float = Field(
        description="Confidence score between 0.0 and 100.0 indicating how clearly and accurately the data was extracted from the document."
    )
    extraction_notes: str = Field(
        description="Any notes, warnings, or anomalies found during extraction (e.g. 'Document is blurry, VIN is hard to read'). Leave empty if everything is clear.",
        default=""
    )


def circulation_card_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": load_prompt("circulation_card", date_format=date_format),
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
        .with_structured_output(CirculationCard)
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
