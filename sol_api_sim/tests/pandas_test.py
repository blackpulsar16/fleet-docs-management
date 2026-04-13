import pandas as pd
import numpy as np

FILE_PATH = r"docs\202603189426910.xlsx"

def load_excel():
    try:
        # Cargamos el Excel. index_col=0 asume que 'Económico' es la primera columna.
        df = pd.read_excel(FILE_PATH, index_col=0)
        # Convertimos el índice a string para evitar problemas de búsqueda
        df.index = df.index.astype(str)
        return df
    except Exception as e:
        print(f"Error al cargar el archivo: {e}")
        return None
    
df = load_excel()
print(df.get('UN'))