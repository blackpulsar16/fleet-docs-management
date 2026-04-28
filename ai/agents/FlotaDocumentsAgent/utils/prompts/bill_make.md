# Document: Carta Factura / Factura de Vehículo (Vehicle Bill of Sale)

Extract the following fields from this Mexican vehicle bill of sale (Carta Factura):

1. **issue_date** — Date the bill was issued in format `{date_format}`.
   - Look for `Fecha de Expedición` or `Fecha`.

2. **uuid** — The fiscal folio UUID (`Folio Fiscal`), a 36-character alphanumeric string with hyphens (e.g. `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`).
   - It may also appear as a QR code label or below the digital stamp section.

3. **client_name** — Full name of the buyer / client (`Receptor`, `Cliente`, `Nombre del Comprador`).

4. **vehicle_info** — A nested object with the following vehicle details:

   - **make** — Vehicle brand (e.g. `FORD`, `FREIGHTLINER`, `CHEVROLET`).
   - **version** — Vehicle version or trim level (e.g. `M2106 33K`, `XLT`, `LIMITED`).
   - **model** — Vehicle model year as a 4-digit number (e.g. `2022`).
   - **niv** — Vehicle Identification Number (VIN) or serial number. Apply the VIN rules from the general section above.
   - **motor_serial_numer** — Motor / engine serial number (may include letters and digits).
   - **number_cylinders** — Number of engine cylinders as a string (e.g. `6`, `8`).
   - **vehicle_id** — 7-digit internal vehicle key, usually labeled `Clave Vehicular`.
