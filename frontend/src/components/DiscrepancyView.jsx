import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FLEET_API } from '../config/api.js';
import { useApiClient } from '../hooks/useApiClient.js';
import { formatTitle } from '../utils/helpers.jsx';

// Map backend label → doc_type key
const LABEL_TO_DOCTYPE = {
    'Carta Factura': 'bill_make',
    'Tarjeta Circ.': 'tarjeta_circulacion_front',
    'Cert. Blindaje': 'certificacion_blindaje',
    'Dict. Gas': 'dictamen_gas',
};

/* ── Document viewer modal ────────────────────────────────────── */
function DocViewer({ vehicleId, docType, onClose, fetchWithAuth }) {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);

    const { data: doc, isLoading, isError } = useQuery({
        queryKey: ['doc_viewer', vehicleId, docType],
        queryFn: async () => {
            const res = await fetchWithAuth(`${FLEET_API}/vehicles/${vehicleId}/documents`);
            if (!res.ok) throw new Error();
            const json = await res.json();
            return (json.documents ?? []).find(d => d.doc_type === docType) ?? null;
        },
        staleTime: 60_000,
    });

    return (
        <div className="fixed inset-0 z-[300] bg-gray-900/95 backdrop-blur-md flex flex-col md:flex-row p-3 gap-2 animate-in fade-in duration-200">
            {/* File pane */}
            <div className="flex-1 bg-gray-950 rounded-2xl border border-gray-700/50 flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-gray-200 font-bold text-sm">{formatTitle(docType)}</span>
                        <span className="text-gray-500 text-xs">·</span>
                        <span className="text-gray-400 text-xs font-mono">{vehicleId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {doc?.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5">
                                Abrir externo
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        )}
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-rose-500 hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#1a1a22]">
                    {isLoading && <svg className="animate-spin w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                    {isError && <span className="text-rose-400 text-sm">Error al cargar el documento.</span>}
                    {!isLoading && !isError && !doc && <span className="text-gray-500 text-sm">Documento no encontrado.</span>}
                    {!isLoading && doc?.file_url && (
                        doc.file_url.match(/\.(jpeg|jpg|png|gif|webp)(\?|$)/i)
                            ? <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                                <img src={doc.file_url} alt={docType}
                                    style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, transition: 'transform 0.3s ease' }}
                                    className="max-w-full max-h-full object-contain origin-center shadow-2xl rounded" />
                              </div>
                            : <iframe src={doc.file_url} className="w-full h-full border-0 absolute inset-0 bg-white" title="Visor PDF" />
                    )}
                </div>
            </div>

            {/* Meta pane */}
            {!isLoading && doc && (
                <div className="w-full md:w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden shadow-2xl">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400">Datos OCR</p>
                        <p className="text-base font-semibold text-gray-800 mt-0.5">{formatTitle(docType)}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col gap-3">
                        {Object.entries(doc.data || {}).map(([k, v]) => {
                            const isObj = v !== null && typeof v === 'object' && !Array.isArray(v);
                            return (
                                <div key={k} className="flex flex-col border-b border-gray-100 pb-3 last:border-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{formatTitle(k)}</span>
                                    {isObj ? (
                                        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-gray-100 mt-1">
                                            {Object.entries(v).map(([sk, sv]) => (
                                                <div key={sk} className="flex flex-col">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{formatTitle(sk)}</span>
                                                    <span className="text-sm font-bold text-gray-700 leading-snug break-all">{String(sv ?? 'N/A')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold text-gray-700 leading-snug break-all">{String(v ?? 'N/A')}</span>
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

/* ── Source chip ──────────────────────────────────────────────── */
function SourceChip({ label, value, isGround }) {
    return (
        <div className={`flex flex-col min-w-0 px-2.5 py-1.5 rounded border ${
            isGround ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'
        }`}>
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 leading-none mb-1 truncate">
                {label}{isGround && <span className="ml-1 text-gray-500">★</span>}
            </span>
            <span className="text-[11px] font-bold text-gray-800 font-mono break-all leading-snug">
                {value}
            </span>
        </div>
    );
}

/* ── Character-level alignment diff ──────────────────────────── */
function CharDiff({ value, reference }) {
    const s    = String(value     ?? '').toUpperCase();
    const r    = String(reference ?? '').toUpperCase();
    const orig = String(value     ?? ''); // preserve original casing for display
    const m = s.length, n = r.length;

    // Build LCS DP table
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = s[i - 1] === r[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    // Backtrack → produce aligned segments:
    //   'match'   — char in s matches char in r
    //   'extra'   — char in s has no match in r (wrong / extra)
    //   'missing' — char in r has no match in s (absent from s → show placeholder)
    const segments = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && s[i - 1] === r[j - 1]) {
            segments.unshift({ char: orig[i - 1], type: 'match' });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            // char present in r but absent from s
            segments.unshift({ char: r[j - 1], type: 'missing' });
            j--;
        } else {
            // char present in s but not matched in r
            segments.unshift({ char: orig[i - 1], type: 'extra' });
            i--;
        }
    }

    const missingSegs = segments.filter(s => s.type === 'missing');
    const extraCount  = segments.filter(s => s.type === 'extra').length;
    // Only show a badge when there are NET missing chars (pure substitutions cancel out)
    const netMissing  = missingSegs.length - extraCount;

    return (
        <span className="font-mono text-[11px] font-bold break-all leading-snug">
            {segments.map((seg, idx) => {
                if (seg.type === 'match') {
                    return <span key={idx} className="text-gray-700">{seg.char}</span>;
                }
                if (seg.type === 'extra') {
                    return <span key={idx} className="text-rose-600 bg-rose-100 rounded-[2px] px-[1px]">{seg.char}</span>;
                }
                return null; // 'missing' — not rendered inline
            })}
            {netMissing > 0 && (
                <span
                    title={`Faltan: ${missingSegs.map(s => s.char).join('')}`}
                    className="ml-1 text-[9px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-1 py-px cursor-default"
                >
                    −{netMissing}
                </span>
            )}
        </span>
    );
}




/* ── Discrepancy + matching detail ───────────────────────────── */
function DiscrepancyDetail({ discrepancies, matching = [] }) {
    const GROUND_TRUTH_ORDER = ['Carta Factura', 'Tarjeta Circ.', 'Cert. Blindaje', 'Dict. Gas'];

    const renderRow = (d, isMismatch) => {
        const entries = Object.entries(d.sources);
        const groundLabel = GROUND_TRUTH_ORDER.find(l => d.sources[l] != null) ?? entries[0]?.[0];
        const groundVal   = d.sources[groundLabel];
        const norm        = v => String(v ?? '').toUpperCase().replace(/\s+/g, '');

        return (
            <div key={d.field} className={`flex items-start gap-4 px-5 py-3 ${isMismatch ? 'bg-white' : 'bg-gray-50/50'}`}>
                {/* Field label */}
                <div className="w-36 shrink-0 pt-0.5 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${isMismatch ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{d.label}</span>
                </div>

                {/* Sources */}
                <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                    {entries.map(([srcLabel, value]) => {
                        const hasDiff = isMismatch && norm(value) !== norm(groundVal);
                        return (
                            <div key={srcLabel} className="flex flex-col min-w-0 px-2.5 py-1.5 rounded border bg-white border-gray-200">
                                <span className="text-[8px] font-bold uppercase tracking-widest leading-none mb-1 text-gray-400">
                                    {srcLabel}{srcLabel === groundLabel && <span className="ml-1 text-gray-400">★</span>}
                                </span>
                                {hasDiff
                                    ? <CharDiff value={value} reference={groundVal} />
                                    : <span className="font-mono text-[11px] font-bold text-gray-700 break-all leading-snug">{value}</span>
                                }
                            </div>
                        );
                    })}
                </div>

                {/* Badge */}
                <div className="shrink-0 pt-0.5">
                    {isMismatch
                        ? <span className="text-[9px] font-medium uppercase tracking-widest px-2 py-0.5 rounded border bg-rose-50 border-rose-200 text-rose-700 whitespace-nowrap">✕ Diferencia</span>
                        : <span className="text-[9px] font-medium uppercase tracking-widest px-2 py-0.5 rounded border bg-emerald-50 border-emerald-200 text-emerald-700 whitespace-nowrap">✓ Coincide</span>
                    }
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col divide-y divide-gray-100">
            {discrepancies.map(d => renderRow(d, true))}
            {matching.length > 0 && (
                <>
                    <div className="px-5 py-1.5 bg-gray-100/60">
                        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Campos que coinciden ({matching.length})</span>
                    </div>
                    {matching.map(d => renderRow(d, false))}
                </>
            )}
        </div>
    );
}


/* ── Main component ───────────────────────────────────────────── */
export default function DiscrepancyView({ onClose, vehicles: fleetVehicles = [] }) {
    const { fetchWithAuth } = useApiClient();
    const [expandedId, setExpandedId] = useState(null);
    const [search, setSearch] = useState('');
    const [viewing, setViewing] = useState(null); // { vehicleId, docType }

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['fleet_discrepancies'],
        queryFn: async () => {
            const res = await fetchWithAuth(`${FLEET_API}/fleet/discrepancies`);
            if (!res.ok) throw new Error('fetch failed');
            return res.json();
        },
        staleTime: 60_000,
    });

    const [sortDir, setSortDir] = useState('asc');

    const allVehicles = data?.vehicles ?? [];

    // Build a lookup for UN from fleet vehicles
    const unMap = {};
    fleetVehicles.forEach(v => { unMap[v.id] = v.un || '—'; });

    const filtered = allVehicles
        .filter(v => !search || v.vehicle_id.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const cmp = a.vehicle_id.localeCompare(b.vehicle_id, undefined, { numeric: true });
            return sortDir === 'asc' ? cmp : -cmp;
        });

    const totalDiscrepancies = allVehicles.reduce((s, v) => s + v.count, 0);

    return (
        <div className="flex flex-col h-full overflow-hidden relative">

            {/* ── Banner ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 pr-36">
                <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                        Vista Discrepancias
                    </span>
                    <div className="w-px h-4 bg-gray-200" />
                    <span className="text-sm font-semibold text-gray-800">
                        Validación cruzada OCR
                    </span>
                    {!isLoading && data && (
                        <span className="text-xs text-gray-400">
                            · {data.total} vehículo{data.total !== 1 ? 's' : ''} con diferencias
                            {totalDiscrepancies > 0 && ` · ${totalDiscrepancies} campo${totalDiscrepancies !== 1 ? 's' : ''}`}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-2 top-1/2 -trangray-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar ID..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-6 pr-3 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                        />
                    </div>
                    <button
                        onClick={() => refetch()}
                        title="Actualizar"
                        className="flex items-center justify-center w-7 h-7 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Exit button — top-right corner */}
            <button
                onClick={onClose}
                className="absolute top-2 right-3 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-gray-500 text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all shadow-sm active:scale-95"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Salir vista
            </button>

            {/* ── Body ── */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <svg className="animate-spin w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            ) : isError ? (
                <div className="flex-1 flex items-center justify-center text-rose-400 text-sm">
                    Error al cargar discrepancias.
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 opacity-60">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold">
                        {search ? 'Sin resultados para esa búsqueda' : 'Sin discrepancias detectadas'}
                    </span>
                    {!search && (
                        <span className="text-xs text-gray-500">
                            Todos los campos coinciden entre documentos
                        </span>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Table header */}
                    <div className="flex-shrink-0 grid bg-gray-50 border-b border-gray-200 text-[10px] font-semibold uppercase tracking-widest text-gray-400"
                        style={{ gridTemplateColumns: '10rem 1fr 10rem 6rem' }}>
                        <button
                            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                            className="px-5 py-2.5 flex items-center gap-1.5 text-left hover:text-gray-600 transition-colors group"
                        >
                            ID Vehículo
                            <svg className={`w-3 h-3 transition-transform duration-150 text-gray-400 group-hover:text-gray-600 ${sortDir === 'desc' ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                        </button>
                        <div className="px-4 py-2.5">Campos validados</div>
                        <div className="px-4 py-2.5">Plaza (UN)</div>
                        <div className="px-4 py-2.5 text-right">Difs.</div>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 bg-white">
                        {filtered.map((v) => {
                            const isExpanded = expandedId === v.vehicle_id;
                            const un = unMap[v.vehicle_id] ?? '—';
                            const fieldLabels   = v.discrepancies.map(d => d.label);
                            const matchingLabels = (v.matching ?? []).map(d => d.label);

                            return (
                                <React.Fragment key={v.vehicle_id}>
                                    {/* Summary row */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : v.vehicle_id)}
                                        className={`w-full grid text-left transition-all duration-150 group ${
                                            isExpanded
                                                ? 'bg-gray-50 shadow-[inset_3px_0_0_0_rgba(239,68,68,0.8)]'
                                                : 'hover:bg-gray-50/70'
                                        }`}
                                        style={{ gridTemplateColumns: '10rem 1fr 10rem 6rem' }}
                                    >
                                        {/* Vehicle ID */}
                                        <div className="px-5 py-3 flex items-center gap-2">
                                            <svg className={`w-3.5 h-3.5 transition-transform duration-150 shrink-0 text-gray-400 ${isExpanded ? 'rotate-90' : ''}`}
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="font-semibold text-gray-800 text-sm">{v.vehicle_id}</span>
                                        </div>

                                        {/* Field tags — mismatches + matching */}
                                        <div className="px-4 py-3 flex flex-wrap gap-1.5 items-center">
                                            {fieldLabels.map(lbl => (
                                                <span key={lbl}
                                                    className="text-[9px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 whitespace-nowrap">
                                                    ✕ {lbl}
                                                </span>
                                            ))}
                                            {matchingLabels.length > 0 && (
                                                <span className="w-px h-3 bg-gray-200 mx-0.5" />
                                            )}
                                            {matchingLabels.map(lbl => (
                                                <span key={lbl}
                                                    className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 whitespace-nowrap opacity-80">
                                                    ✓ {lbl}
                                                </span>
                                            ))}
                                        </div>

                                        {/* UN */}
                                        <div className="px-4 py-3 flex items-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                {un}
                                            </span>
                                        </div>

                                        {/* Count */}
                                        <div className="px-4 py-3 text-right flex flex-col items-end justify-center gap-0.5">
                                            <span className="text-sm font-semibold text-rose-600 tabular-nums leading-none">{v.count}</span>
                                            {matchingLabels.length > 0 && (
                                                <span className="text-[10px] font-bold text-emerald-600 tabular-nums leading-none">{matchingLabels.length} ✓</span>
                                            )}
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    {isExpanded && (() => {
                                        // Collect unique doc types involved in any discrepancy
                                        const involvedLabels = new Set();
                                        v.discrepancies.forEach(d =>
                                            Object.keys(d.sources).forEach(l => involvedLabels.add(l))
                                        );
                                        const involvedDocs = [...involvedLabels]
                                            .map(l => ({ label: l, docType: LABEL_TO_DOCTYPE[l] }))
                                            .filter(x => x.docType);

                                        return (
                                            <div className="bg-gray-50/60 border-b border-gray-200 border-l-4 border-l-rose-400 animate-in slide-in-from-top-1 fade-in duration-150">
                                                {/* Sub-header */}
                                                <div className="px-4 py-2 border-b border-gray-200 bg-gray-100/60 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-500">
                                                            Detalle · {v.vehicle_id} · {v.count} campo{v.count !== 1 ? 's' : ''} con diferencia
                                                        </span>
                                                        <span className="ml-3 text-[9px] text-gray-400">★ = fuente de referencia (Carta Factura tiene prioridad)</span>
                                                    </div>
                                                    {/* Document view buttons */}
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                                                        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400 mr-1">Ver doc:</span>
                                                        {involvedDocs.map(({ label, docType }) => (
                                                            <button
                                                                key={docType}
                                                                onClick={() => setViewing({ vehicleId: v.vehicle_id, docType })}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-[10px] font-bold text-gray-600 transition-all active:scale-95 shadow-sm"
                                                            >
                                                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <DiscrepancyDetail discrepancies={v.discrepancies} matching={v.matching ?? []} />
                                            </div>
                                        );
                                    })()}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="flex-shrink-0 px-5 py-2 border-t border-gray-100 bg-white flex items-center gap-4">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {filtered.length} vehículo{filtered.length !== 1 ? 's' : ''} · {totalDiscrepancies} diferencia{totalDiscrepancies !== 1 ? 's' : ''} total
                        </span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400">
                            Solo OCR entre documentos · Comparación SOL disponible en pestaña Validación por vehículo
                        </span>
                    </div>
                </div>
            )}

            {/* Document viewer modal */}
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
