import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, ArrowUp, ArrowDown, LogOut } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { useRole } from '../hooks/useRole.js';
import ExpandedVehicleRow from './ExpandedVehicleRow.jsx';
import DocumentReviewModal from './DocumentReviewModal.jsx';
import DocFilterView from './DocFilterView.jsx';
import DiscrepancyView from './DiscrepancyView.jsx';
import { formatTitle, extractDocName, parseExpirationString, renderDocIcon } from '../utils/helpers.jsx';
import { FLEET_API, SOL_API, AI_API } from '../config/api.js';
import { useApiClient } from '../hooks/useApiClient.js';

const DOC_LABELS = {
    dictamen_gas:              'Dictamen de Gas',
    tarjeta_circulacion_front: 'Tarjeta Circulación',
    poliza_seguro:             'Póliza de Seguro',
    certificacion_blindaje:    'Cert. Blindaje',
    bill_make:                 'Carta Factura',
};

export default function FleetDashboard() {
    const queryClientInstance = useQueryClient();
    const auth = useAuth();
    const { isEditor } = useRole();
    const { fetchWithAuth } = useApiClient();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [unFilter, setUnFilter] = useState('all');
    const [sysStatusFilter, setSysStatusFilter] = useState('all');
    const [docTypeFilter, setDocTypeFilter] = useState('all');
    const [docStateFilter, setDocStateFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'id', dir: 'asc' });

    const [isDiscrepancyView, setIsDiscrepancyView] = useState(false);

    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [activeTab, setActiveTab] = useState('docs');
    const [autoOpenReviewTrigger, setAutoOpenReviewTrigger] = useState(0);
    const [sessionReviewDocs, setSessionReviewDocs] = useState([]);
    const [isSessionReviewOpen, setIsSessionReviewOpen] = useState(false);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadVehicleId, setUploadVehicleId] = useState('');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadPhase, setUploadPhase] = useState('idle');
    const [fileStatuses, setFileStatuses] = useState({});
    const [uploadErrorMsg, setUploadErrorMsg] = useState('');
    const [isIdDropdownOpen, setIsIdDropdownOpen] = useState(false);
    const [downloadingVehicleId, setDownloadingVehicleId] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const scrollContainerRef = useRef(null);
    const [currentScrolledId, setCurrentScrolledId] = useState(null);
    const [isScrolling, setIsScrolling] = useState(false);

    const scrollTimeoutRef = useRef(null);
    const currentScrolledIdRef = useRef(null);
    const lastIdCheckRef = useRef(0);
    const uploadHasErrorsRef = useRef(false);
    const sessionDocsRef = useRef([]);

    const { data: vehicles = [], isLoading: isLoadingFleet } = useQuery({
        queryKey: ['fleet_merged'],
        queryFn: async () => {
            const [fleetRes, plazasRes, estatusRes] = await Promise.all([
                fetchWithAuth(`${FLEET_API}/fleet`).catch(() => null),
                fetchWithAuth(`${SOL_API}/sol/plazas`).catch(() => null),
                fetchWithAuth(`${SOL_API}/sol/estatus`).catch(() => null)
            ]);

            if (!fleetRes || !fleetRes.ok) throw new Error('Fleet network response was not ok');
            const fleetData = await fleetRes.json();

            let plazasData = {};
            if (plazasRes && plazasRes.ok) {
                plazasData = await plazasRes.json();
            }

            let estatusData = {};
            if (estatusRes && estatusRes.ok) {
                estatusData = await estatusRes.json();
            }

            return fleetData.map(v => ({
                ...v,
                un: plazasData[v.id] || 'SIN PLAZA',
                sysStatus: estatusData[v.id] || 'DESCONOCIDO'
            }));
        }
    });

    const uniqueUNs = useMemo(() => [...new Set(vehicles.map(v => v.un))].filter(Boolean).sort(), [vehicles]);
    const uniqueSysStatuses = useMemo(() => [...new Set(vehicles.map(v => v.sysStatus))].filter(Boolean).sort(), [vehicles]);

    // Map internal doc_type keys → human-readable labels
    const DOC_TYPE_OPTIONS = [
        { value: 'all', label: 'Tipo doc: Todos' },
        { value: 'dictamen_gas', label: 'Dictamen de Gas' },
        { value: 'tarjeta_circulacion_front', label: 'Tarjeta Circulación' },
        { value: 'poliza_seguro', label: 'Póliza de Seguro' },
        { value: 'certificacion_blindaje', label: 'Cert. Blindaje' },
        { value: 'bill_make', label: 'Carta Factura' },
    ];

    const DOC_STATE_OPTIONS = [
        { value: 'all', label: 'Estado doc: Todos' },
        { value: 'missing', label: 'Faltante' },
        { value: 'expired', label: 'Vencido' },
        { value: 'expiring', label: 'Por vencer (≤30 días)' },
        { value: 'ok', label: 'Vigente' },
    ];

    useEffect(() => {
        setSelectedVehicle(null);
        setActiveTab('docs');
    }, [searchTerm, statusFilter, unFilter, sysStatusFilter, docTypeFilter, docStateFilter, sortConfig]);

    useEffect(() => {
        if (selectedVehicle) {
            setTimeout(() => {
                const element = document.getElementById(`row-${selectedVehicle}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 150);
        }
    }, [selectedVehicle]);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 1000);
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const now = Date.now();
        if (now - lastIdCheckRef.current > 50) {
            lastIdCheckRef.current = now;
            const rows = container.querySelectorAll('tr[id^="row-"]');
            let closestRow = null;
            let minDistance = Infinity;
            const containerTop = container.getBoundingClientRect().top;
            const headerOffset = 45;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rect = row.getBoundingClientRect();
                const distance = Math.abs(rect.top - (containerTop + headerOffset));
                if (distance < minDistance) {
                    minDistance = distance;
                    closestRow = row;
                }
            }

            if (closestRow) {
                const id = closestRow.id.replace('row-', '');
                if (id !== currentScrolledIdRef.current) {
                    currentScrolledIdRef.current = id;
                    setCurrentScrolledId(id);
                }
            }
        }
    }, []);

    const safeVehicles = useMemo(() => Array.isArray(vehicles) ? vehicles : [], [vehicles]);

    const baseFilteredVehicles = useMemo(() => {
        return safeVehicles.filter(v => {
            const matchesSearch = (v.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (v.model || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesUN = unFilter === 'all' || v.un === unFilter;
            const matchesSysStatus = sysStatusFilter === 'all' || v.sysStatus === sysStatusFilter;
            return matchesSearch && matchesUN && matchesSysStatus;
        });
    }, [safeVehicles, searchTerm, unFilter, sysStatusFilter]);

    const stats = useMemo(() => ({
        total: baseFilteredVehicles.length,
        ok: baseFilteredVehicles.filter(v => v.status === 'ok').length,
        warning: baseFilteredVehicles.filter(v => v.status === 'warning').length,
        critical: baseFilteredVehicles.filter(v => v.status === 'critical').length
    }), [baseFilteredVehicles]);

    // Fetch doc-summary when a document type filter is active
    const { data: docSummaryData } = useQuery({
        queryKey: ['doc_summary', docTypeFilter],
        queryFn: async () => {
            const res = await fetchWithAuth(`${FLEET_API}/fleet/doc-summary?doc_type=${docTypeFilter}`);
            if (!res.ok) throw new Error('doc summary error');
            return res.json();
        },
        enabled: docTypeFilter !== 'all',
        staleTime: 30_000,
    });

    // KPI counts: when doc filter is active, show doc-level counts
    const activeStats = useMemo(() => {
        if (docTypeFilter !== 'all' && docSummaryData?.summary) {
            const s = docSummaryData.summary;
            return {
                total: s.ok + s.expiring + s.expired + s.missing,
                ok: s.ok,
                warning: s.expiring,
                critical: s.expired + s.missing,
            };
        }
        return stats;
    }, [docTypeFilter, docSummaryData, stats]);

    const allVehicleIds = useMemo(() => Array.from(new Set(safeVehicles.map(v => v.id))), [safeVehicles]);

    const resetUploadModal = () => {
        setIsUploadModalOpen(false);
        setUploadVehicleId('');
        setUploadFiles([]);
        setUploadPhase('idle');
        setFileStatuses({});
        setUploadErrorMsg('');
        uploadHasErrorsRef.current = false;
        setSessionReviewDocs([]);
        sessionDocsRef.current = [];
    };

    const handleStartValidation = useCallback(() => {
        const docsToReview = sessionDocsRef.current;
        if (docsToReview.length > 0) {
            setSessionReviewDocs([...docsToReview]);
            setIsSessionReviewOpen(true);
            setIsUploadModalOpen(false);
            setAutoOpenReviewTrigger(0); // Reset dashboard trigger to prevent dual modals
        } else {
            // If for some reason there are no session docs, just close the modal
            resetUploadModal();
        }
    }, []);

    const handleGlobalUpload = useCallback(async (e) => {
        e.preventDefault();
        if (!uploadFiles.length || !uploadVehicleId) return;

        setUploadPhase('uploading');
        setUploadErrorMsg('');
        
        // Reset session docs to ensure we only review current upload
        sessionDocsRef.current = [];
        setSessionReviewDocs([]);
        
        // Initialize all files as 'processing'
        const initialStatuses = {};
        uploadFiles.forEach(f => { initialStatuses[f.name] = { status: 'processing', docType: '' }; });
        setFileStatuses(initialStatuses);

        const formData = new FormData();
        uploadFiles.forEach(f => formData.append('files', f));

        try {
            const response = await fetchWithAuth(`${AI_API}/ai/${uploadVehicleId}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                setUploadPhase('error');
                setUploadErrorMsg('Error de conexión con el servidor.');
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            const processJSON = (jsonStr) => {
                try {
                    const cleanStr = jsonStr.replace(/^data:\s*/, '');
                    const data = JSON.parse(cleanStr);

                    if (data.status === 'all_done') {
                        queryClientInstance.invalidateQueries({ queryKey: ['fleet_merged'] });
                        queryClientInstance.invalidateQueries({ queryKey: ['documents', uploadVehicleId] });
                        queryClientInstance.invalidateQueries({ queryKey: ['fleet_discrepancies'] });
                        
                        if (uploadHasErrorsRef.current) {
                            // Hubo archivos con error — NO mostrar pantalla verde,
                            // el usuario ya ve los errores por archivo en la lista.
                            setUploadPhase('error');
                            setUploadErrorMsg('Uno o más documentos no pudieron clasificarse. Revisa los archivos marcados en rojo.');
                        } else {
                            setUploadPhase('completed');
                            // Auto-trigger session review after a short delay
                            setTimeout(() => {
                                handleStartValidation();
                            }, 1500);
                        }
                        return;
                    }

                    if (data.file) {
                        if (['error', 'unclassified', 'no_result'].includes(data.status)) {
                            uploadHasErrorsRef.current = true;
                        }
                        if (data.status === 'completed') {
                            const ingested = data.final_data?.database_response?.ingested_docs || 
                                            data.database_response?.ingested_docs || 
                                            data.ingested_docs;
                                            
                            if (ingested && Array.isArray(ingested)) {
                                const existingIds = new Set(sessionDocsRef.current.map(d => d.id));
                                const uniqueNew = ingested.filter(d => !existingIds.has(d.id));
                                sessionDocsRef.current = [...sessionDocsRef.current, ...uniqueNew];
                                setSessionReviewDocs([...sessionDocsRef.current]);
                            }
                        }
                        setFileStatuses(prev => ({
                            ...prev,
                            [data.file]: {
                                status: data.status,
                                docType: data.document_type || prev[data.file]?.docType || '',
                                errorMsg: data.message || data.error || prev[data.file]?.errorMsg || ''
                            }
                        }));
                    }

                    if (data.status === 'error' && !data.file) {
                        uploadHasErrorsRef.current = true;
                        setUploadPhase('error');
                        setUploadErrorMsg(data.message || 'Error desconocido');
                    }
                } catch (err) { }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                if (buffer.includes('\n\n')) {
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop();
                    parts.forEach(p => { const d = p.replace(/^data:\s*/, '').trim(); if (d) processJSON(d); });
                } else {
                    const lines = buffer.split('\n');
                    if (lines.length > 1) {
                        buffer = lines.pop();
                        lines.forEach(l => { if (l.trim()) processJSON(l.trim()); });
                    } else {
                        try {
                            const clean = buffer.replace(/^data:\s*/, '').trim();
                            if (clean) { JSON.parse(clean); processJSON(clean); buffer = ''; }
                        } catch (err) { }
                    }
                }
            }
        } catch (error) {
            console.error('Error de subida:', error);
            setUploadPhase('error');
            setUploadErrorMsg('Error de red.');
        }
    }, [uploadFiles, uploadVehicleId, fetchWithAuth, handleStartValidation, queryClientInstance]);

    const filteredVehicles = useMemo(() => {
        const statusOrder = { critical: 0, warning: 1, ok: 2 };
        return baseFilteredVehicles
            .filter(v => statusFilter === 'all' || v.status === statusFilter)
            .filter(v => {
                if (docTypeFilter === 'all') return true;

                const availableDocs = v.availableDocs || [];
                const missingDocs = v.missingDocs || [];
                const expiringDocs = v.expiringDocs || [];

                const isMissing = missingDocs.some(d => d === docTypeFilter || d.includes(docTypeFilter));
                const isExpired = expiringDocs.some(s => {
                    const name = s.split(/ expired /i)[0].split(/ expires in /i)[0].trim();
                    return name === docTypeFilter;
                });
                const isExpiring = expiringDocs.some(s => {
                    if (!s.toLowerCase().includes('expires in')) return false;
                    const name = s.split(/ expires in /i)[0].trim();
                    return name === docTypeFilter;
                });
                const isExpiredOnly = expiringDocs.some(s => {
                    if (!s.toLowerCase().includes('expired')) return false;
                    const name = s.split(/ expired /i)[0].trim();
                    return name === docTypeFilter;
                });
                const isAvailable = availableDocs.some(d =>
                    (typeof d === 'string' ? d : d.doc_type) === docTypeFilter
                ) && !isExpired;

                if (docStateFilter === 'all') {
                    // Vehicle must have some relation to this doc type
                    return isMissing || isExpired || isAvailable;
                }
                if (docStateFilter === 'missing') return isMissing;
                if (docStateFilter === 'expired') return isExpiredOnly;
                if (docStateFilter === 'expiring') return isExpiring;
                if (docStateFilter === 'ok') return isAvailable;
                return true;
            })
            .sort((a, b) => {
                const { key, dir } = sortConfig;
                const mul = dir === 'asc' ? 1 : -1;
                if (key === 'status') {
                    const sa = statusOrder[a.status] ?? 99;
                    const sb = statusOrder[b.status] ?? 99;
                    return (sa - sb) * mul;
                }
                return (a[key] || '').localeCompare(b[key] || '', undefined, { numeric: true }) * mul;
            });
    }, [baseFilteredVehicles, statusFilter, docTypeFilter, docStateFilter, sortConfig]);

    const handleRowClick = useCallback((id) => {
        setSelectedVehicle(prev => prev === id ? null : id);
        setActiveTab('docs');
    }, []);

    const handleSort = useCallback((key) => {
        setSortConfig(prev =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'asc' }
        );
    }, []);

    const handleDownloadVehicle = useCallback(async (e, vehicleId) => {
        e.stopPropagation();
        if (downloadingVehicleId) return;
        setDownloadingVehicleId(vehicleId);
        try {
            const response = await fetchWithAuth(`${FLEET_API}/vehicles/${vehicleId}/documents/download-all`);
            if (!response.ok) throw new Error('Error al descargar');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vehicleId}_docs.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error descargando documentos:', err);
        } finally {
            setDownloadingVehicleId(null);
        }
    }, [downloadingVehicleId]);

    const SortBtn = ({ col }) => {
        const active = sortConfig.key === col;
        return (
            <button
                onClick={(e) => { e.stopPropagation(); handleSort(col); }}
                className={`ml-1.5 inline-flex items-center justify-center rounded transition-all duration-150 ${active
                    ? 'text-blue-300 hover:text-blue-200'
                    : 'text-gray-500 hover:text-gray-300'
                    }`}
                title={`Ordenar por columna`}
            >
                {active
                    ? (sortConfig.dir === 'asc'
                        ? <ArrowUp size={12} strokeWidth={2.5} />
                        : <ArrowDown size={12} strokeWidth={2.5} />)
                    : <ChevronsUpDown size={11} strokeWidth={2} />}
            </button>
        );
    };

    return (
        <div
            className="flex h-screen overflow-hidden bg-white text-gray-800"
            style={{
                backgroundImage: 'radial-gradient(circle, #e2e4e8 1px, transparent 1px)',
                backgroundSize: '20px 20px',
            }}
        >

            {/* ── SIDEBAR ── */}
            <aside className="w-56 flex-shrink-0 flex flex-col bg-gray-50 text-gray-700 border-r border-gray-200">

                {/* Logo */}
                <div className="px-5 pt-5 pb-4">
                    <h1 className="text-sm font-medium tracking-tight text-gray-800">Gestión Flota</h1>
                    <p className="text-[9px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Panel de control</p>
                </div>

                {/* Scrollable filter area */}
                <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-4">

                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
                        <input
                            type="text"
                            placeholder="Buscar ID o modelo..."
                            className="w-full pl-7 pr-6 py-2 bg-white border border-gray-200 rounded-md text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 leading-none text-sm">&times;</button>
                        )}
                    </div>

                    {/* Section: Vehículo */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[9px] font-medium uppercase tracking-widest text-gray-400 px-0.5">Vehículo</p>
                        <select
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                            value={unFilter}
                            onChange={(e) => setUnFilter(e.target.value)}
                        >
                            <option value="all">Plaza: Todas</option>
                            {uniqueUNs.map(un => <option key={un} value={un}>{un}</option>)}
                        </select>
                        <select
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                            value={sysStatusFilter}
                            onChange={(e) => setSysStatusFilter(e.target.value)}
                        >
                            <option value="all">SOL: Todos</option>
                            {uniqueSysStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Section: Documento */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[9px] font-medium uppercase tracking-widest text-gray-400 px-0.5">Documento</p>
                        <select
                            id="filter-doc-type"
                            className={`w-full px-2.5 py-1.5 border rounded-md text-xs cursor-pointer focus:outline-none focus:ring-1 transition-colors ${
                                docTypeFilter !== 'all'
                                    ? 'bg-blue-50 border-blue-200 text-blue-700 focus:ring-blue-400'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 focus:ring-blue-400'
                            }`}
                            value={docTypeFilter}
                            onChange={(e) => { setDocTypeFilter(e.target.value); setDocStateFilter('all'); }}
                        >
                            {DOC_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <select
                            id="filter-doc-state"
                            disabled={docTypeFilter === 'all'}
                            className={`w-full px-2.5 py-1.5 border rounded-md text-xs cursor-pointer focus:outline-none focus:ring-1 transition-colors ${
                                docTypeFilter === 'all'
                                    ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                    : docStateFilter !== 'all'
                                        ? 'bg-blue-50 border-blue-200 text-blue-700 focus:ring-blue-400'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 focus:ring-blue-400'
                            }`}
                            value={docStateFilter}
                            onChange={(e) => setDocStateFilter(e.target.value)}
                        >
                            {DOC_STATE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        {(docTypeFilter !== 'all' || docStateFilter !== 'all') && (
                            <button
                                id="clear-doc-filter"
                                onClick={() => { setDocTypeFilter('all'); setDocStateFilter('all'); }}
                                className="flex items-center justify-center gap-1 w-full py-1.5 rounded-md border border-gray-200 text-gray-500 text-[10px] font-medium hover:bg-gray-50 transition-colors"
                            >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                Limpiar filtro
                            </button>
                        )}
                    </div>

                </div>

                {/* Bottom: Upload + Logout */}
                <div className="px-3 py-3 border-t border-gray-100 flex flex-col gap-1.5">
                    <button
                        onClick={() => { setIsDiscrepancyView(true); setDocTypeFilter('all'); setDocStateFilter('all'); }}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${
                            isDiscrepancyView
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        Discrepancias
                    </button>
                    {isEditor && (
                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 active:scale-95 transition-all border border-gray-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Subir documento
                        </button>
                    )}
                    {auth.isAuthenticated && (
                        <button
                            onClick={() => void auth.signoutRedirect()}
                            className="w-full flex items-center justify-center gap-2 py-1.5 text-gray-400 text-[10px] font-medium uppercase tracking-widest hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-3 h-3" />
                            Cerrar sesión
                        </button>
                    )}
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* ── KPI STRIP — hidden in discrepancy view ── */}
                {!isDiscrepancyView && (
                <header className="flex-shrink-0 flex items-center gap-1 px-5 py-2.5 bg-gray-50 border-b border-gray-200 z-10 relative">
                    {docTypeFilter !== 'all' ? (
                        <>
                            {/* Doc-filter KPIs */}
                            {[
                                { label: 'Total',      value: activeStats.total,    num: 'text-gray-500'    },
                                { label: 'Vigentes',   value: activeStats.ok,       num: 'text-emerald-600'  },
                                { label: 'Por Vencer', value: activeStats.warning,  num: 'text-amber-500'    },
                                { label: 'Crítico',    value: activeStats.critical, num: 'text-rose-500'     },
                            ].map(kpi => (
                                <div key={kpi.label} className="flex flex-col items-start px-4 py-1.5 min-w-[68px]">
                                    <span className={`text-2xl font-medium tabular-nums leading-none ${kpi.num}`}>{kpi.value ?? '…'}</span>
                                    <span className="text-[9px] font-medium uppercase tracking-widest mt-0.5 text-gray-400">{kpi.label}</span>
                                </div>
                            ))}

                            {/* Right side: breadcrumb + exit */}
                            <div className="ml-auto flex items-center gap-3">
                                {/* Breadcrumb */}
                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span>Panel</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    <span className="font-medium text-gray-600">{DOC_LABELS[docTypeFilter] || docTypeFilter}</span>
                                </div>
                                <div className="w-px h-5 bg-gray-200" />
                                {/* Exit button */}
                                <button
                                    onClick={() => { setDocTypeFilter('all'); setDocStateFilter('all'); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-gray-100 text-gray-500 text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all active:scale-95"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                    Volver al panel
                                </button>
                            </div>
                        </>
                    ) : (
                        [
                            { key: 'all',      label: 'Total',    value: stats.total,    num: 'text-gray-500',   activeBg: 'bg-gray-100'  },
                            { key: 'ok',       label: 'Vigentes', value: stats.ok,       num: 'text-emerald-600', activeBg: 'bg-emerald-50' },
                            { key: 'warning',  label: 'Alerta',   value: stats.warning,  num: 'text-amber-500',   activeBg: 'bg-amber-50'   },
                            { key: 'critical', label: 'Crítico',  value: stats.critical, num: 'text-rose-500',    activeBg: 'bg-rose-50'    },
                        ].map(kpi => {
                            const active = statusFilter === kpi.key;
                            return (
                                <button
                                    key={kpi.key}
                                    onClick={() => setStatusFilter(kpi.key)}
                                    className={`flex flex-col items-start px-4 py-1.5 rounded-md transition-all duration-150 min-w-[68px] ${
                                        active ? kpi.activeBg : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <span className={`text-2xl font-medium tabular-nums leading-none ${kpi.num} ${active ? '' : 'opacity-40'}`}>{kpi.value}</span>
                                    <span className={`text-[9px] font-medium uppercase tracking-widest mt-0.5 ${active ? 'text-gray-500' : 'text-gray-400 opacity-50'}`}>{kpi.label}</span>
                                </button>
                            );
                        })
                    )}
                </header>
                )}


                {/* MAIN LIST VIEW (DATA TABLE) or DOC FILTER VIEW or DISCREPANCY VIEW */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {isDiscrepancyView ? (
                        <DiscrepancyView
                            onClose={() => setIsDiscrepancyView(false)}
                            vehicles={safeVehicles}
                        />
                    ) : docTypeFilter !== 'all' ? (
                        <DocFilterView
                            docType={docTypeFilter}
                            docStateFilter={docStateFilter}
                            onClearFilter={() => { setDocTypeFilter('all'); setDocStateFilter('all'); }}
                        />
                    ) : (
                    <div className="flex-1 w-full flex flex-col overflow-hidden relative bg-white">

                        {/* SCROLL MINIMAL INDICATOR */}
                        <div
                            className={`absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center px-4 py-2 rounded-md transition-all duration-300 ease-out z-30 pointer-events-none shadow-sm ${isScrolling && currentScrolledId ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-4 scale-95'}`}
                            style={{
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                            }}
                        >
                            <span className="text-sm font-medium text-white tracking-widest">{currentScrolledId}</span>
                        </div>

                        <div
                            className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar"
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                        >
                            <table className="w-full text-sm text-left relative border-collapse">
                                <thead className="sticky top-0 z-20 bg-gray-100 text-gray-400 uppercase text-[11px] font-medium tracking-wider border-b border-gray-200">
                                    <tr>
                                        <th className="px-5 py-2.5 w-28 border-b border-gray-200">
                                            <span className="inline-flex items-center">ID Vh.<SortBtn col="id" /></span>
                                        </th>
                                        <th className="px-4 py-2.5 w-36 border-b border-gray-200">
                                            <span className="inline-flex items-center">UN (Plaza)<SortBtn col="un" /></span>
                                        </th>
                                        <th className="px-4 py-2.5 w-32 border-b border-gray-200">
                                            <span className="inline-flex items-center">Sistema SOL<SortBtn col="sysStatus" /></span>
                                        </th>

                                        <th className="px-5 py-2.5 min-w-[180px] border-b border-gray-200">Análisis</th>
                                        <th className="px-5 py-2.5 border-b border-gray-200">Vigencias</th>
                                        <th className="pl-5 pr-8 py-2.5 w-20 text-right border-b border-gray-200">Acción</th>
                                    </tr>
                                </thead>

                                {isLoadingFleet ? (
                                    <tbody className="divide-y divide-gray-100 ">
                                        {[...Array(12)].map((_, i) => (
                                            <tr key={i} className="animate-pulse bg-white ">
                                                <td className="px-5 py-4"><div className="h-5 bg-gray-200 rounded w-16"></div></td>
                                                <td className="px-4 py-4"><div className="h-6 bg-gray-100 rounded w-20"></div></td>
                                                <td className="px-4 py-4"><div className="h-6 bg-indigo-50 rounded w-24"></div></td>

                                                <td className="px-5 py-4"><div className="flex gap-2"><div className="w-6 h-6 bg-gray-200 rounded-full"></div><div className="w-6 h-6 bg-gray-200 rounded-full"></div></div></td>
                                                <td className="px-5 py-4">
                                                    <div className="flex gap-2">
                                                        <div className="h-5 bg-rose-100 rounded w-20"></div>
                                                        <div className="h-5 bg-rose-100 rounded w-16"></div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4"><div className="h-6 bg-amber-50 rounded w-48"></div></td>
                                                <td className="pl-5 pr-8 py-4 text-right"><div className="w-8 h-8 bg-gray-100 rounded-full ml-auto"></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                ) : (
                                    <tbody className="divide-y divide-gray-100 ">
                                        {filteredVehicles.map((vehicle) => {
                                            const isExpanded = selectedVehicle === vehicle.id;

                                            const validDocs = vehicle.availableDocs || [];
                                            const missingList = vehicle.missingDocs || [];
                                            const expiringList = vehicle.expiringDocs || [];

                                            const allInvolvedDocNames = [
                                                ...validDocs.map(d => typeof d === 'string' ? d : d.doc_type || 'Doc'),
                                                ...missingList.map(str => extractDocName(str)),
                                                ...expiringList.map(str => extractDocName(str))
                                            ];
                                            const uniqueDocNames = [...new Set(allInvolvedDocNames)].sort((a, b) => a.localeCompare(b));

                                            return (
                                                <React.Fragment key={vehicle.id}>
                                                    {/* MAIN ROW */}
                                                    <tr
                                                        id={`row-${vehicle.id}`}
                                                        className={`group transition-all duration-200 cursor-pointer scroll-mt-12
 ${isExpanded ? 'bg-blue-50/40 shadow-[inset_2px_0_0_0_rgba(59,130,246,1)] border-b-blue-100 ' : 'hover:bg-gray-50 border-transparent '}`}
                                                        onClick={() => handleRowClick(vehicle.id)}
                                                    >
                                                        <td className="px-5 py-2.5 align-middle">
                                                            <span className="font-medium text-gray-800 text-[14px]">{vehicle.id}</span>
                                                        </td>

                                                        <td className="px-4 py-2.5 align-middle">
                                                            <span className="text-gray-600 text-xs font-medium">{vehicle.un}</span>
                                                        </td>

                                                        <td className="px-4 py-2.5 align-middle">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 text-xs font-medium">{vehicle.sysStatus}</span>
                                                        </td>



                                                        <td className="px-5 py-2.5 align-top">
                                                            <div className="flex flex-nowrap gap-2 items-center pt-0.5">
                                                                {uniqueDocNames.map((docName, idx) => {
                                                                    const inValid    = validDocs.some(d => (typeof d === 'string' ? d : d.doc_type) === docName);
                                                                    const expiryEntry = expiringList.find(e => extractDocName(e) === docName);
                                                                    const isAvailable = inValid || !!expiryEntry;
                                                                    let docSt = 'ok';
                                                                    if (!isAvailable) {
                                                                        docSt = 'missing';
                                                                    } else if (expiryEntry) {
                                                                        const parsed = parseExpirationString(expiryEntry);
                                                                        docSt = parsed.isExpired ? 'critical' : 'warning';
                                                                    }
                                                                    return (
                                                                        <div key={idx} title={formatTitle(docName)} className="transition-transform hover:scale-110">
                                                                            {renderDocIcon(docName, isAvailable, docSt)}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {uniqueDocNames.length === 0 && <span className="text-gray-400 italic text-[11px] font-medium">Vacío</span>}
                                                            </div>
                                                        </td>

                                                        <td className="px-5 py-2 align-top">
                                                            <div className="flex flex-col gap-1 w-full max-w-[280px] pt-0.5">
                                                                {missingList.map((issue, idx) => (
                                                                    <div key={`m-${idx}`} className="flex items-center justify-between text-xs font-medium px-2.5 py-1 rounded border border-l-2 shadow-sm bg-white border-gray-200 border-l-gray-400 w-full max-w-[280px]">
                                                                        <span className="truncate mr-3 text-gray-600 opacity-90" title={formatTitle(issue)}>{formatTitle(issue)}</span>
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide whitespace-nowrap bg-gray-100 text-gray-600">Falta</span>
                                                                    </div>
                                                                ))}
                                                                {expiringList.map((issue, idx) => {
                                                                    const parsed = parseExpirationString(issue);
                                                                    return (
                                                                        <div key={`e-${idx}`} className={`flex items-center justify-between text-xs font-medium px-2.5 py-1 rounded border border-l-2 shadow-sm ${parsed.isExpired ? 'text-rose-800 bg-white border-rose-200 border-l-rose-500' : 'text-amber-800 bg-white border-amber-200 border-l-amber-500'}`}>
                                                                            <span className="truncate mr-3 opacity-90" title={parsed.docName}>{parsed.docName}</span>
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${parsed.isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                                {parsed.timeText}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {missingList.length === 0 && expiringList.length === 0 && (
                                                                    <span className="text-gray-300 italic text-[11px]">-</span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="pl-5 pr-8 py-2 text-right align-middle">
                                                            <button
                                                                onClick={(e) => handleDownloadVehicle(e, vehicle.id)}
                                                                disabled={!!downloadingVehicleId}
                                                                title={`Descargar todos los docs de ${vehicle.id}`}
                                                                className={`p-2 rounded-full transition-all duration-200 ${downloadingVehicleId === vehicle.id
                                                                    ? 'bg-emerald-100 text-emerald-500 cursor-wait'
                                                                    : downloadingVehicleId
                                                                        ? 'text-gray-200 cursor-not-allowed'
                                                                        : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 group-hover:bg-white group-hover:shadow-sm'
                                                                    }`}
                                                            >
                                                                {downloadingVehicleId === vehicle.id ? (
                                                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {/* EXPANDED CONTENT ROW */}
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={6} className="p-0 border-b border-gray-200 bg-gray-50/30">
                                                                <div className="animate-in slide-in-from-top-2 fade-in duration-150 ease-out border-l-2 border-l-blue-500 overflow-hidden">
                                                                    <div className="px-4 pb-5 pt-2 md:px-6 md:pb-6 md:pt-2">
                                                                        <ExpandedVehicleRow
                                                                            vehicle={vehicle}
                                                                            activeTab={activeTab}
                                                                            onTabChange={setActiveTab}
                                                                            onClose={() => setSelectedVehicle(null)}
                                                                            autoOpenReviewTrigger={autoOpenReviewTrigger}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}

                                        {filteredVehicles.length === 0 && !isLoadingFleet && (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-16 text-center text-gray-400 text-base bg-white border-t border-gray-100">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-4xl mb-3 opacity-50">📋</span>
                                                        <span className="font-medium text-gray-600 ">No hay vehículos que coincidan</span>
                                                        <span className="text-sm text-gray-400 mt-1">Intenta con otros filtros o término de búsqueda</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                    )}
                </main>
            </div>

            {/* UPLOAD MODAL */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[200] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`bg-white rounded-md shadow-sm w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 transition-all ${uploadPhase === 'completed' ? 'bg-emerald-500 scale-105' : ''}`}>

                        {uploadPhase === 'completed' ? (
                            <div className="p-14 min-h-[320px] flex flex-col items-center justify-center text-center animate-in zoom-in spin-in-12 duration-500">
                                {/* SUCCESS SCREEN */}
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-8 shadow-sm">
                                    <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h2 className="text-2xl font-medium text-white mb-2">¡Subida Exitosa!</h2>
                                <p className="text-emerald-100 font-medium mb-8">
                                    {uploadFiles.length > 1 ? `${uploadFiles.length} documentos guardados correctamente.` : 'El documento ha sido guardado.'}
                                </p>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={handleStartValidation}
                                        className="px-5 py-2.5 bg-white text-emerald-600 rounded-md font-medium hover:bg-emerald-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                        Validar Documentos
                                    </button>
                                    <button 
                                        onClick={resetUploadModal}
                                        className="px-5 py-2.5 bg-emerald-600/50 text-white rounded-md font-medium hover:bg-emerald-600/70 active:scale-95 transition-all border border-emerald-400/30"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        ) : uploadPhase === 'uploading' ? (
                            <div className="flex flex-col min-h-[320px]">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                                    <h3 className="text-sm font-medium text-gray-800">Procesando documentos...</h3>
                                </div>
                                <div className="p-6 flex flex-col gap-3 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                    {uploadFiles.map((f) => {
                                        const fs = fileStatuses[f.name] || { status: 'processing', docType: '' };
                                        const isDone = fs.status === 'completed';
                                        const isError = ['error', 'unclassified', 'no_result'].includes(fs.status);
                                        const isClassified = fs.status === 'classified';
                                        return (
                                            <div key={f.name} className={`flex items-center gap-3 p-3 rounded-md border transition-all duration-300 ${isDone ? 'bg-emerald-50 border-emerald-200' :
                                                isError ? 'bg-rose-50 border-rose-200' :
                                                    'bg-gray-50 border-gray-200'
                                                }`}>
                                                {/* Status icon */}
                                                <div className="flex-shrink-0">
                                                    {isDone ? (
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                        </div>
                                                    ) : isError ? (
                                                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                                                            <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* File info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 truncate" title={f.name}>{f.name}</p>
                                                    <p className={`text-[11px] font-medium mt-0.5 ${isDone ? 'text-emerald-600' :
                                                        isError ? 'text-rose-600' :
                                                            isClassified ? 'text-blue-600' :
                                                                'text-gray-400'
                                                        }`}>
                                                        {isDone ? `✓ ${formatTitle(fs.docType) || 'Completado'}` :
                                                            isError ? `Error: ${fs.errorMsg || 'Error al procesar'}` :
                                                                isClassified ? `Identificado: ${formatTitle(fs.docType)}` :
                                                                    'Analizando...'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleGlobalUpload} className="w-full flex flex-col">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-600"></div> Subir Documentos
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={resetUploadModal}
                                        className="text-gray-400 hover:text-gray-600 p-1 text-2xl leading-none transition-colors"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="p-10 pb-12 flex flex-col gap-7 min-h-[260px]">

                                    {uploadPhase === 'error' && (
                                        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center gap-2 animate-in shake duration-300">
                                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>{uploadErrorMsg === "'unknown'" ? 'No se pudo identificar el tipo de documento.' : uploadErrorMsg}</span>
                                        </div>
                                    )}

                                    <div className="relative">
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">ID del Vehículo</label>
                                        <input
                                            type="text"
                                            value={uploadVehicleId}
                                            onChange={(e) => { setUploadVehicleId(e.target.value); setIsIdDropdownOpen(true); }}
                                            onFocus={() => setIsIdDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsIdDropdownOpen(false), 200)}
                                            placeholder="Escribe o selecciona ID..."
                                            className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium text-gray-700 disabled:opacity-50"
                                            required
                                            disabled={uploadPhase !== 'idle' && uploadPhase !== 'error'}
                                            autoComplete="off"
                                        />
                                        {isIdDropdownOpen && (uploadPhase === 'idle' || uploadPhase === 'error') && allVehicleIds.filter(id => id.toLowerCase().includes(uploadVehicleId.toLowerCase())).length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-sm max-h-[156px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                                                {allVehicleIds
                                                    .filter(id => id.toLowerCase().includes(uploadVehicleId.toLowerCase()))
                                                    .map(id => (
                                                        <div
                                                            key={id}
                                                            className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer font-medium border-b border-gray-50 last:border-0 transition-colors"
                                                            onClick={() => { setUploadVehicleId(id); setIsIdDropdownOpen(false); }}
                                                        >
                                                            {id}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Puedes escribir uno nuevo si no existe.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Archivos</label>

                                        {/* Hidden file input */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            className="hidden"
                                            disabled={uploadPhase !== 'idle' && uploadPhase !== 'error'}
                                            onChange={(e) => {
                                                const newFiles = Array.from(e.target.files || []);
                                                setUploadFiles(prev => {
                                                    const existing = new Set(prev.map(f => f.name));
                                                    return [...prev, ...newFiles.filter(f => !existing.has(f.name))];
                                                });
                                                e.target.value = '';
                                            }}
                                        />

                                        {/* Side-by-side layout */}
                                        <div className="flex gap-4 h-[220px]">

                                            {/* LEFT: Drop zone */}
                                            <div
                                                onClick={() => uploadPhase === 'idle' || uploadPhase === 'error' ? fileInputRef.current?.click() : null}
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    if (uploadPhase !== 'idle' && uploadPhase !== 'error') return;
                                                    const dropped = Array.from(e.dataTransfer.files).filter(f =>
                                                        /\.(pdf|png|jpg|jpeg)$/i.test(f.name)
                                                    );
                                                    setUploadFiles(prev => {
                                                        const existing = new Set(prev.map(f => f.name));
                                                        return [...prev, ...dropped.filter(f => !existing.has(f.name))];
                                                    });
                                                }}
                                                className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 cursor-pointer transition-all duration-200 select-none
                                                    ${isDragging
                                                        ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                                                        : uploadFiles.length > 0
                                                            ? 'border-blue-300 bg-blue-50/40'
                                                            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                                                    }
                                                    ${(uploadPhase !== 'idle' && uploadPhase !== 'error') ? 'opacity-50 cursor-not-allowed' : ''}
                                                `}
                                            >
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isDragging ? 'bg-blue-600 scale-110' : 'bg-gray-200'}`}>
                                                    <svg className={`w-6 h-6 transition-colors duration-200 ${isDragging ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                </div>
                                                <p className="text-sm font-medium text-gray-600 text-center leading-snug">
                                                    {isDragging ? 'Suelta aquí' : 'Arrastra o haz clic'}
                                                </p>
                                                <p className="text-[11px] text-gray-400 font-medium text-center">PDF · PNG · JPG</p>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px bg-gray-200 self-stretch" />

                                            {/* RIGHT: File list */}
                                            <div className="flex-1 flex flex-col overflow-hidden">
                                                {uploadFiles.length === 0 ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-gray-300">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <p className="text-xs font-medium">Sin archivos aún</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                                            <span className="text-xs font-medium text-gray-500">{uploadFiles.length} archivo{uploadFiles.length > 1 ? 's' : ''}</span>
                                                            <button type="button" onClick={() => setUploadFiles([])} className="text-[10px] font-medium text-rose-400 hover:text-rose-600 transition-colors">
                                                                Quitar todos
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1">
                                                            {uploadFiles.map((f, idx) => {
                                                                const ext = f.name.split('.').pop().toLowerCase();
                                                                const isPdf = ext === 'pdf';
                                                                return (
                                                                    <div key={f.name} className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm group transition-all duration-150 hover:border-rose-200 hover:bg-rose-50/30 flex-shrink-0">
                                                                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isPdf ? 'bg-rose-100' : 'bg-sky-100'}`}>
                                                                            <span className={`text-[9px] font-medium uppercase ${isPdf ? 'text-rose-600' : 'text-sky-600'}`}>{ext}</span>
                                                                        </div>
                                                                        <span className="text-xs font-medium text-gray-700 truncate flex-1" title={f.name}>{f.name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setUploadFiles(prev => prev.filter((_, i) => i !== idx)); }}
                                                                            className="w-4 h-4 text-gray-300 hover:text-rose-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={resetUploadModal}
                                        disabled={uploadPhase !== 'idle' && uploadPhase !== 'error'}
                                        className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!uploadFiles.length || !uploadVehicleId || (uploadPhase !== 'idle' && uploadPhase !== 'error')}
                                        className={`px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium shadow-sm flex items-center gap-2 ${(!uploadFiles.length || !uploadVehicleId || (uploadPhase !== 'idle' && uploadPhase !== 'error')) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow-sm active:scale-95 transition-all'}`}
                                    >
                                        SUBIR {uploadFiles.length > 1 ? `${uploadFiles.length} DOCS` : 'DOCUMENTO'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {isSessionReviewOpen && (
                <DocumentReviewModal 
                    docs={sessionReviewDocs} 
                    onClose={() => {
                        setIsSessionReviewOpen(false);
                        resetUploadModal();
                    }}
                    onSuccess={() => {
                        queryClientInstance.invalidateQueries({ queryKey: ['fleet_merged'] });
                    }}
                />
            )}
        </div>
    );
}
