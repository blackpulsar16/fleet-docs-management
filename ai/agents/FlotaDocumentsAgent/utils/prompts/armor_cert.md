# Document: Certificación de Blindaje (Armor Certification)

Extract the following fields from this Mexican armor certification document:

1. **issue_date** — Date of issue in format `{date_format}`.

2. **armoring_company** — Full legal name of the company that performed the armoring.

3. **armor_level** — The armor protection level (e.g. `Nivel B4`, `Nivel WBA4`, `NOM-142`).
   - Include the full level designation as printed.

4. **folio** — The document folio or internal reference number of the certification.

5. **metal_plate_number** — The identification number of the metal plate (`Placa Metálica`) installed on the vehicle.

6. **vehicle_info** — A nested object with the following vehicle details:

   - **make** — Vehicle brand (e.g. `FORD`, `CHEVROLET`, `TOYOTA`).
   - **type** — Vehicle type or line as labeled in this document (may be called `Tipo`, not `Modelo`).
   - **model** — Vehicle model year (4-digit number, e.g. `2022`).
   - **niv** — Vehicle Identification Number (VIN). Apply the VIN rules from the general section.
     It may appear embedded in a paragraph near phrases like `número de identificación vehicular`.
