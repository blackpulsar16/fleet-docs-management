# Document: Tarjeta de Circulación (Vehicle Registration Card)

Extract the following fields from this Mexican vehicle registration card:

1. **name** — Full name of the registered owner (`Propietario`, `Nombre`).

2. **issue_date** — Date the card was issued in format `{date_format}`.
   - Look for `Fecha de Expedición`.

3. **is_permanent** — `true` if the card is permanent (does not expire).
   - Set to `true` if the card explicitly says `Permanente`, `Indefinida`, or has no expiration date.

4. **expiration_date** — Expiration date in format `{date_format}`.
   - Return `null` if `is_permanent` is `true`.
   - Do **not** confuse with `Fecha de Expedición` (issue date).
   - Look for `Fecha de Vencimiento`, `Vigencia`, `Válida hasta`.

5. **niv** — Vehicle Identification Number (VIN). Apply the VIN rules from the general section.
   - It is **always exactly 17 alphanumeric characters**. If you find 16, look at the end of the line, the next line, or for spaces splitting the number. Combine them.

6. **folio** — Document folio number.

7. **placa** — Vehicle license plate (`Placa`).
   - Extract only the alphanumeric plate code, not the state name.

8. **use** — Vehicle use type. Return `"particular"` for private use, `"federal"` for federal use.

9. **federal_entity** — The Mexican federal entity (state) that issued the card.
   - Examples: `Ciudad de México`, `Estado de México`, `Jalisco`, `Nuevo León`.
