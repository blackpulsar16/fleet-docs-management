import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FLEET_API } from '../config/api.js';
import { useApiClient } from '../hooks/useApiClient.js';
import { formatTitle } from '../utils/helpers.jsx';

const DOC_LABELS = {
    dictamen_gas: 'Dictamen de Gas',
    tarjeta_circulacion_front: 'Tarjeta Circulación',
    poliza_seguro: 'Póliza de Seguro',
    certificacion_blindaje: 'Cert. Blindaje',
    bill_make: 'Carta Factura',
};

function formatDaysLeft(totalDays) {
    if (totalDays === null || totalDays === undefined) return null;
    if (totalDays === 0) return 'Hoy';

    const abs = Math.abs(totalDays);
    const negative = totalDays < 0;

    const years  = Math.floor(abs / 365);
    const months = Math.floor((abs % 365) / 30);
    const days   = abs % 30;

    const parts = [];
    if (years  > 0) parts.push(`${years}A`);
    if (months > 0) parts.push(`${months}M`);
    if (days   > 0 || parts.length === 0) parts.push(`${days}D`);

    const str = parts.join(' ');
    return negative ? `-${str}` : str;
}

function DaysBadge({ days, colKey }) {
    if (days === null || days === undefined) return null;
    const map = {
        ok:       'text-slate-500 border-slate-200',
        expiring: 'text-amber-700 border-amber-200',
        expired:  'text-rose-700  border-rose-200',
        missing:  'text-slate-400 border-slate-200',
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap bg-transparent ${map[colKey] || 'text-slate-500 border-slate-200'}`}>
            {formatDaysLeft(days)}
        </span>
    );
}

/* ── Inline document viewer ───────────────────────────────────── */
function DocViewer({ vehicleId, docType, onClose, fetchWithAuth }) {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);

    const { data: doc, isLoading, isError } = useQuery({
        queryKey: ['doc_viewer', vehicleId, docType],
        queryFn: async () => {
            const res = await fetchWithAuth(`${FLEET_API}/vehicles/${vehicleId}/documents`);
            if (!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            const docs = Array.isArray(json.documents) ? json.documents : [];
            return docs.find(d => d.doc_type === docType) || null;
        },
        staleTime: 60_000,
    });

    return (
        <div className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-md flex flex-col md:flex-row p-3 gap-2 animate-in fade-in duration-200">
            {/* File pane */}
            <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-slate-200 font-bold text-sm">{formatTitle(docType)}</span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-slate-400 text-xs font-mono">{vehicleId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {doc?.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5">
                                Abrir externo
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        )}
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#1a1a22]">
                    {isLoading && (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-sm">Cargando documento...</span>
                        </div>
                    )}
                    {isError && <span className="text-rose-400 text-sm">Error al cargar el documento.</span>}
                    {!isLoading && !isError && !doc && <span className="text-slate-500 text-sm">Documento no encontrado en el servidor.</span>}
                    {!isLoading && doc?.file_url && (
                        <>
                            {doc.file_url.match(/\.(jpeg|jpg|png|gif|webp)(\?|$)/i) ? (
                                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                                    <img
                                        src={doc.file_url}
                                        alt={docType}
                                        style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, transition: 'transform 0.3s ease' }}
                                        className="max-w-full max-h-full object-contain origin-center shadow-2xl rounded"
                                    />
                                </div>
                            ) : (
                                <iframe src={doc.file_url} className="w-full h-full border-0 absolute inset-0 bg-white" title="Visor PDF" />
                            )}
                            {doc.file_url.match(/\.(jpeg|jpg|png|gif|webp)(\?|$)/i) && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/80 shadow-lg">
                                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                                    </button>
                                    <span className="text-[11px] font-mono font-bold text-slate-300 w-10 text-center">{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                    </button>
                                    <div className="w-px h-5 bg-slate-700 mx-1" />
                                    <button onClick={() => setRotation(r => r - 90)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                    </button>
                                    <button onClick={() => setRotation(r => r + 90)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                                    </button>
                                    <div className="w-px h-5 bg-slate-700 mx-1" />
                                    <button onClick={() => { setScale(1); setRotation(0); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Meta pane */}
            {!isLoading && doc && (
                <div className="w-full md:w-[420px] shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-2xl min-w-0">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Datos OCR</p>
                        <p className="text-base font-black text-slate-800 mt-0.5">{formatTitle(docType)}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 custom-scrollbar flex flex-col gap-3">
                        {Object.entries(doc.data || {}).map(([k, v]) => {
                            const isObj = v !== null && typeof v === 'object' && !Array.isArray(v);
                            return (
                                <div key={k} className="flex flex-col border-b border-slate-100 pb-3 last:border-0 w-full" style={{minWidth:0}}>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1" style={{wordBreak:'break-word'}}>{formatTitle(k)}</span>
                                    {isObj ? (
                                        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-slate-100 mt-1">
                                            {Object.entries(v).map(([sk, sv]) => (
                                                <div key={sk} className="flex flex-col">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{formatTitle(sk)}</span>
                                                    <span className="text-sm font-bold text-slate-700 leading-snug" style={{wordBreak:'break-all'}}>{String(sv ?? 'N/A')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold text-slate-700 leading-snug" style={{wordBreak:'break-all'}}>{String(v ?? 'N/A')}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Bulk download button ─────────────────────────────────────── */
function DownloadGroupButton({ docType, state, count, fetchWithAuth }) {
    const [dlState, setDlState] = useState('idle');
    if (count === 0) return null;

    const colors = {
        ok:       'bg-gray-100 hover:bg-gray-200 text-gray-700',
        expiring: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
        expired:  'bg-gray-100 hover:bg-gray-200 text-gray-700',
        missing:  'bg-gray-100 hover:bg-gray-200 text-gray-600',
    };

    const handleDownload = async () => {
        if (dlState === 'loading') return;
        setDlState('loading');
        try {
            const res = await fetchWithAuth(`${FLEET_API}/fleet/doc-summary/download?doc_type=${docType}&state=${state}`);
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${docType}_${state}.zip`;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            setDlState('done'); setTimeout(() => setDlState('idle'), 2500);
        } catch { setDlState('error'); setTimeout(() => setDlState('idle'), 3000); }
    };

    return (
        <button onClick={handleDownload} disabled={dlState === 'loading'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all shadow-sm active:scale-95 ${colors[state]} ${dlState === 'loading' ? 'opacity-60 cursor-wait' : ''}`}>
            {dlState === 'loading'
                ? <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                : dlState === 'done'
                    ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            }
            {dlState === 'done' ? '¡Listo!' : dlState === 'error' ? 'Error' : `ZIP (${count})`}
        </button>
    );
}

/* ── Column config ────────────────────────────────────────────── */
const COLS = [
    { key: 'ok',       label: 'Vigentes',   headerBg: 'bg-gray-50', colBg: 'bg-white',   border: 'border-gray-200', cardBorder: 'border-gray-100 hover:border-gray-300', accent: 'bg-emerald-400', idColor: 'text-gray-800' },
    { key: 'expiring', label: 'Por Vencer', headerBg: 'bg-gray-50', colBg: 'bg-white',   border: 'border-gray-200', cardBorder: 'border-gray-100 hover:border-gray-300', accent: 'bg-amber-400',   idColor: 'text-gray-800' },
    { key: 'expired',  label: 'Vencidos',   headerBg: 'bg-gray-50', colBg: 'bg-white',   border: 'border-gray-200', cardBorder: 'border-gray-100 hover:border-gray-300', accent: 'bg-red-400',     idColor: 'text-gray-800' },
    { key: 'missing',  label: 'Sin Doc.',   headerBg: 'bg-gray-50', colBg: 'bg-gray-50', border: 'border-gray-200', cardBorder: 'border-gray-100',                        accent: 'bg-gray-300',    idColor: 'text-gray-500' },
];

/* ── Main component ───────────────────────────────────────────── */
export default function DocFilterView({ docType, docStateFilter, onClearFilter }) {
    const { fetchWithAuth } = useApiClient();
    const [viewing, setViewing] = useState(null); // { vehicleId, docType }
    // sortDir per column key: 'asc' = soonest/least-expired first, 'desc' = opposite
    const [sortDirs, setSortDirs] = useState({ ok: 'asc', expiring: 'asc', expired: 'asc', missing: 'asc' });
    const toggleSort = (colKey) => setSortDirs(prev => ({ ...prev, [colKey]: prev[colKey] === 'asc' ? 'desc' : 'asc' }));
    const docLabel = DOC_LABELS[docType] || formatTitle(docType);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['doc_summary', docType],
        queryFn: async () => {
            const res = await fetchWithAuth(`${FLEET_API}/fleet/doc-summary?doc_type=${docType}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
        enabled: !!docType && docType !== 'all',
        staleTime: 30_000,
    });

    const stateMap = { missing: 'missing', expired: 'expired', expiring: 'expiring', ok: 'ok' };
    const visibleCols = docStateFilter && docStateFilter !== 'all'
        ? COLS.filter(c => c.key === stateMap[docStateFilter])
        : COLS;

    const s = data?.summary ?? {};
    const total = (s.ok ?? 0) + (s.expiring ?? 0) + (s.expired ?? 0) + (s.missing ?? 0);

    const openViewer = useCallback((vehicleId) => {
        setViewing({ vehicleId, docType });
    }, [docType]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Banner */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">Vista Documento</span>
                    <div className="w-px h-4 bg-gray-200" />
                    <span className="text-sm font-semibold text-gray-800">{docLabel}</span>
                    {!isLoading && <span className="text-xs text-gray-400">· {total} vehículos</span>}
                </div>
                <div className="flex items-center gap-2">
                    {!isLoading && data && (
                        <div className="flex items-center gap-2">
                            {s.ok       > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200 text-gray-500">{s.ok} vigentes</span>}
                            {s.expiring > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-amber-200 text-amber-600">{s.expiring} por vencer</span>}
                            {s.expired  > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-red-200 text-red-600">{s.expired} vencidos</span>}
                            {s.missing  > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200 text-gray-400">{s.missing} faltantes</span>}
                        </div>
                    )}
                    <button onClick={onClearFilter}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[10px] font-medium hover:bg-gray-50 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        Salir vista doc.
                    </button>
                </div>
            </div>

            {/* Body */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <svg className="animate-spin w-7 h-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            ) : isError ? (
                <div className="flex-1 flex items-center justify-center text-rose-400 text-sm">Error al cargar el resumen.</div>
            ) : (
                <div className="flex-1 overflow-y-auto overflow-x-hidden flex gap-3 p-4 items-start content-start">
                    {visibleCols.map(col => {
                        const rawVehicles = data?.groups?.[col.key] ?? [];
                        const dir = sortDirs[col.key];
                        // Sort by days_left: asc = smallest number first (soonest expiry / least expired)
                        const vehicles = [...rawVehicles].sort((a, b) => {
                            const da = a.days_left ?? Infinity;
                            const db = b.days_left ?? Infinity;
                            return dir === 'asc' ? da - db : db - da;
                        });
                        const canView = col.key !== 'missing';
                        return (
                            <div key={col.key}
                                className={`flex flex-col flex-1 min-w-0 rounded-xl border ${col.border} ${col.colBg} overflow-hidden`}
                            >
                                {/* Col header */}
                                <div className={`${col.headerBg} border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600">{col.label}</span>
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{vehicles.length}</span>
                                        {col.key !== 'missing' && (
                                            <button
                                                onClick={() => toggleSort(col.key)}
                                                title={sortDirs[col.key] === 'asc' ? 'Ordenado: más próximo primero' : 'Ordenado: más lejano primero'}
                                                className="flex items-center ml-1 p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                                            >
                                                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${sortDirs[col.key] === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    {col.key !== 'missing' && <DownloadGroupButton docType={docType} state={col.key} count={vehicles.length} fetchWithAuth={fetchWithAuth} />}
                                </div>

                                {/* Vehicle cards */}
                                <div className="overflow-y-auto custom-scrollbar flex flex-col divide-y divide-slate-100" style={{maxHeight: 'calc(100vh - 180px)'}}>
                                    {vehicles.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-1.5 opacity-50">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <span className="text-[11px] font-semibold">Sin vehículos</span>
                                        </div>
                                    ) : vehicles.map((v) => (
                                        <button
                                            key={v.id}
                                            onClick={() => canView && openViewer(v.id)}
                                            className={`w-full flex items-stretch bg-white transition-all duration-150 ${canView ? 'cursor-pointer hover:bg-slate-50 group' : 'cursor-default'}`}
                                        >
                                            {/* Accent bar — spans full height */}
                                            <div className={`w-1 shrink-0 ${col.accent}`} />
                                            {/* Content — two rows */}
                                            <div className="flex-1 flex flex-col justify-center px-4 py-3 min-w-0">
                                                <span className={`font-black text-base leading-tight ${col.idColor}`}>{v.id}</span>
                                                {v.days_left !== null && v.days_left !== undefined && (
                                                    <DaysBadge days={v.days_left} colKey={col.key} />
                                                )}
                                            </div>
                                            {/* Eye icon */}
                                            {canView && (
                                                <div className="flex items-center pr-3">
                                                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Document viewer */}
            {viewing && (
                <DocViewer
                    vehicleId={viewing.vehicleId}
                    docType={viewing.docType}
                    onClose={() => setViewing(null)}
                    fetchWithAuth={fetchWithAuth}
                />
            )}
        </div>
    );
}
