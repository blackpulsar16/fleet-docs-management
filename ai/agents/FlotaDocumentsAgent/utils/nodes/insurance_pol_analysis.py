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

date_format = "%d/%m/%Y"


class InsurancePol(BaseModel):
    issue_date: str = Field(
        description=f"Start date of coverage in format {date_format}"
    )
    expiration_date: str = Field(
        description=f"Expiration date of the policy in format {date_format}"
    )
    insurance_company: str = Field(description="Full name of the insurance company")
    policy: str = Field(description="Policy number")
    paragraph: str = Field(description="Policy paragraph or section (Inciso)")
    confidence_score: float = Field(
        description="Confidence score between 0.0 and 100.0 indicating how clearly and accurately the data was extracted from the document."
    )
    extraction_notes: str = Field(
        description="Any notes, warnings, or anomalies found during extraction (e.g. 'Document is blurry, VIN is hard to read'). Leave empty if everything is clear.",
        default=""
    )


def insurance_pol_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": load_prompt("insurance_pol", date_format=date_format),
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
        .with_structured_output(InsurancePol)
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
