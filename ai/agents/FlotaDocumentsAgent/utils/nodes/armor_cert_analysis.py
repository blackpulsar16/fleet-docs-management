import base64
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

date_format = "%d/%m/%Y"


class VehicleInfo(BaseModel):
    make: str = Field(description="Vehicle make")
    type: str = Field(description="Vehicle type")
    model: str = Field(description="Vehicle model")
    niv: str = Field(description="Vehicle Identification Number")


class ArmorCert(BaseModel):
    issue_date: str = Field(
        description=f"Date of issue of the document in format {date_format}"
    )
    armoring_company: str = Field(description="Armoring company")
    armor_level: str = Field(description="Armor_level")
    folio: str = Field(description="Folio")
    metal_plate_number: str = Field(description="Number of the metal plate")
    vehicle_info: VehicleInfo = Field(
        description="Nested dictionary with vehicle details"
    )


def armor_cert_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    # Gemini
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": f"""You are an expert OCR for an armor certification document.
Analyze the image and extract:
- issue date in format {date_format}
- Armoring company
- Armor level
- Folio
- Metal plate number
- Vehicle make
- Vehicle type (usually the model, but in this document it's called different)
- Vehicle model (year)
- Vehicle Identification Number
""",
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
        .with_structured_output(ArmorCert)
        .invoke([messages])
    )
    # OLLAMA
    #
    #     if file_path.suffix == ".pdf":
    #         encoded_string = _convert_pdf_to_base64_image(file_path)
    #         image_data = f"data:image/png;base64,{encoded_string}"
    #     else:
    #         with open(file_path, "rb") as image_file:
    #             encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
    #             image_data = f"data:image/jpeg;base64,{encoded_string}"

    #     messages = [
    #         SystemMessage(
    #             content="""You are an expert document classifier for an armored vehicle.
    # Analyze deeply the image and determine its type.
    # For a Gas Safety Certificate, Gas Inspection Report, Gas Compliance Certificate return 'dictamen_gas'.
    # For a vehicle registration card return 'tarjeta_circulacion.
    # For a insurance policy return 'poliza_seguro'
    # If the document does not correspond to any of the above you HAVE to return 'unknown'

    # IMPORTANT!
    # You must respond ONLY with a raw JSON object and nothing else. No markdown, no explanations.
    # The JSON must have this exact structure:
    # {"document": "dictamen_gas" | "tarjeta_circulacion" | "poliza_seguro" | "certificacion_blindaje" | "unknown"}
    # """
    #         ),
    #         HumanMessage(content=[{"type": "image_url", "image_url": image_data}]),
    #     ]

    #     response = (
    #         ChatOllama(model="ministral-3:3b", temperature=0, format="json")
    #         .with_structured_output(DocumentOCR)
    #         .invoke(messages)
    #     )

    # response is now a DocumentOCR instance
    return {
        "final_results": [
            {
                "file_path": file_path,
                "doc_type": state["doc_type"],
                "data": response.model_dump(),
            }
        ]
    }
