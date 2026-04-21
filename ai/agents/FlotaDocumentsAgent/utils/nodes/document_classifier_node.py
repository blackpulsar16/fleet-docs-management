from ..state import FileState
from langchain_google_genai import ChatGoogleGenerativeAI
from ..llms.config import (
    CLASSIFICATION_MODEL,
    CLASSIFICATION_THINKING_LEVEL,
    CLASSIFICATION_IMAGE_RESOLUTION,
)
from langchain.messages import HumanMessage
from pydantic import BaseModel, Field
from typing import Literal
from time import sleep
from ..file2base64 import _file2base64


class DocumentOCR(BaseModel):
    document: Literal[
        "dictamen_gas",
        "tarjeta_circulacion_front",
        "tarjeta_circulacion_back",
        "poliza_seguro",
        "certificacion_blindaje",
        "inventory_intake",
        "outbound_inventory",
        "bill_make",
        "bill_other",
        "unknown",
    ] = Field(description="Type of document")


def document_classifier_node(state: FileState):
    file_path = state["file_path"]
    file_base64, type, mime_type = _file2base64(file_path)

    messages = HumanMessage(
        content=[
            {
                "type": "text",
                "text": """You are an expert document classifier for an armored vehicle.
Analyze deeply the image and determine its type.
For a Gas Safety Certificate, Gas Inspection Report, Gas Compliance Certificate return 'dictamen_gas'.
For a front vehicle registration card return 'tarjeta_circulacion_front'.
For a back vehicle registration card return 'tarjeta_circulacion_back'.
For a insurance policy return 'poliza_seguro'
For an armor certificate return 'certificacion_blindaje'
For an armor input inventory return 'input_inventory'
For an armor outbound inventory return 'outbound_inventory'
For the vehicle MAKE bill (Issued by the vehicle manufacturer like Ford, Toyota, Chevrolet, etc., not by any other company or institution.) return 'bill_make'
For any other kind of bill return 'bill_other'
If the document does not correspond to any of the above you HAVE to return 'unknown'""",
            },
            {
                "type": type,
                "base64": file_base64,
                "mime_type": mime_type,
            },
        ]
    )

    sleep(5)

    response = (
        ChatGoogleGenerativeAI(
            model=CLASSIFICATION_MODEL,
            thinking_level=CLASSIFICATION_THINKING_LEVEL,
            media_resolution=CLASSIFICATION_IMAGE_RESOLUTION,
            timeout=600,  # 10 min timeout requerido por Flex
            model_kwargs={"generation_config": {"service_tier": "flex"}},  # Flex tier: 50% cheaper, latency-tolerant
        )
        .with_structured_output(DocumentOCR)
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

    return {
        "classified_docs": [{"file_path": file_path, "doc_type": response.document}]
    }
