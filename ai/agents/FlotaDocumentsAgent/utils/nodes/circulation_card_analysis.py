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
from typing import Literal, Optional
from ..file2base64 import _file2base64

date_format = "%d/%m/%Y"


class CirculationCard(BaseModel):
    name: str = Field(description="Owner's name")
    issue_date: str = Field(description=f"Date of issue in format {date_format}")
    is_permanent: bool = Field(
        default=False,
        description="Set to true if the document explicitly says 'Permanente' or lacks an expiration date (indefinite).",
    )
    expiration_date: Optional[str] = Field(
        default=None,
        description=f"Expiration date in {date_format} format. Return null if is_permanent is true.",
    )
    niv: str = Field(description="NIV, 17 characters number")
    folio: str = Field(description="Folio")
    placa: str = Field(description="Placa")
    use: Literal["particular", "federal"] = Field(description="Use")
    federal_entity: str = Field(
        description="Mexican federal entity that emmited the card like 'Estado de Mexico' or 'Ciudad de Mexico',etc."
    )


def circulation_card_analysis(state: ClassifiedDocState):
    file_path = state["file_path"]
    # Gemini
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": f"""You are an expert OCR for an mexican vehicle registration card in spanish.
Analyze the image and extract:
- Owner's name
- Date of issue in format {date_format}
- Check if its a permanent circulation card, usually don't have expedition date or say undefined.
- Expiration date in format {date_format} if exist (Dont confuse with date of issue or 'fecha de expedicion' in spanish), if it is a permanent expedition card return it as null
- NIV id (17 characters).
- Folio
- Placa (vehicle license plate)
- Use reason (private or federal)
- Federal entity of emission (Mexicans federal entities like 'Estado de Mexico', 'Ciudad de Mexico', etc.)
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
        .with_structured_output(CirculationCard)
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
