# Document: Dictamen de Gas (Gas Compliance Certificate)

Extract the following fields from this Mexican Gas Compliance Certificate:

1. **issue_date** — Date of issue in format `{date_format}`.

2. **location** — The COMPLETE address and name of the gas verification center that issued the certificate.
   - Do **not** confuse this with the vehicle owner's address.
   - Include street, number, city, and state when visible.

3. **serial_number** — The vehicle VIN / Número de Serie.
   - Apply the VIN rules from the general section above.
   - It is typically found in a labeled field such as `No. de Serie` or `Número de Identificación Vehicular`.
   - After extraction, count the characters — it must be exactly 17.

4. **approved** — `true` if the vehicle passed the gas inspection, `false` if it did not.
   - Look for words like `APROBADO`, `CUMPLE`, `APRUEBA` (true) or `NO CUMPLE`, `RECHAZADO` (false).
