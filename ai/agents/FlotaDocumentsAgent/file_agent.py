from .utils import nodes, SingleFileState
from langgraph.graph import StateGraph, START, END
from langchain.messages import AIMessage
from langgraph.constants import Send
import os


def sync_node(state: SingleFileState):
    return {}

def route_to_specialized_ocr(state: SingleFileState):
    doc = state["classified_docs"][0]
    doc_type = doc["doc_type"]

    if doc_type == "unknown":
        return "unknown"
    elif doc_type == "dictamen_gas":
        return Send("dictamen_gas_analysis",doc)
    elif doc_type == "tarjeta_circulacion_front":
        return Send("circulation_card_analysis",doc)
    elif doc_type == "poliza_seguro":
        return Send("insurance_pol_analysis",doc)
    elif doc_type == "certificacion_blindaje":
        return Send("armor_cert_analysis",doc)
    elif doc_type == "bill_make":
        return Send("bill_analysis",doc)


class SingleFileAgent:
    def __init__(self):
        self.agent = self._compile_graph()

    def _compile_graph(self):
        graph = StateGraph(SingleFileState)
        graph.add_node("classify_node", nodes.document_classifier_node)
        graph.add_node("dictamen_gas_analysis", nodes.dictamen_gas_analysis)
        graph.add_node("circulation_card_analysis", nodes.circulation_card_analysis)
        graph.add_node("insurance_pol_analysis", nodes.insurance_pol_analysis)
        graph.add_node("armor_cert_analysis", nodes.armor_cert_analysis)
        graph.add_node("bill_analysis",nodes.bill_analysis)

        graph.add_edge(START, "classify_node")
        graph.add_conditional_edges(
            "classify_node",
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