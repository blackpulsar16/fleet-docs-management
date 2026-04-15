import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, ArrowUp, ArrowDown, LogOut } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import ExpandedVehicleRow from './ExpandedVehicleRow.jsx';
import { formatTitle, extractDocName, parseExpirationString, renderDocIcon } from '../utils/helpers.jsx';
import { FLEET_API, SOL_API, AI_API } from '../config/api.js';

export default function FleetDashboard() {
    const queryClientInstance = useQueryClient();
    const auth = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [unFilter, setUnFilter] = useState('all');
    const [sysStatusFilter, setSysStatusFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'id', dir: 'asc' });

    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [activeTab, setActiveTab] = useState('docs');

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

    const { data: vehicles = [], isLoading: isLoadingFleet } = useQuery({
        queryKey: ['fleet_merged'],
        queryFn: async () => {
            const [fleetRes, plazasRes, estatusRes] = await Promise.all([
                fetch(`${FLEET_API}/fleet`).catch(() => null),
                fetch(`${SOL_API}/sol/plazas`).catch(() => null),
                fetch(`${SOL_API}/sol/estatus`).catch(() => null)
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

    useEffect(() => {
        setSelectedVehicle(null);
        setActiveTab('docs');
    }, [searchTerm, statusFilter, unFilter, sysStatusFilter, sortConfig]);

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

    const allVehicleIds = useMemo(() => Array.from(new Set(safeVehicles.map(v => v.id))), [safeVehicles]);

    const resetUploadModal = () => {
        setIsUploadModalOpen(false);
        setUploadVehicleId('');
        setUploadFiles([]);
        setUploadPhase('idle');
        setFileStatuses({});
        setUploadErrorMsg('');
        uploadHasErrorsRef.current = false;
    };

    const handleGlobalUpload = async (e) => {
        e.preventDefault();
        if (!uploadFiles.length || !uploadVehicleId) return;

        setUploadPhase('uploading');
        setUploadErrorMsg('');
        // Initialize all files as 'processing'
        const initialStatuses = {};
        uploadFiles.forEach(f => { initialStatuses[f.name] = { status: 'processing', docType: '' }; });
        setFileStatuses(initialStatuses);

        const formData = new FormData();
        uploadFiles.forEach(f => formData.append('files', f));

        try {
            const response = await fetch(`${AI_API}/ai/${uploadVehicleId}`, {
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
                        if (uploadHasErrorsRef.current) {
                            // Hubo archivos con error — NO mostrar pantalla verde,
                            // el usuario ya ve los errores por archivo en la lista.
                            setUploadPhase('error');
                            setUploadErrorMsg('Uno o más documentos no pudieron clasificarse. Revisa los archivos marcados en rojo.');
                        } else {
                            setUploadPhase('completed');
                            setTimeout(resetUploadModal, 3000);
                        }
                        return;
                    }

                    if (data.file) {
                        if (data.status === 'error') {
                            uploadHasErrorsRef.current = true;
                        }
                        setFileStatuses(prev => ({
                            ...prev,
                            [data.file]: {
                                status: data.status,
                                docType: data.document_type || prev[data.file]?.docType || '',
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
    };

    const filteredVehicles = useMemo(() => {
        const statusOrder = { critical: 0, warning: 1, ok: 2 };
        return baseFilteredVehicles
            .filter(v => statusFilter === 'all' || v.status === statusFilter)
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
    }, [baseFilteredVehicles, statusFilter, sortConfig]);

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
            const response = await fetch(`${FLEET_API}/vehicles/${vehicleId}/documents/download-all`);
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
                    : 'text-slate-500 hover:text-slate-300'
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
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans antialiased relative transition-colors duration-300">
            <div className="flex-1 flex flex-col min-w-0">

                {/* COMPACT HEADER SECTION */}
                <header className="bg-white px-5 py-3 z-10 border-b border-slate-200 flex-shrink-0 shadow-sm transition-colors duration-300">
                    <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4">

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6 w-full xl:w-auto">
                            <div className="flex items-center gap-4">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight sm:border-r border-slate-200 sm:pr-6 whitespace-nowrap">
                                    Gestión Flota
                                </h1>
                            </div>

                            {/* STATUS CARDS KPIs */}
                            <div className="flex flex-wrap gap-4 sm:gap-5 justify-start">
                                <div className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${statusFilter === 'all' ? 'opacity-100 scale-110 drop-shadow-md' : 'opacity-60 hover:opacity-100 hover:-translate-y-0.5'}`} onClick={() => setStatusFilter('all')}>
                                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1.5 ${statusFilter === 'all' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600 '}`}>
                                        <span className="text-sm font-black">{stats.total}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'all' ? 'text-slate-800 ' : 'text-slate-500 '}`}>Total</span>
                                </div>

                                <div className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${statusFilter === 'ok' ? 'opacity-100 scale-110 drop-shadow-md' : 'opacity-60 hover:opacity-100 hover:-translate-y-0.5'}`} onClick={() => setStatusFilter('ok')}>
                                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1.5 ${statusFilter === 'ok' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-600 '}`}>
                                        <span className="text-sm font-black">{stats.ok}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'ok' ? 'text-emerald-700 ' : 'text-slate-500 '}`}>Vigentes</span>
                                </div>

                                <div className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${statusFilter === 'warning' ? 'opacity-100 scale-110 drop-shadow-md' : 'opacity-60 hover:opacity-100 hover:-translate-y-0.5'}`} onClick={() => setStatusFilter('warning')}>
                                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1.5 ${statusFilter === 'warning' ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-200 bg-amber-50 text-amber-600 '}`}>
                                        <span className="text-sm font-black">{stats.warning}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'warning' ? 'text-amber-600 ' : 'text-slate-500 '}`}>Alerta</span>
                                </div>

                                <div className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${statusFilter === 'critical' ? 'opacity-100 scale-110 drop-shadow-md' : 'opacity-60 hover:opacity-100 hover:-translate-y-0.5'}`} onClick={() => setStatusFilter('critical')}>
                                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1.5 ${statusFilter === 'critical' ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-200 bg-rose-50 text-rose-600 '}`}>
                                        <span className="text-sm font-black">{stats.critical}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'critical' ? 'text-rose-700 ' : 'text-slate-500 '}`}>Crítico</span>
                                </div>
                            </div>
                        </div>

                        {/* FILTERS & SEARCH */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar ID o modelo..."
                                    className="w-56 pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-slate-700 placeholder-slate-400 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ">
                                        &times;
                                    </button>
                                )}
                            </div>

                            <select
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer font-medium text-slate-600 shadow-sm hover:border-slate-300 transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                                value={unFilter}
                                onChange={(e) => setUnFilter(e.target.value)}
                            >
                                <option value="all">Plaza: Todas</option>
                                {uniqueUNs.map(un => (
                                    <option key={un} value={un}>UN: {un}</option>
                                ))}
                            </select>

                            <select
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer font-medium text-slate-600 shadow-sm hover:border-slate-300 transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                                value={sysStatusFilter}
                                onChange={(e) => setSysStatusFilter(e.target.value)}
                            >
                                <option value="all">Estatus SOL: Todos</option>
                                {uniqueSysStatuses.map(status => (
                                    <option key={status} value={status}>SOL: {status}</option>
                                ))}
                            </select>

                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                SUBIR DOC
                            </button>

                            {/* LOGOUT BUTTON */}
                            {auth.isAuthenticated && (
                                <button
                                    onClick={() => void auth.signoutRedirect()}
                                    className="ml-2 px-3 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold shadow-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center gap-2"
                                    title="Cerrar sesión"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            )}

                        </div>

                    </div>
                </header>

                {/* MAIN LIST VIEW (DATA TABLE) */}
                <main className="flex-1 flex flex-col overflow-hidden relative">

                    <div className="flex-1 w-full flex flex-col overflow-hidden relative transition-colors duration-300 bg-white">

                        {/* SCROLL MINIMAL INDICATOR */}
                        <div
                            className={`absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center px-4 py-2 rounded-lg transition-all duration-300 ease-out z-30 pointer-events-none shadow-lg ${isScrolling && currentScrolledId ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-4 scale-95'}`}
                            style={{
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                            }}
                        >
                            <span className="text-sm font-bold text-white tracking-widest">{currentScrolledId}</span>
                        </div>

                        <div
                            className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar"
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                        >
                            <table className="w-full text-sm text-left relative border-collapse">
                                <thead className="sticky top-0 z-20 bg-slate-800 text-white uppercase text-xs font-bold tracking-wider shadow-md">
                                    <tr>
                                        <th className="px-5 py-4 w-28 rounded-tl-lg border-b border-slate-800">
                                            <span className="inline-flex items-center">ID Vh.<SortBtn col="id" /></span>
                                        </th>
                                        <th className="px-4 py-4 w-36 border-b border-slate-800">
                                            <span className="inline-flex items-center">UN (Plaza)<SortBtn col="un" /></span>
                                        </th>
                                        <th className="px-4 py-4 w-32 border-b border-slate-800">
                                            <span className="inline-flex items-center">Sistema SOL<SortBtn col="sysStatus" /></span>
                                        </th>
                                        <th className="px-4 py-4 w-28 border-b border-slate-800">
                                            <span className="inline-flex items-center">Docs<SortBtn col="status" /></span>
                                        </th>
                                        <th className="px-5 py-4 min-w-[180px] border-b border-slate-800">Análisis</th>
                                        <th className="px-5 py-4 w-[24%] border-b border-slate-800">Faltantes</th>
                                        <th className="px-5 py-4 w-[28%] border-b border-slate-800">Vigencias</th>
                                        <th className="pl-5 pr-8 py-4 w-20 text-right rounded-tr-lg border-b border-slate-800">Acción</th>
                                    </tr>
                                </thead>

                                {isLoadingFleet ? (
                                    <tbody className="divide-y divide-slate-100 ">
                                        {[...Array(12)].map((_, i) => (
                                            <tr key={i} className="animate-pulse bg-white ">
                                                <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded w-16"></div></td>
                                                <td className="px-4 py-4"><div className="h-6 bg-slate-100 rounded w-20"></div></td>
                                                <td className="px-4 py-4"><div className="h-6 bg-indigo-50 rounded w-24"></div></td>
                                                <td className="px-4 py-4"><div className="h-6 bg-slate-200 rounded w-14"></div></td>
                                                <td className="px-5 py-4"><div className="flex gap-2"><div className="w-6 h-6 bg-slate-200 rounded-full"></div><div className="w-6 h-6 bg-slate-200 rounded-full"></div></div></td>
                                                <td className="px-5 py-4">
                                                    <div className="flex gap-2">
                                                        <div className="h-5 bg-rose-100 rounded w-20"></div>
                                                        <div className="h-5 bg-rose-100 rounded w-16"></div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4"><div className="h-6 bg-amber-50 rounded w-48"></div></td>
                                                <td className="pl-5 pr-8 py-4 text-right"><div className="w-8 h-8 bg-slate-100 rounded-full ml-auto"></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                ) : (
                                    <tbody className="divide-y divide-slate-100 ">
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
 ${isExpanded ? 'bg-blue-50/60 shadow-[inset_4px_0_0_0_rgba(59,130,246,1)] border-b-blue-100 ' : 'hover:bg-slate-50 border-transparent hover:border-slate-200 '}`}
                                                        onClick={() => handleRowClick(vehicle.id)}
                                                    >
                                                        <td className="px-5 py-4 align-top">
                                                            <span className="font-extrabold text-slate-800 text-[15px]">{vehicle.id}</span>
                                                        </td>

                                                        <td className="px-4 py-4 align-top">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200/60 text-xs font-bold uppercase tracking-wide">
                                                                {vehicle.un}
                                                            </span>
                                                        </td>

                                                        <td className="px-4 py-4 align-top">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold uppercase tracking-wide">
                                                                {vehicle.sysStatus}
                                                            </span>
                                                        </td>

                                                        <td className="px-4 py-4 align-top">
                                                            {vehicle.status === 'critical' && <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-black bg-rose-100/80 text-rose-700 border border-rose-200 uppercase tracking-widest shadow-sm">CRÍTICO</span>}
                                                            {vehicle.status === 'warning' && <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-black bg-amber-100/80 text-amber-700 border border-amber-200 uppercase tracking-widest shadow-sm">ALERTA</span>}
                                                            {vehicle.status === 'ok' && <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-black bg-emerald-100/80 text-emerald-700 border border-emerald-200 uppercase tracking-widest shadow-sm">OK</span>}
                                                        </td>

                                                        <td className="px-5 py-4 align-top">
                                                            <div className="flex flex-nowrap gap-2 items-center mt-1">
                                                                {uniqueDocNames.map((docName, idx) => {
                                                                    const isAvailable = validDocs.some(d => (typeof d === 'string' ? d : d.doc_type) === docName);
                                                                    return (
                                                                        <div key={idx} title={formatTitle(docName)} className="transition-transform hover:scale-110">
                                                                            {renderDocIcon(docName, isAvailable)}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {uniqueDocNames.length === 0 && <span className="text-slate-400 italic text-[11px] font-medium">Vacío</span>}
                                                            </div>
                                                        </td>

                                                        <td className="px-5 py-3 align-top">
                                                            {missingList.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                                    {missingList.map((issue, idx) => (
                                                                        <div key={idx} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-rose-700/90 bg-white px-2 py-0.5 rounded border border-rose-200/80 w-fit max-w-full truncate shadow-sm transition-transform hover:scale-105" title={formatTitle(issue)}>
                                                                            {formatTitle(issue)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 italic text-[11px] mt-1 inline-block">-</span>
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-3 align-top">
                                                            {expiringList.length > 0 ? (
                                                                <div className="flex flex-col gap-1 w-full max-w-[240px]">
                                                                    {expiringList.map((issue, idx) => {
                                                                        const parsed = parseExpirationString(issue);
                                                                        return (
                                                                            <div key={idx} className={`flex items-center justify-between text-xs font-bold px-2.5 py-1 rounded border border-l-2 shadow-sm ${parsed.isExpired ? 'text-rose-800 bg-white border-rose-200 border-l-rose-500 ' : 'text-amber-800 bg-white border-amber-200 border-l-amber-500 '}`}>
                                                                                <span className="truncate mr-3 opacity-90" title={parsed.docName}>{parsed.docName}</span>
                                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${parsed.isExpired ? 'bg-rose-100 text-rose-800 ' : 'bg-amber-100 text-amber-800 '}`}>
                                                                                    {parsed.timeText}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 italic text-[11px] mt-1 inline-block">-</span>
                                                            )}
                                                        </td>

                                                        <td className="pl-5 pr-8 py-4 text-right align-middle">
                                                            <button
                                                                onClick={(e) => handleDownloadVehicle(e, vehicle.id)}
                                                                disabled={!!downloadingVehicleId}
                                                                title={`Descargar todos los docs de ${vehicle.id}`}
                                                                className={`p-2 rounded-full transition-all duration-200 ${downloadingVehicleId === vehicle.id
                                                                    ? 'bg-emerald-100 text-emerald-500 cursor-wait'
                                                                    : downloadingVehicleId
                                                                        ? 'text-slate-200 cursor-not-allowed'
                                                                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 group-hover:bg-white group-hover:shadow-sm'
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
                                                            <td colSpan={8} className="p-0 border-b border-slate-200 bg-slate-50/50 ">
                                                                <div className="animate-in slide-in-from-top-2 fade-in duration-150 ease-out border-l-4 border-l-blue-600 overflow-hidden shadow-inner">
                                                                    <div className="px-4 pb-5 pt-2 md:px-6 md:pb-6 md:pt-2">
                                                                        <ExpandedVehicleRow
                                                                            vehicle={vehicle}
                                                                            activeTab={activeTab}
                                                                            onTabChange={setActiveTab}
                                                                            onClose={() => setSelectedVehicle(null)}
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
                                                <td colSpan={8} className="px-5 py-16 text-center text-slate-500 text-base bg-white rounded-b-xl border-t border-slate-100 ">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-4xl mb-3 opacity-50">📋</span>
                                                        <span className="font-semibold text-slate-600 ">No hay vehículos que coincidan</span>
                                                        <span className="text-sm text-slate-400 mt-1">Intenta con otros filtros o término de búsqueda</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                </main>
            </div>

            {/* UPLOAD MODAL */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 transition-all ${uploadPhase === 'completed' ? 'bg-emerald-500 scale-105' : ''}`}>

                        {uploadPhase === 'completed' ? (
                            <div className="p-14 min-h-[320px] flex flex-col items-center justify-center text-center animate-in zoom-in spin-in-12 duration-500">
                                {/* SUCCESS SCREEN */}
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-8 shadow-lg">
                                    <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2">¡Subida Exitosa!</h2>
                                <p className="text-emerald-100 font-medium">
                                    {uploadFiles.length > 1 ? `${uploadFiles.length} documentos guardados correctamente.` : 'El documento ha sido guardado.'}
                                </p>
                            </div>
                        ) : uploadPhase === 'uploading' ? (
                            <div className="flex flex-col min-h-[320px]">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                                    <h3 className="text-sm font-black text-slate-800 tracking-wide">Procesando documentos...</h3>
                                </div>
                                <div className="p-6 flex flex-col gap-3 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                    {uploadFiles.map((f) => {
                                        const fs = fileStatuses[f.name] || { status: 'processing', docType: '' };
                                        const isDone = fs.status === 'completed';
                                        const isError = fs.status === 'error';
                                        const isClassified = fs.status === 'classified';
                                        return (
                                            <div key={f.name} className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isDone ? 'bg-emerald-50 border-emerald-200' :
                                                isError ? 'bg-rose-50 border-rose-200' :
                                                    'bg-slate-50 border-slate-200'
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
                                                    <p className="text-sm font-bold text-slate-700 truncate" title={f.name}>{f.name}</p>
                                                    <p className={`text-[11px] font-semibold mt-0.5 ${isDone ? 'text-emerald-600' :
                                                        isError ? 'text-rose-600' :
                                                            isClassified ? 'text-blue-600' :
                                                                'text-slate-400'
                                                        }`}>
                                                        {isDone ? `✓ ${formatTitle(fs.docType) || 'Completado'}` :
                                                            isError ? 'Error al procesar' :
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
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="text-sm font-black text-slate-800 tracking-wide flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-600"></div> Subir Documentos
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={resetUploadModal}
                                        className="text-slate-400 hover:text-slate-600 p-1 text-2xl leading-none transition-colors"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="p-10 pb-12 flex flex-col gap-7 min-h-[260px]">

                                    {uploadPhase === 'error' && (
                                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center gap-2 animate-in shake duration-300">
                                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>{uploadErrorMsg === "'unknown'" ? 'No se pudo identificar el tipo de documento.' : uploadErrorMsg}</span>
                                        </div>
                                    )}

                                    <div className="relative">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ID del Vehículo</label>
                                        <input
                                            type="text"
                                            value={uploadVehicleId}
                                            onChange={(e) => { setUploadVehicleId(e.target.value); setIsIdDropdownOpen(true); }}
                                            onFocus={() => setIsIdDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsIdDropdownOpen(false), 200)}
                                            placeholder="Escribe o selecciona ID..."
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium text-slate-700 disabled:opacity-50"
                                            required
                                            disabled={uploadPhase !== 'idle' && uploadPhase !== 'error'}
                                            autoComplete="off"
                                        />
                                        {isIdDropdownOpen && (uploadPhase === 'idle' || uploadPhase === 'error') && allVehicleIds.filter(id => id.toLowerCase().includes(uploadVehicleId.toLowerCase())).length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[156px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                                                {allVehicleIds
                                                    .filter(id => id.toLowerCase().includes(uploadVehicleId.toLowerCase()))
                                                    .map(id => (
                                                        <div
                                                            key={id}
                                                            className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer font-medium border-b border-slate-50 last:border-0 transition-colors"
                                                            onClick={() => { setUploadVehicleId(id); setIsIdDropdownOpen(false); }}
                                                        >
                                                            {id}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Puedes escribir uno nuevo si no existe.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Archivos</label>

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
                                                className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 cursor-pointer transition-all duration-200 select-none
                                                    ${
                                                        isDragging
                                                            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                                                            : uploadFiles.length > 0
                                                            ? 'border-blue-300 bg-blue-50/40'
                                                            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
                                                    }
                                                    ${(uploadPhase !== 'idle' && uploadPhase !== 'error') ? 'opacity-50 cursor-not-allowed' : ''}
                                                `}
                                            >
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isDragging ? 'bg-blue-600 scale-110' : 'bg-slate-200'}`}>
                                                    <svg className={`w-6 h-6 transition-colors duration-200 ${isDragging ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                </div>
                                                <p className="text-sm font-bold text-slate-600 text-center leading-snug">
                                                    {isDragging ? 'Suelta aquí' : 'Arrastra o haz clic'}
                                                </p>
                                                <p className="text-[11px] text-slate-400 font-medium text-center">PDF · PNG · JPG</p>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px bg-slate-200 self-stretch" />

                                            {/* RIGHT: File list */}
                                            <div className="flex-1 flex flex-col overflow-hidden">
                                                {uploadFiles.length === 0 ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-300">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <p className="text-xs font-semibold">Sin archivos aún</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                                            <span className="text-xs font-bold text-slate-500">{uploadFiles.length} archivo{uploadFiles.length > 1 ? 's' : ''}</span>
                                                            <button type="button" onClick={() => setUploadFiles([])} className="text-[10px] font-bold text-rose-400 hover:text-rose-600 transition-colors">
                                                                Quitar todos
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1">
                                                            {uploadFiles.map((f, idx) => {
                                                                const ext = f.name.split('.').pop().toLowerCase();
                                                                const isPdf = ext === 'pdf';
                                                                return (
                                                                    <div key={f.name} className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm group transition-all duration-150 hover:border-rose-200 hover:bg-rose-50/30 flex-shrink-0">
                                                                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isPdf ? 'bg-rose-100' : 'bg-sky-100'}`}>
                                                                            <span className={`text-[9px] font-black uppercase ${isPdf ? 'text-rose-600' : 'text-sky-600'}`}>{ext}</span>
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-slate-700 truncate flex-1" title={f.name}>{f.name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setUploadFiles(prev => prev.filter((_, i) => i !== idx)); }}
                                                                            className="w-4 h-4 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
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
                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={resetUploadModal}
                                        disabled={uploadPhase !== 'idle' && uploadPhase !== 'error'}
                                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!uploadFiles.length || !uploadVehicleId || (uploadPhase !== 'idle' && uploadPhase !== 'error')}
                                        className={`px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 ${(!uploadFiles.length || !uploadVehicleId || (uploadPhase !== 'idle' && uploadPhase !== 'error')) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow-md active:scale-95 transition-all'}`}
                                    >
                                        SUBIR {uploadFiles.length > 1 ? `${uploadFiles.length} DOCS` : 'DOCUMENTO'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
