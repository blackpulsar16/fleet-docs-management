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

date_format = "%d/%m/%Y"


class GasDictamen(BaseModel):
    issue_date: str = Field(
        description=f"Date of issue of the document in format {date_format}"
    )
    location: str = Field(
        description="COMPLETE document issuance location not to be confused with owner's location"
    )
    serial_number: str = Field(description="Serial number of the vehicle")
    approved: bool = Field(description="If the vehicle passed the inspection")


def dictamen_gas_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    # Gemini
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": f"""You are an expert OCR for an Gas Compliance Certificate in spanish.
Analyze the image and extract:
- issue date in format {date_format}
- Complete issuance location/direction.
- Serial number of the vehicle 
- if the vehicle passed the inspection (true or false)
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
        .with_structured_output(GasDictamen)
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
