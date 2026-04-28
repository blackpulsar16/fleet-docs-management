from ..state import ClassifiedDocState
from langchain_google_genai import ChatGoogleGenerativeAI
from ..llms.config import (
    ANALYSIS_MODEL,
    ANALYSIS_THINKING_MODEL,
    ANALYSIS_IMAGE_RESOLUTION,
)
from langchain.messages import HumanMessage
from pydantic import BaseModel, Field
from typing import Literal
from ..file2base64 import _file2base64
from ..prompt_loader import load_prompt
from ..types import VinStr

date_format = "%d/%m/%Y"

_VIN_RETRY_SUFFIX = (
    "\n\n⚠️ CORRECTION REQUIRED: The VIN (niv) you returned was rejected because it "
    "did not have exactly 17 characters. Re-examine the document image carefully. "
    "The VIN appears in the paragraph near 'número de identificación vehicular'. "
    "Read every single character individually — do NOT skip any — and count to 17 "
    "before returning. This is the only field that needs correction."
)


class VehicleInfo(BaseModel):
    make: str = Field(description="Vehicle make")
    type: str = Field(description="Vehicle type/line as labeled in the document")
    model: str = Field(description="Vehicle model year (4-digit number)")
    niv: VinStr = Field(description="Vehicle Identification Number — exactly 17 alphanumeric characters")


class ArmorCert(BaseModel):
    issue_date: str = Field(
        description=f"Date of issue of the document in format {date_format}"
    )
    armoring_company: str = Field(description="Full name of the armoring company")
    armor_level: str = Field(description="Armor protection level")
    folio: str = Field(description="Document folio or reference number")
    metal_plate_number: str = Field(description="Metal plate identification number")
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


def _build_messages(prompt_text: str, file_base64: str, type: str, mime_type: str) -> list:
    return [
        HumanMessage(
            content=[
                {"type": "text", "text": prompt_text},
                {"type": type, "base64": file_base64, "mime_type": mime_type},
            ]
        )
    ]


def armor_cert_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    file_base64, type, mime_type = _file2base64(file_path)

    llm = (
        ChatGoogleGenerativeAI(
            model=ANALYSIS_MODEL,
            thinking_level=ANALYSIS_THINKING_MODEL,
            media_resolution=ANALYSIS_IMAGE_RESOLUTION,
        )
        .with_structured_output(ArmorCert, include_raw=True)
    )

    base_prompt = load_prompt("armor_cert", date_format=date_format)
    messages = _build_messages(base_prompt, file_base64, type, mime_type)

    resp = llm.invoke(messages)
    result: ArmorCert | None = resp.get("parsed")

    # If validation failed (most likely an invalid VIN length), retry once
    # with an explicit correction instruction
    if result is None:
        retry_messages = _build_messages(
            base_prompt + _VIN_RETRY_SUFFIX,
            file_base64, type, mime_type,
        )
        resp = llm.invoke(retry_messages)
        result = resp.get("parsed")

    if result is None:
        raise ValueError(
            f"armor_cert_analysis: failed to parse ArmorCert after retry. "
            f"parsing_error={resp.get('parsing_error')}"
        )

    return {
        "final_results": [
            {
                "file_path": file_path,
                "doc_type": state["doc_type"],
                "data": result.model_dump(),
            }
        ]
    }
