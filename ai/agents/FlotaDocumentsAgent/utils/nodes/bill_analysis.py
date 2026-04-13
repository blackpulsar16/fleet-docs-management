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
    version: str = Field(description="Vehicle version")
    model: str = Field(description="Vehicle model (year)")
    niv: str = Field(description="Vehicle Identification Number or serial number")
    motor_serial_numer: str = Field(description="Motor serial number")
    number_cylinders: str = Field(description="Quantity of cilinders")
    vehicle_id: int = Field("7 digit number usually named as clave vehicular")


class Bill(BaseModel):
    issue_date: str = Field(
        description=f"Date of issue of the document in format {date_format}"
    )
    uuid: str = Field(description="Folio fiscal")
    client_name: str = Field(description="Client name")
    vehicle_info: VehicleInfo = Field(
        description="Nested dictionary with vehicle details"
    )


def bill_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": f"""You are an expert OCR for a vehicle bill in spanish.
Analize the image and extract:
- issue date (when the policy begin to apply) in format {date_format}
- UUID or "folio fiscal"
- client name
- vehicle make
- vehicle version
- vehicle model (year)
- NIV or Serial number
- Motor serial number and kind (gasoline/electric/hybrid)
- number of cylinders
- vehicle id usually called as "clave vehicular" (7 digit number).
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
        .with_structured_output(Bill)
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
