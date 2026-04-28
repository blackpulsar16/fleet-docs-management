"""
Shared Pydantic type aliases for FlotaDocumentsAgent models.
"""

from typing import Annotated
from pydantic import StringConstraints, BeforeValidator

def sanitize_vin(v: str) -> str:
    if not isinstance(v, str):
        return v
    # Remove all spaces and common symbols before checking length
    v = v.replace(" ", "").replace("-", "")
    # Auto-correct common OCR mistakes in VINs
    return v.upper().replace('O', '0').replace('I', '1').replace('Q', '0')

# Vehicle Identification Number — always exactly 17 uppercase alphanumeric characters.
# We auto-sanitize common OCR errors. We relax the regex to allow any A-Z0-9 so that
# if the AI hallucinated an invalid char, it doesn't crash the pipeline,
# allowing the Human-in-the-Loop to manually correct it in the UI.
VinStr = Annotated[
    str,
    BeforeValidator(sanitize_vin),
    StringConstraints(
        strip_whitespace=True,
        to_upper=True,
        min_length=5,
        max_length=25,
        pattern=r"^[A-Z0-9]+$",
    ),
]
