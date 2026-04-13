import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatTitle, formatSpecValue, getDocStatus } from '../utils/helpers.jsx';
import { FLEET_API, SOL_API } from '../config/api.js';

export default function ExpandedVehicleRow({ vehicle, activeTab, onTabChange, onClose }) {
    const [viewingDoc, setViewingDoc] = useState(null);
    const [viewerScale, setViewerScale] = useState(1);
    const [viewerRotation, setViewerRotation] = useState(0);

    const { data: docs = [], isLoading: isLoadingDocs } = useQuery({
        queryKey: ['documents', vehicle?.id],
        queryFn: async () => {
            if (!vehicle?.id) return [];
            const response = await fetch(`${FLEET_API}/vehicles/${vehicle.id}/documents`);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.documents) ? data.documents : [];
        },
        enabled: activeTab === 'docs' && !!vehicle?.id,
    });

    const { data: specs = null, isLoading: isLoadingSpecs } = useQuery({
        queryKey: ['specs', vehicle?.id],
        queryFn: async () => {
            if (!vehicle?.id) return null;
            const response = await fetch(`${SOL_API}/sol/vehiculo/${vehicle.id}`);
            if (!response.ok) return null;
            return response.json();
        },
        enabled: activeTab === 'spec' && !!vehicle?.id,
    });

    const renderValue = useCallback((value) => {
        if (value === null || value === undefined || String(value).trim().toLowerCase() === 'null') return 'N/A';
        if (value === true || String(value).trim().toLowerCase() === 'true') return 'Sí';
        if (value === false || String(value).trim().toLowerCase() === 'false') return 'No';

        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                return value.map((v, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && ', '}
                        {renderValue(v)}
                    </React.Fragment>
                ));
            }
            return (
                <div className="flex flex-col gap-1.5 mt-1 bg-slate-50/70 rounded-md p-3 border border-slate-100 w-full min-w-0">
                    {Object.entries(value).map(([k, v]) => (
                        <div key={k} className="flex flex-row flex-wrap items-baseline gap-x-1.5 text-xs leading-relaxed w-full min-w-0">
                            <span className="font-extrabold text-slate-800 shrink-0 max-w-full break-words">{formatTitle(k)}:</span>
                            <span className="flex-1 text-slate-600 font-medium break-words overflow-wrap-anywhere min-w-0">{renderValue(v)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return String(value);
    }, []);



    const heroKeys = ['Placas', 'Serie', 'UN', 'Marca', 'Sub marca', 'Modelo', 'Tipo vehiculo', 'Empleado', 'Nomina', 'Estatus'];

    const renderDocsTab = () => {
        if (isLoadingDocs) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 pt-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex flex-col bg-white p-5 rounded-2xl border border-slate-200 animate-pulse">
                            <div className="flex justify-between items-start pb-4 border-b border-dashed border-slate-200 mb-4">
                                <div className="flex flex-col gap-2 w-full pr-3">
                                    <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                                </div>
                                <div className="h-6 w-12 bg-slate-200 rounded-md flex-shrink-0"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-5 mb-5 flex-1">
                                {[...Array(4)].map((_, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5">
                                        <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-200 rounded w-full"></div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto pt-4 border-t border-slate-100 ">
                                <div className="h-8 bg-slate-100 rounded-xl w-full"></div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        const missingDocs = vehicle?.missingDocs || [];

        const getMissingDocName = (str) => {
            if (!str) return str;
            const match = str.match(/^([^(:\[]+)/);
            return match ? match[1].trim() : str;
        };

        const realDocTypes = new Set(docs.map(d => d?.doc_type));
        const missingToShow = missingDocs
            .map(getMissingDocName)
            .filter(name => name && !realDocTypes.has(name));

        if (docs && docs.length > 0 || missingToShow.length > 0) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 pt-4 animate-in fade-in duration-500">
                    {docs.map((doc) => {
                        if (!doc) return null;
                        const docStatus = getDocStatus(doc);

                        let cardStyle = "border-slate-200 hover:border-blue-300 hover:shadow-md bg-white ";
                        let badge = <span className="bg-emerald-100/80 text-emerald-800 px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest border border-emerald-200/50 backdrop-blur-sm shadow-sm">OK</span>;

                        if (docStatus === 'critical') {
                            cardStyle = "border-rose-300 shadow-[0_4px_12px_-4px_rgba(225,29,72,0.2)] hover:border-rose-400 bg-white ";
                            badge = <span className="bg-rose-500 text-white px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest shadow-md">CRÍTICO</span>;
                        } else if (docStatus === 'warning') {
                            cardStyle = "border-amber-300 shadow-[0_4px_12px_-4px_rgba(217,119,6,0.2)] hover:border-amber-400 bg-white ";
                            badge = <span className="bg-amber-500 text-white px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest shadow-md">ALERTA</span>;
                        }

                        return (
                            <div key={doc.id || Math.random()} className={`flex flex-col p-5 rounded-2xl border transition-all duration-300 transform hover:-translate-y-1 ${cardStyle}`}>
                                <div className="flex justify-between items-start pb-4 border-b border-dashed border-slate-200 mb-4">
                                    <div className="flex flex-col gap-2.5 pr-3 min-w-0">
                                        <span className="font-extrabold text-slate-800 text-lg leading-tight truncate" title={formatTitle(doc.doc_type)}>{formatTitle(doc.doc_type)}</span>
                                        {/*<span className="text-[11px] text-slate-400 font-mono font-medium opacity-80 mb-1.5">ID: {doc.id || 'N/A'}</span>*/}
                                        {doc.file_url && (
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        setViewerScale(1);
                                                        setViewerRotation(0);
                                                        setViewingDoc(doc);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:border-blue-300 px-2.5 py-1 rounded-md hover:bg-blue-100 transition-colors shadow-sm active:scale-95"
                                                    title="Visualizar documento en pantalla dividida"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                    <span>VER ARCHIVO</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await fetch(doc.file_url);
                                                            const blob = await res.blob();
                                                            const url = URL.createObjectURL(blob);
                                                            const ext = doc.file_url.split('?')[0].split('.').pop();
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `${doc.doc_type}.${ext}`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                            URL.revokeObjectURL(url);
                                                        } catch (err) {
                                                            console.error('Error descargando archivo:', err);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors shadow-sm active:scale-95"
                                                    title="Descargar archivo"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    <span>DESCARGAR</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 mt-0.5">
                                        {badge}
                                    </div>
                                </div>

                                <div className="flex flex-col flex-1 justify-between mb-5">
                                    <div className="flex flex-col gap-y-2 mb-4 mt-2">
                                        {Object.entries(doc.data || {}).filter(([_, val]) => typeof val !== 'object' || val === null).map(([key, value]) => (
                                            <div key={key} className="flex flex-row justify-between items-baseline gap-x-3 w-full border-b border-slate-100/60 pb-2 last:border-0 last:pb-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate shrink-0 max-w-[45%]" title={formatTitle(key)}>{formatTitle(key)}</span>
                                                <div className="text-right text-[13px] font-bold text-slate-700 break-words leading-tight grow">
                                                    {renderValue(value)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {Object.entries(doc.data || {}).filter(([_, val]) => typeof val === 'object' && val !== null).length > 0 && (
                                        <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-100/80">
                                            {Object.entries(doc.data || {}).filter(([_, val]) => typeof val === 'object' && val !== null).map(([key, value]) => (
                                                <div key={key} className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1" title={formatTitle(key)}>{formatTitle(key)}</span>
                                                    <div className="w-full min-w-0">
                                                        {renderValue(value)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>


                            </div>
                        );
                    })}

                    {/* GHOST CARDS — missing documents */}
                    {missingToShow.map((docName, idx) => (
                        <div
                            key={`missing-${idx}`}
                            className="flex flex-col p-5 rounded-2xl border border-dashed border-rose-200 bg-rose-50/30 transition-all duration-300"
                        >
                            <div className="flex justify-between items-start pb-4 border-b border-dashed border-rose-100 mb-4">
                                <div className="flex flex-col gap-1 pr-3 overflow-hidden">
                                    <span className="font-extrabold text-slate-500 text-lg leading-tight truncate" title={formatTitle(docName)}>
                                        {formatTitle(docName)}
                                    </span>
                                </div>
                                <div className="flex-shrink-0 mt-0.5">
                                    <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest border border-rose-200/70">
                                        FALTANTE
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3 opacity-40">
                                <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Sin documento</span>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed mt-4 opacity-70">
                <span className="text-3xl mb-3">📄</span>
                <span className="text-sm font-medium text-slate-500 ">No se encontraron documentos OCR en la base de datos</span>
            </div>
        );
    };

    const renderSpecsTab = () => {
        if (isLoadingSpecs) {
            return (
                <div className="pt-4 flex flex-col gap-6 animate-pulse">
                    <div className="h-[240px] w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
                        <div className="flex justify-between items-start pb-6 border-b border-slate-100 ">
                            <div className="flex gap-10">
                                <div><div className="h-3 bg-slate-200 rounded w-16 mb-2"></div><div className="h-8 bg-slate-200 rounded w-32"></div></div>
                                <div><div className="h-3 bg-slate-200 rounded w-20 mb-2"></div><div className="h-6 bg-slate-200 rounded w-40 mt-1"></div></div>
                            </div>
                            <div><div className="h-3 bg-slate-200 rounded w-16 mb-2"></div><div className="h-6 bg-slate-200 rounded w-24"></div></div>
                        </div>
                        <div className="flex gap-12 mt-6">
                            {[...Array(5)].map((_, i) => (
                                <div key={i}>
                                    <div className="h-3 bg-slate-200 rounded w-20 mb-2"></div>
                                    <div className="h-5 bg-slate-200 rounded w-28"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="h-[200px] w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
                        <div className="h-4 bg-slate-200 rounded w-32 mb-8"></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8">
                            {[...Array(12)].map((_, i) => (
                                <div key={i}>
                                    <div className="h-2 bg-slate-200 rounded w-16 mb-2"></div>
                                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (specs && typeof specs === 'object') {
            return (
                <div className="pt-4 animate-in fade-in duration-500">
                    {/* Main Hero Card */}
                    <div className="flex flex-col gap-6 bg-white p-7 rounded-2xl border border-slate-200 shadow-sm mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mx-10 -my-20 opacity-60 pointer-events-none"></div>

                        <div className="flex justify-between items-start pb-6 border-b border-slate-100 relative z-10">
                            <div className="flex gap-10 items-center">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placas</div>
                                    <div className="text-3xl font-black text-slate-800 tracking-tight">{formatSpecValue(specs.Placas)}</div>
                                </div>
                                <div className="w-px h-12 bg-slate-200 "></div>
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serie (VIN)</div>
                                    <div className="text-xl font-bold text-slate-600 font-mono tracking-wide mt-1">{formatSpecValue(specs.Serie)}</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estatus SOL</div>
                                <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-xs font-bold border border-indigo-100/50 shadow-sm">
                                    {formatSpecValue(specs.Estatus)}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-x-12 gap-y-6 relative z-10">
                            <div className="flex flex-col"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Unidad de Negocio</div><div className="text-[15px] font-bold text-slate-700 ">{formatSpecValue(specs.UN)}</div></div>
                            <div className="flex flex-col"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Marca Automotriz</div><div className="text-[15px] font-bold text-slate-700 ">{formatSpecValue(specs.Marca)}</div></div>
                            <div className="flex flex-col"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Modelo</div><div className="text-[15px] font-bold text-slate-700 ">{formatSpecValue(specs.Modelo)}</div></div>
                            <div className="flex flex-col"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tipo Vehículo</div><div className="text-[15px] font-bold text-slate-700 ">{formatSpecValue(specs['Tipo vehiculo'])}</div></div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Empleado Asignado</div>
                                <div className="text-[15px] font-bold text-slate-700 flex items-center gap-3">
                                    {formatSpecValue(specs.Empleado)}
                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 ">Nomina: {formatSpecValue(specs.Nomina)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Spec Grid */}
                    <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Datos Extendidos
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8">
                            {Object.entries(specs).map(([k, v]) => (
                                !heroKeys.includes(k) && (
                                    <div key={k} className="flex flex-col group">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 transition-colors group-hover:text-blue-500 ">{k}</span>
                                        <span className="text-sm font-medium text-slate-700 break-words">{formatSpecValue(v)}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed mt-4 opacity-70">
                <span className="text-3xl mb-3">🛠️</span>
                <span className="text-sm font-medium text-slate-500 ">No se encontró ficha técnica para esta unidad.</span>
            </div>
        );
    };

    return (
        <div className="w-full relative">
            <div className="flex justify-between items-end border-b-2 border-slate-200/50 mb-4">
                <div className="flex gap-8">
                    <button
                        className={`pb-3 text-xs font-black tracking-widest relative transition-colors ${activeTab === 'docs' ? 'text-blue-600 ' : 'text-slate-400 hover:text-slate-600 '}`}
                        onClick={() => onTabChange('docs')}
                    >
                        DOCUMENTOS (OCR)
                        {activeTab === 'docs' && <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-blue-600 rounded-t-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>}
                    </button>
                    <button
                        className={`pb-3 text-xs font-black tracking-widest relative transition-colors ${activeTab === 'spec' ? 'text-blue-600 ' : 'text-slate-400 hover:text-slate-600 '}`}
                        onClick={() => onTabChange('spec')}
                    >
                        FICHA TÉCNICA (SOL)
                        {activeTab === 'spec' && <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-blue-600 rounded-t-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>}
                    </button>
                </div>

                <button
                    className="mb-2 text-[10px] font-black tracking-widest text-slate-400 hover:text-rose-600 bg-white border border-slate-200/80 px-3 py-1.5 rounded-md shadow-sm hover:shadow hover:border-rose-200 transition-all active:scale-95 flex items-center gap-1.5"
                    onClick={onClose}
                >
                    CERRAR PANEL
                </button>
            </div>

            {activeTab === 'docs' ? renderDocsTab() : renderSpecsTab()}

            {/* DOCUMENT VIEWER MODAL */}
            {viewingDoc && (
                <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col md:flex-row p-4 md:p-6 gap-6 animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-4 duration-300 ease-out">
                    <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden relative flex flex-col">
                        <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0 z-20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                                <h4 className="text-slate-200 font-bold tracking-wide text-sm truncate max-w-[200px] md:max-w-xs">{formatTitle(viewingDoc.doc_type)}</h4>
                            </div>
                            <div className="flex items-center gap-4">
                                <a href={viewingDoc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700">
                                    <span>ABRIR EXTERNO</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                                <button onClick={() => setViewingDoc(null)} className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center group bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxNic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzE2JyBmaWxsPScjMWUxZTI0Jy8+PHJlY3QgeD0nMCcgeT0nMCcgd2lkdGg9JzgnIGhlaWdodD0nOCcgZmlsbD0nIzIzMjQyYicvPjxyZWN0IHg9JzgnIHk9JzgnIHdpZHRoPSc4JyBoZWlnaHQ9JzgnIGZpbGw9JyMyMzI0MmInLz48L3N2Zz4=')]">

                            {/* IMAGE CONTROLS */}
                            {viewingDoc.file_url?.match(/\.(jpeg|jpg|gif|png|webp)(\?|$)/i) && (
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
                                    <div className="w-px h-6 bg-slate-700 mx-1"></div>
                                    <button onClick={() => { setViewerScale(1); setViewerRotation(0); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all active:scale-95" title="Restaurar zoom">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            )}

                            <div className="w-full h-full absolute inset-0 overflow-auto custom-scrollbar flex items-center justify-center p-4">
                                {viewingDoc.file_url?.match(/\.(jpeg|jpg|gif|png|webp)(\?|$)/i) ? (
                                    <img
                                        src={viewingDoc.file_url}
                                        alt={viewingDoc.doc_type}
                                        style={{
                                            transform: `scale(${viewerScale}) rotate(${viewerRotation}deg)`,
                                            transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                        }}
                                        className="max-w-full max-h-full object-contain origin-center ring-1 ring-white/10 shadow-2xl rounded"
                                    />
                                ) : (
                                    <iframe
                                        src={viewingDoc.file_url}
                                        className="w-full h-full border-0 absolute inset-0 bg-white"
                                        title="Visor PDF"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-[450px] lg:w-[500px] shrink-0 bg-slate-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200/60">
                        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-white z-10 shadow-sm">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight truncate pr-4" title={formatTitle(viewingDoc.doc_type)}>
                                {formatTitle(viewingDoc.doc_type)}
                            </h3>
                            <button
                                onClick={() => setViewingDoc(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors shrink-0"
                                title="Cerrar visor"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <h4 className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Datos de validación (OCR)
                            </h4>

                            <div className="flex flex-col gap-y-3 mb-6 bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
                                {Object.entries(viewingDoc.data || {}).filter(([_, val]) => typeof val !== 'object' || val === null).map(([key, value]) => (
                                    <div key={key} className="flex flex-col w-full border-b border-slate-100/60 pb-2.5 last:border-0 last:pb-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1" title={formatTitle(key)}>{formatTitle(key)}</span>
                                        <div className="text-[13px] font-bold text-slate-700 break-words leading-snug w-full">
                                            {renderValue(value)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {Object.entries(viewingDoc.data || {}).filter(([_, val]) => typeof val === 'object' && val !== null).map(([key, value]) => (
                                <div key={key} className="flex flex-col w-full mb-6 bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2 flex items-center gap-2" title={formatTitle(key)}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> {formatTitle(key)}
                                    </span>
                                    <div className="w-full">
                                        {renderValue(value)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 border-t border-slate-200 bg-white">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold">
                                <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                La vista paralela permite confirmar visualmente la precisión de los datos extraídos por la IA.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
