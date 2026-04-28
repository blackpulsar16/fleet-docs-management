"""
Prompt loader for FlotaDocumentsAgent extraction nodes.

Usage:
    from ..prompt_loader import load_prompt

    text = load_prompt("dictamen_gas", date_format="%d/%m/%Y")
"""

from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(doc_type: str, **kwargs) -> str:
    """
    Load and combine the base OCR prompt with the document-specific prompt,
    then substitute any {placeholders} with the provided keyword arguments.

    Args:
        doc_type: Filename stem of the specific prompt (e.g. "dictamen_gas").
        **kwargs: Variables to substitute into the prompt (e.g. date_format="%d/%m/%Y").

    Returns:
        The fully rendered prompt string.

    Raises:
        FileNotFoundError: If _base.md or the specific prompt file does not exist.
    """
    base_path = _PROMPTS_DIR / "_base.md"
    specific_path = _PROMPTS_DIR / f"{doc_type}.md"

    if not base_path.exists():
        raise FileNotFoundError(f"Base prompt not found: {base_path}")
    if not specific_path.exists():
        raise FileNotFoundError(f"Prompt not found for doc_type '{doc_type}': {specific_path}")

    base = base_path.read_text(encoding="utf-8")
    specific = specific_path.read_text(encoding="utf-8")

    combined = f"{base}\n\n---\n\n{specific}"

    # Substitute placeholders — literal braces in MD must be doubled: {{ }}
    return combined.format(**kwargs)
