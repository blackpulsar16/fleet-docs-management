# Configuration for LLMs used in the agent
# You can change the models here instead of going node by node.

# Model used for document classification (in document_classifier_node.py)
CLASSIFICATION_MODEL = "gemini-3.1-flash-lite-preview"
CLASSIFICATION_THINKING_LEVEL = "low"
CLASSIFICATION_IMAGE_RESOLUTION = "media_resolution_low"

# Model used for analysis nodes (e.g., insurance_pol_analysis.py, bill_analysis.py, etc.)
ANALYSIS_MODEL = "gemini-3.1-flash-lite-preview"
ANALYSIS_THINKING_MODEL = "medium"
ANALYSIS_IMAGE_RESOLUTION = "media_resolution_high"
