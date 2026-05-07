import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatTitle, formatSpecValue, getDocStatus } from '../utils/helpers.jsx';
import { FLEET_API, SOL_API } from '../config/api.js';
import { useApiClient } from '../hooks/useApiClient.js';
import { useRole } from '../hooks/useRole.js';
import DocumentReviewModal from './DocumentReviewModal.jsx';

export default function ExpandedVehicleRow({ vehicle, activeTab, onTabChange, onClose, autoOpenReviewTrigger = 0 }) {
    const [viewingDoc, setViewingDoc] = useState(null);
    const [viewerScale, setViewerScale] = useState(1);
    const [viewerRotation, setViewerRotation] = useState(0);
    const [hasAttemptedAutoOpen, setHasAttemptedAutoOpen] = useState(0);
    const { fetchWithAuth } = useApiClient();
    const { isEditor } = useRole();

    const { data: docs = [], isLoading: isLoadingDocs, refetch: refetchDocs } = useQuery({
        queryKey: ['documents', vehicle?.id],
        queryFn: async () => {
            if (!vehicle?.id) return [];
            const response = await fetchWithAuth(`${FLEET_API}/vehicles/${vehicle.id}/documents`);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.documents) ? data.documents : [];
        },
        enabled: (activeTab === 'docs' || activeTab === 'validation') && !!vehicle?.id,
    });

    React.useEffect(() => {
        if (autoOpenReviewTrigger > hasAttemptedAutoOpen && !isLoadingDocs && docs.length > 0) {
            setHasAttemptedAutoOpen(autoOpenReviewTrigger);
            
            // Priority: pending_review -> critical -> warning -> first doc
            const docToReview = docs.find(d => d.status === 'pending_review')
                || docs.find(d => getDocStatus(d) === 'critical')
                || docs.find(d => getDocStatus(d) === 'warning')
                || docs[0];
                
            if (docToReview) {
                setViewingDoc(docToReview);
            }
        }
    }, [autoOpenReviewTrigger, hasAttemptedAutoOpen, isLoadingDocs, docs]);

    const { data: specs = null, isLoading: isLoadingSpecs } = useQuery({
        queryKey: ['specs', vehicle?.id],
        queryFn: async () => {
            if (!vehicle?.id) return null;
            const response = await fetchWithAuth(`${SOL_API}/sol/vehiculo/${vehicle.id}`);
            if (!response.ok) return null;
            return response.json();
        },
        enabled: (activeTab === 'spec' || activeTab === 'validation') && !!vehicle?.id,
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
                <div className="flex flex-col gap-1.5 mt-1 bg-gray-50/70 rounded-md p-3 border border-gray-100 w-full min-w-0">
                    {Object.entries(value).map(([k, v]) => (
                        <div key={k} className="flex flex-row flex-wrap items-baseline gap-x-1.5 text-xs leading-relaxed w-full min-w-0">
                            <span className="font-medium text-gray-800 shrink-0 max-w-full break-words">{formatTitle(k)}:</span>
                            <span className="flex-1 text-gray-600 font-medium break-words overflow-wrap-anywhere min-w-0">{renderValue(v)}</span>
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
                        <div key={i} className="flex flex-col bg-white p-5 rounded-md border border-gray-200 animate-pulse">
                            <div className="flex justify-between items-start pb-4 border-b border-dashed border-gray-200 mb-4">
                                <div className="flex flex-col gap-2 w-full pr-3">
                                    <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                                </div>
                                <div className="h-6 w-12 bg-gray-200 rounded-md flex-shrink-0"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-5 mb-5 flex-1">
                                {[...Array(4)].map((_, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5">
                                        <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto pt-4 border-t border-gray-100 ">
                                <div className="h-8 bg-gray-100 rounded-md w-full"></div>
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

                        let cardStyle = "border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white ";
                        let badge = <span className="text-emerald-700 px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border border-emerald-200 bg-emerald-50">OK</span>;
                        
                        if (doc.status === 'pending_review') {
                            cardStyle = "border-amber-300 shadow-[0_4px_12px_-4px_rgba(217,119,6,0.2)] hover:border-amber-400 bg-amber-50/30 ";
                            badge = <span className="text-amber-700 px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border border-amber-300 bg-amber-50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>PENDIENTE</span>;
                        } else if (docStatus === 'critical') {
                            cardStyle = "border-rose-300 shadow-[0_4px_12px_-4px_rgba(225,29,72,0.2)] hover:border-rose-400 bg-white ";
                            badge = <span className="text-rose-700 px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border border-rose-300 bg-rose-50">CRÍTICO</span>;
                        } else if (docStatus === 'warning') {
                            cardStyle = "border-amber-300 shadow-[0_4px_12px_-4px_rgba(217,119,6,0.2)] hover:border-amber-400 bg-white ";
                            badge = <span className="text-amber-700 px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border border-amber-300 bg-amber-50">ALERTA</span>;
                        }

                        return (
                            <div key={doc.id || Math.random()} className={`flex flex-col p-4 rounded-md border transition-all duration-200 ${cardStyle}`}>
                                <div className="flex justify-between items-start pb-4 border-b border-dashed border-gray-200 mb-4">
                                    <div className="flex flex-col gap-2.5 pr-3 min-w-0">
                                        <span className="font-medium text-gray-800 text-base leading-tight truncate" title={formatTitle(doc.doc_type)}>{formatTitle(doc.doc_type)}</span>
                                        {/*<span className="text-[11px] text-gray-400 font-mono font-medium opacity-80 mb-1.5">ID: {doc.id || 'N/A'}</span>*/}
                                        {doc.file_url && (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <button
                                                    onClick={() => {
                                                        setViewerScale(1);
                                                        setViewerRotation(0);
                                                        setViewingDoc(doc);
                                                    }}
                                                    className="inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-100 hover:border-blue-300 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors shadow-sm active:scale-95"
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
                                                    className="inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-medium text-gray-500 bg-gray-50 border border-gray-200 hover:border-gray-300 px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors shadow-sm active:scale-95"
                                                    title="Descargar archivo"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    <span>DESCARGAR</span>
                                                </button>
                                                {isEditor && (
                                                    <button
                                                        onClick={() => {
                                                            setViewerScale(1);
                                                            setViewerRotation(0);
                                                            setViewingDoc(doc);
                                                        }}
                                                        className="inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-100 hover:border-amber-300 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-colors shadow-sm active:scale-95"
                                                        title="Editar datos manualmente sin IA"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                        <span>EDITAR DATOS</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 mt-0.5">
                                        {badge}
                                    </div>
                                </div>

                                <div className="flex flex-col flex-1 justify-between mb-5">
                                    <div className="flex flex-col gap-y-3 mb-4 mt-2">
                                        {Object.entries(doc.data || {}).filter(([_, val]) => typeof val !== 'object' || val === null).map(([key, value]) => (
                                            <div key={key} className="flex flex-col w-full border-b border-gray-100/60 pb-2.5 last:border-0 last:pb-0">
                                                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-0.5" title={formatTitle(key)}>{formatTitle(key)}</span>
                                                <div className="text-[13px] font-medium text-gray-700 break-words leading-snug">
                                                    {renderValue(value)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {Object.entries(doc.data || {}).filter(([_, val]) => typeof val === 'object' && val !== null).length > 0 && (
                                        <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-100/80">
                                            {Object.entries(doc.data || {}).filter(([_, val]) => typeof val === 'object' && val !== null).map(([key, value]) => (
                                                <div key={key} className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1" title={formatTitle(key)}>{formatTitle(key)}</span>
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
                            className="flex flex-col p-4 rounded-md border border-dashed border-rose-200 bg-rose-50/30 transition-all duration-200"
                        >
                            <div className="flex justify-between items-start pb-4 border-b border-dashed border-rose-100 mb-4">
                                <div className="flex flex-col gap-1 pr-3 overflow-hidden">
                                    <span className="font-medium text-gray-500 text-lg leading-tight truncate" title={formatTitle(docName)}>
                                        {formatTitle(docName)}
                                    </span>
                                </div>
                                <div className="flex-shrink-0 mt-0.5">
                                    <span className="text-rose-700 px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border border-rose-200 bg-rose-50">
                                        FALTANTE
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3 opacity-40">
                                <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-xs font-medium text-rose-400 uppercase tracking-widest">Sin documento</span>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-md border border-gray-200 border-dashed mt-4 opacity-70">
                <span className="text-3xl mb-3">📄</span>
                <span className="text-sm font-medium text-gray-500">No se encontraron documentos OCR en la base de datos</span>
            </div>
        );
    };

    const renderSpecsTab = () => {
        if (isLoadingSpecs) {
            return (
                <div className="pt-4 flex flex-col gap-6 animate-pulse">
                    <div className="h-[240px] w-full bg-white rounded-md border border-gray-200 shadow-sm p-7">
                        <div className="flex justify-between items-start pb-6 border-b border-gray-100 ">
                            <div className="flex gap-10">
                                <div><div className="h-3 bg-gray-200 rounded w-16 mb-2"></div><div className="h-8 bg-gray-200 rounded w-32"></div></div>
                                <div><div className="h-3 bg-gray-200 rounded w-20 mb-2"></div><div className="h-6 bg-gray-200 rounded w-40 mt-1"></div></div>
                            </div>
                            <div><div className="h-3 bg-gray-200 rounded w-16 mb-2"></div><div className="h-6 bg-gray-200 rounded w-24"></div></div>
                        </div>
                        <div className="flex gap-12 mt-6">
                            {[...Array(5)].map((_, i) => (
                                <div key={i}>
                                    <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                                    <div className="h-5 bg-gray-200 rounded w-28"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="h-[200px] w-full bg-white rounded-md border border-gray-200 shadow-sm p-7">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-8"></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8">
                            {[...Array(12)].map((_, i) => (
                                <div key={i}>
                                    <div className="h-2 bg-gray-200 rounded w-16 mb-2"></div>
                                    <div className="h-4 bg-gray-200 rounded w-full"></div>
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
                    <div className="flex flex-col gap-6 bg-white p-6 rounded-md border border-gray-200 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 rounded-full blur-3xl -mx-10 -my-20 opacity-60 pointer-events-none"></div>

                        <div className="flex justify-between items-start pb-6 border-b border-gray-100 relative z-10">
                            <div className="flex gap-10 items-center">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Placas</div>
                                    <div className="text-2xl font-medium text-gray-800 tracking-tight">{formatSpecValue(specs.Placas)}</div>
                                </div>
                                <div className="w-px h-12 bg-gray-200 "></div>
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Serie (VIN)</div>
                                    <div className="text-xl font-medium text-gray-600 font-mono tracking-wide mt-1">{formatSpecValue(specs.Serie)}</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Estatus SOL</div>
                                <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-md text-xs font-medium border border-indigo-100/50 shadow-sm">
                                    {formatSpecValue(specs.Estatus)}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-x-12 gap-y-6 relative z-10">
                            <div className="flex flex-col"><div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">Unidad de Negocio</div><div className="text-[15px] font-medium text-gray-700 ">{formatSpecValue(specs.UN)}</div></div>
                            <div className="flex flex-col"><div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">Marca Automotriz</div><div className="text-[15px] font-medium text-gray-700 ">{formatSpecValue(specs.Marca)}</div></div>
                            <div className="flex flex-col"><div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">Modelo</div><div className="text-[15px] font-medium text-gray-700 ">{formatSpecValue(specs.Modelo)}</div></div>
                            <div className="flex flex-col"><div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">Tipo Vehículo</div><div className="text-[15px] font-medium text-gray-700 ">{formatSpecValue(specs['Tipo vehiculo'])}</div></div>
                            <div className="flex flex-col">
                                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">Empleado Asignado</div>
                                <div className="text-[15px] font-medium text-gray-700 flex items-center gap-3">
                                    {formatSpecValue(specs.Empleado)}
                                    <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[11px] font-medium border border-gray-200 ">Nomina: {formatSpecValue(specs.Nomina)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Spec Grid */}
                    <div className="bg-white p-6 rounded-md border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-800 mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Datos Extendidos
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8">
                            {Object.entries(specs).map(([k, v]) => (
                                !heroKeys.includes(k) && (
                                    <div key={k} className="flex flex-col group">
                                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5 transition-colors group-hover:text-blue-500 ">{k}</span>
                                        <span className="text-sm font-medium text-gray-700 break-words">{formatSpecValue(v)}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-md border border-gray-200 border-dashed mt-4 opacity-70">
                <span className="text-3xl mb-3">🛠️</span>
                <span className="text-sm font-medium text-gray-500">No se encontró ficha técnica para esta unidad.</span>
            </div>
        );
    };

    // ── VALIDATION TAB ──────────────────────────────────────────────────────
    const renderValidationTab = () => {
        const isLoading = isLoadingDocs || isLoadingSpecs;

        if (isLoading) {
            return (
                <div className="pt-4 flex flex-col gap-4 animate-pulse">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-28 bg-gray-100 rounded-md border border-gray-200" />
                    ))}
                </div>
            );
        }

        // Index docs by type for easy access
        const docByType = {};
        docs.forEach(d => { if (d?.doc_type) docByType[d.doc_type] = d?.data || {}; });

        const bill   = docByType['bill_make']                   || null;
        const tarj   = docByType['tarjeta_circulacion_front']   || null;
        const blind  = docByType['certificacion_blindaje']      || null;
        const gas    = docByType['dictamen_gas']                || null;
        const sol    = specs || null;

        // Helper: normalize for comparison
        const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
        const val  = (v) => (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null')
            ? String(v).trim() : null;

        // Field definitions: each field has a groundTruth source and N comparisons
        // gtVal: value from ground truth source (Carta Factura preferred)
        // comparisons: [{ label, value }]
        const FIELDS = [
            {
                label: 'NIV / Serie', icon: '🔑',
                gtLabel: bill ? '📄 Carta Factura' : (sol ? '🖥 SOL' : '—'),
                gtVal: val(bill?.vehicle_info?.niv ?? bill?.niv)
                    ?? val(sol?.Serie),
                comparisons: [
                    { label: '📄 Carta Factura',  value: val(bill?.vehicle_info?.niv ?? bill?.niv) },
                    { label: '🪪 Tarjeta Circ.',  value: val(tarj?.niv) },
                    { label: '🛡 Cert. Blindaje',  value: val(blind?.vehicle_info?.niv ?? blind?.niv) },
                    { label: '⛽ Dict. Gas',       value: val(gas?.serial_number) },
                    { label: '🖥 SOL',             value: val(sol?.Serie) },
                ],
            },
            {
                label: 'Placa', icon: '🪪',
                gtLabel: bill ? '📄 Carta Factura' : (tarj ? '🪪 Tarjeta Circ.' : (sol ? '🖥 SOL' : '—')),
                gtVal: val(bill?.placa)
                    ?? val(tarj?.placa)
                    ?? val(sol?.Placas),
                comparisons: [
                    { label: '📄 Carta Factura', value: val(bill?.placa) },
                    { label: '🪪 Tarjeta Circ.', value: val(tarj?.placa) },
                    { label: '🖥 SOL',            value: val(sol?.Placas) },
                ],
            },
            {
                label: 'Marca', icon: '🏭',
                gtLabel: bill ? '📄 Carta Factura' : (sol ? '🖥 SOL' : '—'),
                gtVal: val(bill?.vehicle_info?.make ?? bill?.make)
                    ?? val(sol?.Marca),
                comparisons: [
                    { label: '📄 Carta Factura',  value: val(bill?.vehicle_info?.make ?? bill?.make) },
                    { label: '🛡 Cert. Blindaje',  value: val(blind?.vehicle_info?.make ?? blind?.make) },
                    { label: '🖥 SOL',             value: val(sol?.Marca) },
                ],
            },
            {
                label: 'Modelo (año)', icon: '📅',
                gtLabel: bill ? '📄 Carta Factura' : (sol ? '🖥 SOL' : '—'),
                gtVal: val(bill?.vehicle_info?.model ?? bill?.model)
                    ?? val(sol?.Modelo),
                comparisons: [
                    { label: '📄 Carta Factura',  value: val(bill?.vehicle_info?.model ?? bill?.model) },
                    { label: '🛡 Cert. Blindaje',  value: val(blind?.vehicle_info?.model ?? blind?.model) },
                    { label: '🖥 SOL',             value: val(sol?.Modelo) },
                ],
            },
            {
                label: 'Serie del Motor', icon: '⚙️',
                gtLabel: bill ? '📄 Carta Factura' : (sol ? '🖥 SOL' : '—'),
                gtVal: val(bill?.vehicle_info?.motor_serial_numer)
                    ?? val(sol?.['NUM MOTOR']),
                comparisons: [
                    { label: '📄 Carta Factura', value: val(bill?.vehicle_info?.motor_serial_numer) },
                    { label: '🖥 SOL',            value: val(sol?.['NUM MOTOR']) },
                ],
            },
            {
                label: 'Empresa Blindadora', icon: '🛡️',
                gtLabel: blind ? '🛡 Cert. Blindaje' : (sol ? '🖥 SOL' : '—'),
                gtVal: val(blind?.armoring_company)
                    ?? val(sol?.BLINDADORA),
                comparisons: [
                    { label: '🛡 Cert. Blindaje', value: val(blind?.armoring_company) },
                    { label: '🖥 SOL',             value: val(sol?.BLINDADORA) },
                ],
            },
        ];

        const statusConfig = {
            ok:       { bg: 'bg-white', border: 'border-gray-200 border-l-[3px] border-l-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'COINCIDE',     icon: '✓' },
            mismatch: { bg: 'bg-white', border: 'border-gray-200 border-l-[3px] border-l-rose-400',    badge: 'bg-rose-50 text-rose-700 border-rose-200',         label: 'DISCREPANCIA', icon: '✕' },
            partial:  { bg: 'bg-white', border: 'border-gray-200 border-l-[3px] border-l-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'PARCIAL',      icon: '⚠' },
            missing:  { bg: 'bg-gray-50/50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-500 border-gray-200',       label: 'SIN DATOS',    icon: '—' },
        };

        const getCardStatus = (gtVal, comparisons) => {
            const available = comparisons.filter(c => c.value != null);
            if (available.length === 0) return 'missing';
            if (available.length === 1) return 'partial';
            const gt = gtVal;
            const hasMismatch = available.some(c => c.value != null && gt != null && norm(c.value) !== norm(gt));
            if (hasMismatch) return 'mismatch';
            return 'ok';
        };

        const rows = FIELDS.map(f => ({
            ...f,
            cardStatus: getCardStatus(f.gtVal, f.comparisons),
        }));

        const mismatches = rows.filter(r => r.cardStatus === 'mismatch').length;
        const allOk      = mismatches === 0 && rows.every(r => r.cardStatus !== 'missing');

        return (
            <div className="pt-4 animate-in fade-in duration-500 flex flex-col gap-5">

                {/* Summary Banner */}
                <div className={`flex items-center gap-4 px-5 py-3.5 rounded-md border bg-gray-50 border-gray-200`}>
                    <span className="text-2xl">
                        {mismatches > 0 ? '🚨' : allOk ? '✅' : '⚠️'}
                    </span>
                    <div className="flex flex-col">
                        <span className={`text-sm font-medium tracking-wide ${
                            mismatches > 0 ? 'text-rose-800' : allOk ? 'text-emerald-800' : 'text-amber-800'
                        }`}>
                            {mismatches > 0
                                ? `${mismatches} discrepancia${mismatches > 1 ? 's' : ''} detectada${mismatches > 1 ? 's' : ''}`
                                : allOk
                                    ? 'Todos los campos coinciden'
                                    : 'Algunos campos tienen fuente única'
                            }
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">
                            Fuente de verdad: <strong>Carta Factura</strong> · Fallback: SOL
                            {!bill && <span className="ml-2 text-amber-600 font-medium">⚠ Sin Carta Factura — usando SOL</span>}
                        </span>
                    </div>
                </div>

                {/* Field comparison cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rows.map(({ label, icon, gtLabel, gtVal, comparisons, cardStatus }) => {
                        const cfg = statusConfig[cardStatus] ?? statusConfig.missing;
                        return (
                            <div key={label} className={`flex flex-col p-4 rounded-md border ${cfg.bg} ${cfg.border} transition-all duration-200`}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="flex items-center gap-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
                                        <span>{icon}</span>{label}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${cfg.badge}`}>
                                        {cfg.icon} {cfg.label}
                                    </span>
                                </div>

                                {/* Ground truth value */}
                                <div className="mb-3 p-3 rounded-md bg-gray-50 border border-gray-100 shadow-sm">
                                    <div className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-1">
                                        Valor usado · {gtLabel}
                                    </div>
                                    <div className="text-sm font-medium text-gray-800 font-mono tracking-wide break-all">
                                        {gtVal ?? <span className="text-gray-400 italic font-normal text-sm">Sin datos</span>}
                                    </div>
                                </div>

                                {/* All sources */}
                                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(comparisons.length, 3)}, minmax(0, 1fr))` }}>
                                    {comparisons.map(({ label: srcLabel, value }) => {
                                        const isMismatch = value != null && gtVal != null && norm(value) !== norm(gtVal);
                                        return (
                                            <div key={srcLabel} className={`flex flex-col p-2 rounded-md border bg-gray-50 border-gray-100`}>
                                                <span className="text-[8px] font-medium text-gray-400 uppercase tracking-widest mb-1 leading-tight">{srcLabel}</span>
                                                <span className={`text-[11px] font-medium break-all leading-snug ${
                                                    isMismatch ? 'text-rose-600' : value != null ? 'text-gray-700' : 'text-gray-400 italic font-normal'
                                                }`}>
                                                    {value ?? 'Sin dato'}
                                                    {isMismatch && <span className="ml-1 text-rose-500">✕</span>}
                                                    {!isMismatch && value != null && <span className="ml-1 text-emerald-500">✓</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {cardStatus === 'mismatch' && (
                                    <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-rose-600 bg-rose-50 px-3 py-1.5 rounded-md border border-rose-100">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        </svg>
                                        Discrepancia detectada entre fuentes. Verificar manualmente.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 pt-1">
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                        <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-medium ${cfg.badge}`}>
                            <span>{cfg.icon}</span> {cfg.label}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full relative">
            <div className="flex justify-between items-end border-b border-gray-200 mb-4">
                <div className="flex gap-8">
                    <button
                        className={`pb-3 text-xs font-medium tracking-wide relative transition-colors ${activeTab === 'docs' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        onClick={() => onTabChange('docs')}
                    >
                        DOCUMENTOS (OCR)
                        {activeTab === 'docs' && <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-blue-600 rounded-t-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>}
                    </button>
                    <button
                        className={`pb-3 text-xs font-medium tracking-wide relative transition-colors ${activeTab === 'spec' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        onClick={() => onTabChange('spec')}
                    >
                        FICHA TÉCNICA (SOL)
                        {activeTab === 'spec' && <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-blue-600 rounded-t-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>}
                    </button>
                    <button
                        className={`pb-3 text-xs font-medium tracking-widest relative transition-colors flex items-center gap-1.5 ${
                            activeTab === 'validation' ? 'text-violet-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                        onClick={() => onTabChange('validation')}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        VALIDACIÓN
                        {activeTab === 'validation' && <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-violet-600 rounded-t-full shadow-[0_0_8px_rgba(124,58,237,0.4)]"></div>}
                    </button>
                </div>

                <button
                    className="mb-2 text-[10px] font-medium tracking-wide text-gray-400 hover:text-red-500 bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:border-red-200 transition-all active:scale-95 flex items-center gap-1.5"
                    onClick={onClose}
                >
                    CERRAR PANEL
                </button>
            </div>

            {activeTab === 'docs' ? renderDocsTab() : activeTab === 'spec' ? renderSpecsTab() : renderValidationTab()}

            {/* DOCUMENT VIEWER MODAL */}
            {viewingDoc && (
                <DocumentReviewModal 
                    docs={[viewingDoc]} 
                    onClose={() => setViewingDoc(null)} 
                    onSuccess={() => {
                        refetchDocs();
                        // Still reset attempt counter for sequential flow within the row if needed
                        setHasAttemptedAutoOpen(0);
                    }} 
                />
            )}
        </div>
    );
}
