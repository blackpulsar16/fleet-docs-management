from dotenv import load_dotenv
from pathlib import Path

load_dotenv()
try:
    from agents.FlotaDocumentsAgent import SingleFileAgent
except Exception:
    raise


def agent(path: str):
    path = Path(path)
    flota_docs = SingleFileAgent()
    result = flota_docs.agent.invoke({"file_path": path})
    return result.get("final_results")[0]
