from .utils import nodes, FlotaDocumentsState
from langgraph.graph import StateGraph, START, END
from langchain.messages import AIMessage
from langgraph.constants import Send
import os


def route_to_classifier(state: FlotaDocumentsState):
    files = state.get("list_of_files", [])
    # Send all files to be classified in parallel
    return [Send("classify_node", {"file_path": f}) for f in files]


def sync_node(state: FlotaDocumentsState):
    return {}


def route_to_specialized_ocr(state: FlotaDocumentsState):
    classified_docs = state.get("classified_docs", [])
    sends = []

    # Map doc_type to the newest doc dict
    newest_docs_by_type = {}
    for doc in classified_docs:
        doc_type = doc.get("doc_type")
        file_path = doc.get("file_path")
        
        # Skip documents classified as unknown
        if doc_type == "unknown":
            continue
            
        # Get creation/modification time of the file
        try:
            mtime = os.path.getmtime(str(file_path)) # Using mtime (modification time)
        except Exception:
            mtime = 0 # Fallback
            
        if doc_type not in newest_docs_by_type:
            newest_docs_by_type[doc_type] = {"doc": doc, "mtime": mtime}
        else:
            if mtime > newest_docs_by_type[doc_type]["mtime"]:
                newest_docs_by_type[doc_type] = {"doc": doc, "mtime": mtime}

    for doc_type, data in newest_docs_by_type.items():
        doc = data["doc"]
        if doc_type == "dictamen_gas":
            sends.append(Send("dictamen_gas_analysis", doc))
        elif doc_type == "tarjeta_circulacion_front":
            sends.append(Send("circulation_card_analysis", doc))
        elif doc_type == "poliza_seguro":
            sends.append(Send("insurance_pol_analysis", doc))
        elif doc_type == "certificacion_blindaje":
            sends.append(Send("armor_cert_analysis", doc))
        elif doc_type == "bill_make":
            sends.append(Send("bill_analysis", doc))

    return sends


class FolderDocumentsAgent:
    def __init__(self):
        self.agent = self._compile_graph()

    def _compile_graph(self):
        graph = StateGraph(FlotaDocumentsState)
        graph.add_node("get_files", nodes.get_files_node)
        graph.add_node("classify_node", nodes.document_classifier_node)
        graph.add_node("sync_node", sync_node)
        graph.add_node("dictamen_gas_analysis", nodes.dictamen_gas_analysis)
        graph.add_node("circulation_card_analysis", nodes.circulation_card_analysis)
        graph.add_node("insurance_pol_analysis", nodes.insurance_pol_analysis)
        graph.add_node("armor_cert_analysis", nodes.armor_cert_analysis)
        graph.add_node("bill_analysis",nodes.bill_analysis)

        graph.add_edge(START, "get_files")
        graph.add_conditional_edges("get_files", route_to_classifier, ["classify_node"])
        graph.add_edge("classify_node", "sync_node")
        graph.add_conditional_edges(
            "sync_node",
            route_to_specialized_ocr,
            [
                "dictamen_gas_analysis",
                "circulation_card_analysis",
                "insurance_pol_analysis",
                "armor_cert_analysis",
                "bill_analysis"
            ],
        )
        graph.add_edge("dictamen_gas_analysis", END)
        graph.add_edge("circulation_card_analysis", END)
        graph.add_edge("insurance_pol_analysis", END)
        graph.add_edge("armor_cert_analysis", END)
        graph.add_edge("bill_analysis", END)

        agent = graph.compile().with_config(config={"max_concurrency": 3})
        return agent