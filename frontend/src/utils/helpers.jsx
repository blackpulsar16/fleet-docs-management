import React from 'react';
import { FileText, Shield, FileCheck, Flame, CreditCard } from 'lucide-react';

export const formatTitle = (str) => {
  if (!str || typeof str !== 'string') return String(str || '');

  const lowerStr = str.toLowerCase().replace(/_/g, ' ').trim();
  const translations = {
    'issue date': 'Fecha de Emisión',
    'expiration date': 'Fecha de Vencimiento',
    'effective date': 'Fecha Efectiva',
    'fecha vencimiento': 'Fecha de Vencimiento',
    'armoring company': 'Empresa Blindadora',
    'armor level': 'Nivel de Blindaje',
    'metal plate number': 'Placa Metálica',
    'location': 'Ubicación',
    'serial number': 'Número de Serie',
    'approved': 'Aprobado',
    'client name': 'Nombre del Cliente',
    'vehicle info': 'Info. Vehículo',
    'insurance company': 'Aseguradora',
    'policy': 'Póliza',
    'paragraph': 'Inciso',
    'uuid': 'UUID',
    'make': 'Marca',
    'version': 'Versión',
    'model': 'Modelo',
    'niv': 'NIV',
    'motor serial numer': 'Serie del Motor',
    'number cylinders': 'Cilindros',
    'vehicle id': 'Clave Vehicular',
    'name': 'Nombre',
    'is permanent': 'Permanente',
    'placa': 'Placa',
    'federal entity': 'Entidad Federativa',
    'use': 'Uso',
    'folio': 'Folio'
  };

  if (translations[lowerStr]) return translations[lowerStr];

  let formatted = str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

  formatted = formatted.replace(/Bill Make/i, 'Carta Factura');
  formatted = formatted.replace(/\bBill\b/i, 'Carta Factura');
  formatted = formatted.replace(/Tarjeta Circulacion Front/i, 'Tarjeta Circulación');
  formatted = formatted.replace(/Dictamen Gas/i, 'Dictamen de Gas');

  return formatted;
};

export const extractDocName = (str) => {
  if (!str) return "";
  return str.split(' expired')[0].split(' expires')[0].trim();
};

export const parseExpirationString = (str) => {
  const lowerStr = str.toLowerCase();
  let docName = str;
  let timeText = '';
  let isExpired = true;

  if (lowerStr.includes('expired')) {
    const parts = str.split(/ expired /i);
    docName = formatTitle(parts[0]);
    timeText = `Hace ${parts[1].replace(/ days ago/i, '').trim()} días`;
    isExpired = true;
  } else if (lowerStr.includes('expires in')) {
    const parts = str.split(/ expires in /i);
    docName = formatTitle(parts[0]);
    timeText = `En ${parts[1].replace(/ days/i, '').trim()} días`;
    isExpired = false;
  } else {
    docName = formatTitle(str);
  }

  return { docName, timeText, isExpired };
};

export const renderDocIcon = (docType, isValid, docStatus) => {
  const typeStr = String(docType).toLowerCase();
  let colorClass;
  if (!isValid) {
    colorClass = "text-gray-300";         // faltante
  } else if (docStatus === 'critical') {
    colorClass = "text-rose-500";          // vencido
  } else if (docStatus === 'warning') {
    colorClass = "text-amber-500";         // por vencer
  } else {
    colorClass = "text-emerald-500";       // vigente
  }
  const props = { size: 18, className: colorClass, strokeWidth: 2.5 };

  if (typeStr.includes('bill') || typeStr.includes('factura')) return <FileText {...props} />;
  if (typeStr.includes('blindaje')) return <Shield {...props} />;
  if (typeStr.includes('seguro')) return <FileCheck {...props} />;
  if (typeStr.includes('gas')) return <Flame {...props} />;
  if (typeStr.includes('tarjeta')) return <CreditCard {...props} />;

  return <FileText {...props} />;
};

export const formatSpecValue = (val) => {
  let str = String(val === null || val === undefined ? 'N/A' : val);
  str = str.replace(/SADECV/gi, ' SA DE CV');
  str = str.replace(/COMERCIALIZADORA/gi, 'COMERCIALIZADORA ');
  return str.replace(/\s+/g, ' ').trim();
};

export const getDocStatus = (doc) => {
  if (!doc || !doc.data) return 'ok';
  const data = doc.data;

  let targetDateStr = data.expiration_date || data.effective_date || data.fecha_vencimiento;

  if (!targetDateStr && data.issue_date && doc.doc_type === 'dictamen_gas') {
    const parts = String(data.issue_date).split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      targetDateStr = `${d}/${m}/${parseInt(y) + 1}`;
    }
  }

  if (!targetDateStr) return 'ok';

  try {
    const parts = String(targetDateStr).split('/');
    if (parts.length !== 3) return 'ok';
    const [day, month, year] = parts;
    const expDate = new Date(year, month - 1, day);
    const today = new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'critical';
    if (diffDays <= 30) return 'warning';
    return 'ok';
  } catch (e) { return 'ok'; }
};
