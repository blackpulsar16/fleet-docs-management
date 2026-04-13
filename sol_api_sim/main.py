import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np

FILE_PATH = "docs/202603189426910.xlsx"

df_global = None
plazas_dict_global = {}
status_dict_global = {}
last_mtime = 0

def load_excel_data():
    try:
        new_df = pd.read_excel(FILE_PATH, index_col=0)
        new_df.index = new_df.index.astype(str)
        new_plazas = new_df['UN'].replace({np.nan: "SIN PLAZA"}).to_dict()
        new_status = new_df['Estatus'].replace({np.nan: "SIN ESTATUS"}).to_dict()
        return new_df, new_plazas, new_status
    except Exception as e:
        print(f"Error loading file: {e}")
        return None, None

async def file_watcher():
    global df_global, plazas_dict_global, last_mtime, status_dict_global
    
    while True:
        try:
            if os.path.exists(FILE_PATH):
                current_mtime = os.path.getmtime(FILE_PATH)
                if current_mtime != last_mtime:
                    print("File change detected. Reloading data into RAM...")
                    new_df, new_plazas, new_status = load_excel_data()
                    
                    if new_df is not None:
                        df_global = new_df
                        plazas_dict_global = new_plazas
                        status_dict_global = new_status
                        last_mtime = current_mtime
                        print("Data reloaded successfully.")
        except Exception as e:
            print(f"Error in file watcher: {e}")
            

        await asyncio.sleep(300)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global df_global, plazas_dict_global, last_mtime, status_dict_global
    
    if os.path.exists(FILE_PATH):
        last_mtime = os.path.getmtime(FILE_PATH)
        df_global, plazas_dict_global, status_dict_global = load_excel_data()
        print("Initial data loaded.")
    else:
        print("Warning: Excel file not found at startup.")
    
    watcher_task = asyncio.create_task(file_watcher())
    
    yield # The FastAPI application runs and serves requests here
    
    # Cleanup task when shutting down the server
    watcher_task.cancel()

app = FastAPI(title="SOL API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:80", "http://localhost", "http://127.0.0.1","http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/sol/vehiculo/{economico}")
async def get_vehiculo(economico: str):
    if df_global is None:
        raise HTTPException(status_code=500, detail="Database not loaded into server memory.")

    if economico not in df_global.index:
        raise HTTPException(status_code=404, detail=f"Vehicle {economico} not found.")

    data = df_global.loc[economico].replace({np.nan: None}).to_dict()
    return data

@app.get("/sol/plazas")
async def get_plazas():
    if not plazas_dict_global:
        raise HTTPException(status_code=500, detail="Plazas dictionary is empty or not loaded.")
    
    return plazas_dict_global

@app.get("/sol/estatus")
async def get_status():
    if not status_dict_global:
        raise HTTPException(status_code=500, detail="Status dictionary is empty or not loaded.")
    return status_dict_global