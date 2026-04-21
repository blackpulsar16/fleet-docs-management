from datetime import date, datetime
from dateutil.relativedelta import relativedelta

DOCUMENTS = {
    "dictamen_gas",
    "tarjeta_circulacion_front",
    "poliza_seguro",
    "certificacion_blindaje",
    "bill_make"
}


def calculate_status(documents: list):
    status = "ok"
    missing_docs = set(DOCUMENTS)
    expired_docs = {}
    today = date.today()

    for document in documents:
        document_name = document["doc_type"]
        missing_docs.discard(document_name)
        
        data = document.get("data") or {}
        has_expiration = "expiration_date" in data
        has_issue = "issue_date" in data
        
        if has_expiration or document_name == "dictamen_gas":
            try:
                if has_expiration:
                    exp_date = datetime.strptime(data["expiration_date"], "%d/%m/%Y").date()
                elif has_issue:
                    exp_date = (datetime.strptime(data["issue_date"], "%d/%m/%Y").date() 
                                + relativedelta(years=1))
                else:
                    continue  # Missing dates

                days_left = (exp_date - today).days
                if days_left < 0:
                    expired_docs[document_name] = days_left
                    status = "critical"
                elif days_left <= 30:
                    expired_docs[document_name] = days_left
                    if status != "critical":
                        status = "warning"
            except (ValueError, KeyError, TypeError) as e:
                print(f"Date processing error for {document_name}: {e}")

    if missing_docs:
        status = "critical"

    return status, expired_docs, list(missing_docs)
