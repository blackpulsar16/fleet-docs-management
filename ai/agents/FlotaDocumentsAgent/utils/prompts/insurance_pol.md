# Document: Póliza de Seguro (Insurance Policy)

Extract the following fields from this Mexican vehicle insurance policy document:

1. **issue_date** — The date the policy begins to apply (start of coverage) in format `{date_format}`.
   - Look for `Fecha de Inicio`, `Vigencia Desde`, `Inicio de Vigencia`.
   - Do **not** confuse with the document print date or renewal date.

2. **expiration_date** — The date the policy expires in format `{date_format}`.
   - Look for `Fecha de Vencimiento`, `Vigencia Hasta`, `Fin de Vigencia`.

3. **insurance_company** — Full name of the insurance company (`Aseguradora`, `Compañía`).
   - Examples: `Qualitas`, `GNP Seguros`, `AXA Seguros`, `Mapfre`.

4. **policy** — The policy number (`Número de Póliza`, `No. de Póliza`, `Póliza`).
   - May contain letters, digits, and hyphens.

5. **paragraph** — The policy paragraph or section (`Inciso`, `Párrafo`).
   - This is a sub-identifier within the policy, often a short alphanumeric code.
