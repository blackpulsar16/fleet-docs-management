import React, { useState, useEffect } from 'react';
import { formatTitle } from '../utils/helpers.jsx';
import { FLEET_API } from '../config/api.js';
import { useApiClient } from '../hooks/useApiClient.js';
import { useRole } from '../hooks/useRole.js';

export default function DocumentReviewModal({ docs = [], initialIndex = 0, onClose, onSuccess }) {
    const { isEditor } = useRole();
    const { fetchWithAuth } = useApiClient();

    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [viewerScale, setViewerScale] = useState(1);
    const [viewerRotation, setViewerRotation] = useState(0);
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // Current document from the queue
    const doc = docs[currentIndex];

    // Initialize form data when doc changes
    useEffect(() => {
        if (doc?.data) {
            setFormData(JSON.parse(JSON.stringify(doc.data)));
            // Reset viewer settings for each new doc
            setViewerScale(1);
            setViewerRotation(0);
        }
    }, [doc]);

    if (!doc) return null;

    const confidenceScore = doc.data?.confidence_score;
    const extractionNotes = doc.data?.extraction_notes;

    const getConfidenceColor = (score) => {
        if (score === undefined || score === null) return 'bg-slate-100 text-slate-600 border-slate-200';
        if (score >= 90) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (score >= 70) return 'bg-amber-100 text-amber-800 border-amber-200';
        return 'bg-rose-100 text-rose-800 border-rose-200';
    };

    const handleInputChange = (path, value) => {
        setFormData(prev => {
            const next = { ...prev };
            if (path.includes('.')) {
                const [parent, child] = path.split('.');
                next[parent] = { ...next[parent], [child]: value };
            } else {
                next[path] = value;
            }
            return next;
        });
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const res = await fetchWithAuth(`${FLEET_API}/documents/${doc.id}/verify`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extracted_data: formData })
            });

            if (!res.ok) throw new Error('Error al verificar el documento');
            
            // Advance or close
            if (currentIndex < docs.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (error) {
            console.error(error);
            alert('Error al guardar la verificación');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < docs.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const renderInput = (key, value, path) => {
        if (key === 'confidence_score' || key === 'extraction_notes') return null;

        return (
            <div key={path} className="flex flex-col w-full border-b border-slate-100/60 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5" title={formatTitle(key)}>
                    {formatTitle(key)}
                </label>
                <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    className={`w-full text-[13px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 transition-all ${isEditor ? 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white' : 'opacity-80 cursor-not-allowed'}`}
                    value={formData[path.split('.')[0]]?.[path.split('.')[1]] ?? formData[path] ?? ''}
                    onChange={(e) => handleInputChange(path, e.target.value)}
                    disabled={!isEditor}
                />
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col md:flex-row p-4 md:p-6 gap-6 animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-4 duration-300 ease-out">
            <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden relative flex flex-col">
                <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                        <div className="flex flex-col">
                            <h4 className="text-slate-200 font-bold tracking-wide text-sm truncate max-w-[200px] md:max-w-xs">{formatTitle(doc.doc_type)}</h4>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Vehículo: {doc.vehicle_id}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700">
                            <span>ABRIR EXTERNO</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                        <button onClick={onClose} className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center group bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxNic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzE2JyBmaWxsPScjMWUxZTI0Jy8+PHJlY3QgeD0nMCcgeT0nMCcgd2lkdGg9JzgnIGhlaWdodD0nOCcgZmlsbD0nIzIzMjQyYicvPjxyZWN0IHg9JzgnIHk9JzgnIHdpZHRoPSc4JyBoZWlnaHQ9JzgnIGZpbGw9JyMyMzI0MmInLz48L3N2Zz4=')]">

                    {/* IMAGE CONTROLS */}
                    {doc.file_url?.match(/\.(jpeg|jpg|gif|png|webp)(\?|$)/i) && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-4 group-hover:translate-y-0">
                            <button onClick={() => setViewerScale(s => Math.max(0.5, s - 0.25))} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all active:scale-95" title="Alejar">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                            </button>
                            <span className="text-[11px] font-mono font-bold text-slate-300 w-12 text-center select-none">{Math.round(viewerScale * 100)}%</span>
                            <button onClick={() => setViewerScale(s => Math.min(4, s + 0.25))} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all active:scale-95" title="Acercar">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                            </button>
                            <div className="w-px h-6 bg-slate-700 mx-1"></div>
                            <button onClick={() => setViewerRotation(r => r - 90)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all active:scale-95" title="Rotar izquierda">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            </button>
                            <button onClick={() => setViewerRotation(r => r + 90)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all active:scale-95" title="Rotar derecha">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                            </button>
                        </div>
                    )}

                    <div className="w-full h-full absolute inset-0 overflow-auto custom-scrollbar flex items-center justify-center p-4">
                        {doc.file_url?.match(/\.(jpeg|jpg|gif|png|webp)(\?|$)/i) ? (
                            <img
                                src={doc.file_url}
                                alt={doc.doc_type}
                                style={{
                                    transform: `scale(${viewerScale}) rotate(${viewerRotation}deg)`,
                                    transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                }}
                                className="max-w-full max-h-full object-contain origin-center ring-1 ring-white/10 shadow-2xl rounded"
                            />
                        ) : (
                            <iframe
                                src={doc.file_url}
                                className="w-full h-full border-0 absolute inset-0 bg-white"
                                title="Visor PDF"
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full md:w-[450px] lg:w-[500px] shrink-0 bg-slate-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200/60">
                <div className="px-6 py-5 border-b border-slate-200 flex flex-col bg-white z-10 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-black text-slate-800 tracking-tight truncate pr-4" title={formatTitle(doc.doc_type)}>
                            {doc.status === 'verified' ? '✅' : '👀'} Revisión
                        </h3>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-600 transition-all duration-500" 
                                style={{ width: `${((currentIndex + 1) / docs.length) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            Documento {currentIndex + 1} de {docs.length}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    
                    {/* Confidence Score Badge */}
                    {confidenceScore !== undefined && (
                        <div className={`mb-4 flex items-center justify-between p-3 rounded-lg border ${getConfidenceColor(confidenceScore)}`}>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Precisión de IA</span>
                                <span className="text-sm font-bold">Confianza de Extracción</span>
                            </div>
                            <span className="text-xl font-black">{confidenceScore}%</span>
                        </div>
                    )}

                    {/* Extraction Notes Alert */}
                    {extractionNotes && (
                        <div className="mb-6 flex items-start gap-4 p-4 rounded-xl bg-amber-100 border-2 border-amber-300 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                            <span className="text-2xl mt-0.5">💡</span>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">Comentario de la IA</span>
                                <span className="text-[13px] font-bold leading-relaxed">{extractionNotes}</span>
                            </div>
                        </div>
                    )}

                    <h4 className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> {isEditor ? 'Datos extraídos (Editar si es necesario)' : 'Datos extraídos (Solo Lectura)'}
                    </h4>

                    <div className="flex flex-col gap-y-1 mb-6 bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
                        {Object.entries(doc.data || {}).filter(([_, val]) => typeof val !== 'object' || val === null).map(([key, value]) => (
                            renderInput(key, value, key)
                        ))}
                    </div>

                    {Object.entries(doc.data || {}).filter(([_, val]) => typeof val === 'object' && val !== null).map(([key, value]) => (
                        <div key={key} className="flex flex-col w-full mb-6 bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2 flex items-center gap-2" title={formatTitle(key)}>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> {formatTitle(key)}
                            </span>
                            <div className="w-full flex flex-col gap-y-1">
                                {Object.entries(value).map(([childKey, childValue]) => (
                                    renderInput(childKey, childValue, `${key}.${childKey}`)
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-center">
                    <div className="flex gap-2">
                        {currentIndex > 0 && (
                            <button 
                                onClick={handlePrev}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                Anterior
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={handleNext}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            Omitir
                        </button>
                        {isEditor && (
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : (currentIndex < docs.length - 1 ? 'Guardar y Siguiente' : 'Confirmar y Finalizar')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
