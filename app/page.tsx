'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

type Contract = {
  startDate: string;
  weeklyHours: number;
  hourlyRate: number;
  workDays: string;
  paymentDay: number;
  extraPays: 'prorated' | 'separate';
  trialPeriod: number;
  vacationDays: number;
  employerName: string;
  employerDni: string;
  employerAddress: string;
  employeeName: string;
  employeeDni: string;
  employeeNss: string;
  employeeAddress: string;
};
const defaults: Contract = { startDate: '2026-02-15', weeklyHours: 12, hourlyRate: 10, workDays: 'Lunes, miércoles y viernes', paymentDay: 31, extraPays: 'prorated', trialPeriod: 30, vacationDays: 30, employerName: '', employerDni: '', employerAddress: '', employeeName: '', employeeDni: '', employeeNss: '', employeeAddress: '' };
const euro = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`)).replace('.', '');
}

function seniority(value: string) {
  const start = new Date(`${value}T12:00:00`);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  return parts.join(' y ');
}

export default function Home() {
  const [contract, setContract] = useState<Contract>(defaults);
  const [draft, setDraft] = useState<Contract>(defaults);
  const [editing, setEditing] = useState(false);
  const [contractWizard, setContractWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [printDoc, setPrintDoc] = useState<'payroll' | 'contract'>('payroll');
  const [paid, setPaid] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('contrata-hogar-contract');
    if (saved) {
      try { const parsed = { ...defaults, ...JSON.parse(saved) } as Contract; setContract(parsed); setDraft(parsed); } catch { /* ignore invalid local data */ }
    }
  }, []);

  const salary = useMemo(() => +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2), [contract]);
  const deduction = useMemo(() => +(salary * .0637).toFixed(2), [salary]);
  const net = salary - deduction;
  const partiesComplete = Boolean(contract.employerName && contract.employerDni && contract.employerAddress && contract.employeeName && contract.employeeDni && contract.employeeNss && contract.employeeAddress);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const openEditor = () => { setDraft(contract); setEditing(true); };
  const saveContract = () => {
    if (!draft.startDate || draft.weeklyHours <= 0 || draft.hourlyRate <= 0) return;
    setContract(draft);
    window.localStorage.setItem('contrata-hogar-contract', JSON.stringify(draft));
    setEditing(false);
    notify('Datos laborales guardados en este dispositivo');
  };
  const openContractWizard = () => { setDraft(contract); setWizardStep(1); setContractWizard(true); };
  const saveWizard = () => {
    if (!draft.startDate || draft.weeklyHours <= 0 || draft.hourlyRate <= 0 || !draft.workDays.trim() || !draft.employerName || !draft.employerDni || !draft.employerAddress || !draft.employeeName || !draft.employeeDni || !draft.employeeNss || !draft.employeeAddress) return;
    setContract(draft);
    window.localStorage.setItem('contrata-hogar-contract', JSON.stringify(draft));
    setContractWizard(false);
    notify('Borrador del contrato guardado en este dispositivo');
  };
  const print = (document: 'payroll' | 'contract') => { flushSync(() => setPrintDoc(document)); window.print(); };
  const generateContract = () => {
    if (!partiesComplete) { openContractWizard(); notify('Completa primero los datos de ambas partes'); return; }
    const monthlySalary = +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2);
    const value = (text: string) => escapeHtml(text);
    const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Borrador de contrato</title><style>body{font-family:Arial,sans-serif;color:#17242b;max-width:780px;margin:40px auto;line-height:1.5}h1{color:#087dbd;font-size:26px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #ccd9df;padding-bottom:6px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px}.box{border:1px solid #ccd9df;padding:16px}table{width:100%;border-collapse:collapse}td{border:1px solid #ccd9df;padding:10px}td:first-child{font-weight:bold;width:34%}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.warning{margin-top:50px;padding:12px;background:#fff5dc;font-size:12px}</style></head><body><p>CONTRATO DE TRABAJO INDEFINIDO</p><h1>Servicio del hogar familiar</h1><p>Borrador generado por Contrata Hogar</p><h2>1. Partes del contrato</h2><div class="parties"><div class="box"><b>Persona empleadora</b><br>${value(contract.employerName)}<br>DNI/NIE: ${value(contract.employerDni)}<br>${value(contract.employerAddress)}</div><div class="box"><b>Persona trabajadora</b><br>${value(contract.employeeName)}<br>DNI/NIE: ${value(contract.employeeDni)}<br>N.º Seguridad Social: ${value(contract.employeeNss)}<br>${value(contract.employeeAddress)}</div></div><h2>2. Condiciones acordadas</h2><table><tr><td>Modalidad</td><td>Contrato indefinido a tiempo parcial</td></tr><tr><td>Fecha de inicio</td><td>${formatDate(contract.startDate)}</td></tr><tr><td>Jornada</td><td>${contract.weeklyHours} horas semanales</td></tr><tr><td>Distribución</td><td>${value(contract.workDays)}</td></tr><tr><td>Retribución</td><td>${euro(contract.hourlyRate)} por hora · ${euro(monthlySalary)} mensuales estimados</td></tr><tr><td>Pagas extraordinarias</td><td>${contract.extraPays === 'prorated' ? 'Prorrateadas en 12 mensualidades' : 'Dos pagas separadas'}</td></tr><tr><td>Vacaciones</td><td>${contract.vacationDays} días naturales al año</td></tr><tr><td>Periodo de prueba</td><td>${contract.trialPeriod} días</td></tr><tr><td>Pago habitual</td><td>Día ${contract.paymentDay} de cada mes</td></tr></table><p>No se acuerdan horas de presencia, pernoctas ni prestaciones salariales en especie. En lo no previsto se estará a la normativa vigente aplicable a la relación laboral especial del servicio del hogar familiar.</p><div class="signatures"><p>Firma de la persona empleadora</p><p>Firma de la persona trabajadora</p></div><p class="warning"><b>BORRADOR</b> — Revisa el documento antes de firmarlo o presentarlo.</p></body></html>`;
    const blob = new Blob(['\ufeff', documentHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `borrador-contrato-${contract.startDate}.doc`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Borrador descargado en formato Word');
  };

  return <main className={`shell print-${printDoc}`}>
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="Contrata Hogar, inicio"><b>C</b><span>Contrata Hogar</span></a>
      <nav><a className="active" href="#top"><i>⌂</i><span>Resumen</span></a><a href="#persona"><i>♙</i><span>Persona</span></a><a href="#contrato"><i>▧</i><span>Contrato</span></a><a href="#docs"><i>▤</i><span>Documentos</span></a><a href="#tareas"><i>□</i><span>Calendario</span></a></nav>
      <div className="sidebottom"><a href="#ajustes"><i>⚙</i><span>Ajustes</span></a><div className="profile"><b>{contract.employerName ? contract.employerName.slice(0, 2).toUpperCase() : 'EM'}</b><p>{contract.employerName || 'Empleador'}<small>Empleador</small></p></div></div>
    </aside>

    <section className="workspace" id="top">
      <header><div><small>DOMINGO, 30 DE AGOSTO</small><h1>Buenos días, Jorge</h1></div><button className="help" onClick={() => notify('Centro de ayuda: disponible en la siguiente versión')}>ⓘ Ayuda</button></header>
      <div className="content">
        <section className="hero"><div><label><i /> RELACIÓN LABORAL ACTIVA</label><h2>Todo está al día</h2><p>Tu próxima tarea es pagar la nómina de agosto.</p></div><div className="next"><span>Próximo pago</span><b>31 AGO</b><small>Mañana</small></div></section>
        <Title title="Este mes" action="Ver calendario →" onClick={() => notify('Calendario abierto')} />
        <div className="month">
          <article className={'pay ' + (paid ? 'done' : '')}><div className="cardtop"><b>€</b><span>{paid ? 'PAGADA' : 'PENDIENTE'}</span></div><p>Nómina de agosto</p><strong>{euro(net)}</strong><small>Neto estimado a transferir</small><div className="actions"><button className="primary" disabled={paid} onClick={() => { setPaid(true); notify('Pago marcado como realizado'); }}>{paid ? 'Pago registrado' : 'Marcar como pagada'}</button><button onClick={() => print('payroll')}>Ver recibo</button></div></article>
          <article className="person" id="persona">
            <div className="personhead"><b>{contract.employeeName ? contract.employeeName.slice(0, 2).toUpperCase() : 'TR'}</b><p><strong>{contract.employeeName || 'Persona trabajadora'}</strong><small>Empleada del hogar · Contrato indefinido</small></p><button className="edit-link" onClick={openEditor}>Editar datos</button></div>
            <dl><div><dt>Antigüedad</dt><dd>{seniority(contract.startDate)}<small>Inicio: {formatDate(contract.startDate)}</small></dd></div><div><dt>Jornada</dt><dd>{contract.weeklyHours.toLocaleString('es-ES')} h / semana<small>Horario acordado</small></dd></div><div><dt>Salario por hora</dt><dd>{euro(contract.hourlyRate)}<small>{euro(salary)} brutos / mes estimados</small></dd></div></dl>
          </article>
        </div>
        <section className="contract-card" id="contrato"><div className="contract-icon">▧</div><div className="contract-copy"><span>BORRADOR DE CONTRATO</span><h2>Contrato indefinido · Tiempo parcial</h2><p>{contract.weeklyHours.toLocaleString('es-ES')} horas semanales · {euro(contract.hourlyRate)}/hora · Inicio {formatDate(contract.startDate)}</p><div className="contract-checks"><span>{partiesComplete ? '✓ Datos de ambas partes completos' : '○ Faltan datos de las partes'}</span><span>⌁ Guardado en este navegador</span></div></div><div className="contract-actions"><button onClick={openContractWizard}>Completar contrato</button><button className="primary" onClick={generateContract}>Generar borrador</button></div></section>
        <Title title="Próximas tareas" note="2 pendientes" />
        <section className="tasks" id="tareas"><Task day="31" month="AGO" title="Pagar nómina de agosto" detail={`Transferencia a María R. · ${euro(net)}`} onClick={() => notify('Recordatorio activado para mañana')} /><Task day="15" month="SEP" title="Revisar horas del mes" detail="Comprueba ausencias o cambios antes de cerrar la nómina." calm onClick={() => notify('Recordatorio activado para el 15 de septiembre')} /></section>
        <section className="documents" id="docs"><Title title="Documentos recientes" action="Ver todos →" onClick={() => notify('No hay más documentos en esta prueba')} /><div className="doc"><b>PDF</b><p><strong>Recibo de salarios · Julio 2026</strong><small>Generado el 31 jul · Pagado</small></p><button onClick={() => notify('Documento de ejemplo')}>Descargar</button></div></section>
      </div>
    </section>

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(false)}>
      <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>CONDICIONES LABORALES</span><h2 id="edit-title">Editar contrato</h2></div><button aria-label="Cerrar" onClick={() => setEditing(false)}>×</button></div>
        <p className="modal-intro">Estos datos se guardan únicamente en este navegador y actualizan las estimaciones de la pantalla.</p>
        <label>Fecha de inicio del contrato<input type="date" value={draft.startDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label>
        <div className="field-row"><label>Horas semanales<input type="number" min="0.5" max="40" step="0.5" value={draft.weeklyHours} onChange={e => setDraft({ ...draft, weeklyHours: Number(e.target.value) })} /></label><label>Salario por hora (€)<input type="number" min="0.01" step="0.01" value={draft.hourlyRate} onChange={e => setDraft({ ...draft, hourlyRate: Number(e.target.value) })} /></label></div>
        <div className="estimate"><span>Salario mensual estimado</span><strong>{euro(draft.hourlyRate * draft.weeklyHours * 52 / 12)}</strong><small>Horas semanales × 52 semanas ÷ 12 meses</small></div>
        <div className="modal-actions"><button onClick={() => setEditing(false)}>Cancelar</button><button className="primary" onClick={saveContract}>Guardar cambios</button></div>
      </section>
    </div>}

    {contractWizard && <div className="modal-backdrop" role="presentation" onMouseDown={() => setContractWizard(false)}>
      <section className="edit-modal contract-wizard" role="dialog" aria-modal="true" aria-labelledby="contract-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>PASO {wizardStep} DE 4</span><h2 id="contract-title">{wizardStep === 1 ? 'Datos de las partes' : wizardStep === 2 ? 'Jornada y salario' : wizardStep === 3 ? 'Condiciones del contrato' : 'Revisar borrador'}</h2></div><button aria-label="Cerrar" onClick={() => setContractWizard(false)}>×</button></div>
        <div className="steps four"><i className="done" /><i className={wizardStep >= 2 ? 'done' : ''} /><i className={wizardStep >= 3 ? 'done' : ''} /><i className={wizardStep >= 4 ? 'done' : ''} /></div>
        {wizardStep === 1 && <div className="wizard-fields"><h3>Persona empleadora</h3><div className="field-row"><label>Nombre y apellidos<input value={draft.employerName} onChange={e => setDraft({ ...draft, employerName: e.target.value })} /></label><label>DNI/NIE<input value={draft.employerDni} onChange={e => setDraft({ ...draft, employerDni: e.target.value })} /></label></div><label>Domicilio<input value={draft.employerAddress} onChange={e => setDraft({ ...draft, employerAddress: e.target.value })} /></label><h3>Persona trabajadora</h3><div className="field-row"><label>Nombre y apellidos<input value={draft.employeeName} onChange={e => setDraft({ ...draft, employeeName: e.target.value })} /></label><label>DNI/NIE<input value={draft.employeeDni} onChange={e => setDraft({ ...draft, employeeDni: e.target.value })} /></label></div><label>Número de la Seguridad Social<input value={draft.employeeNss} onChange={e => setDraft({ ...draft, employeeNss: e.target.value })} /></label><label>Domicilio<input value={draft.employeeAddress} onChange={e => setDraft({ ...draft, employeeAddress: e.target.value })} /></label><div className="privacy-note">Datos guardados solo en este navegador. No se envían a una base de datos.</div></div>}
        {wizardStep === 2 && <div className="wizard-fields"><label>Fecha de inicio<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label><div className="field-row"><label>Horas semanales<input type="number" min="0.5" max="40" step="0.5" value={draft.weeklyHours} onChange={e => setDraft({ ...draft, weeklyHours: Number(e.target.value) })} /></label><label>Salario por hora (€)<input type="number" min="0.01" step="0.01" value={draft.hourlyRate} onChange={e => setDraft({ ...draft, hourlyRate: Number(e.target.value) })} /></label></div><label>Días de trabajo<input type="text" value={draft.workDays} onChange={e => setDraft({ ...draft, workDays: e.target.value })} /></label><div className="estimate"><span>Salario mensual estimado</span><strong>{euro(draft.hourlyRate * draft.weeklyHours * 52 / 12)}</strong><small>Estimación orientativa; debe validarse con la normativa aplicable.</small></div></div>}
        {wizardStep === 3 && <div className="wizard-fields"><div className="field-row"><label>Día habitual de pago<input type="number" min="1" max="31" value={draft.paymentDay} onChange={e => setDraft({ ...draft, paymentDay: Number(e.target.value) })} /></label><label>Periodo de prueba (días)<input type="number" min="0" max="60" value={draft.trialPeriod} onChange={e => setDraft({ ...draft, trialPeriod: Number(e.target.value) })} /></label></div><label>Pagas extraordinarias<select value={draft.extraPays} onChange={e => setDraft({ ...draft, extraPays: e.target.value as Contract['extraPays'] })}><option value="prorated">Prorrateadas en 12 mensualidades</option><option value="separate">Dos pagas separadas</option></select></label><label>Vacaciones anuales<input type="number" min="30" value={draft.vacationDays} onChange={e => setDraft({ ...draft, vacationDays: Number(e.target.value) })} /></label><div className="info-box">El borrador asumirá contrato indefinido a tiempo parcial, sin pernoctas, salario en especie ni horas de presencia.</div></div>}
        {wizardStep === 4 && <div className="review-grid"><div><span>Empleador</span><strong>{draft.employerName || 'Pendiente'}</strong></div><div><span>Persona trabajadora</span><strong>{draft.employeeName || 'Pendiente'}</strong></div><div><span>Fecha de inicio</span><strong>{formatDate(draft.startDate)}</strong></div><div><span>Jornada semanal</span><strong>{draft.weeklyHours} horas</strong></div><div><span>Salario por hora</span><strong>{euro(draft.hourlyRate)}</strong></div><div><span>Pagas extra</span><strong>{draft.extraPays === 'prorated' ? 'Prorrateadas' : 'Dos separadas'}</strong></div><p>Este documento será un borrador basado en los datos indicados. Revísalo antes de firmarlo o presentarlo.</p></div>}
        <div className="modal-actions wizard-actions">{wizardStep > 1 ? <button onClick={() => setWizardStep(wizardStep - 1)}>Atrás</button> : <button onClick={() => setContractWizard(false)}>Cancelar</button>}<button className="primary" onClick={() => wizardStep < 4 ? setWizardStep(wizardStep + 1) : saveWizard()}>{wizardStep < 4 ? 'Continuar' : 'Guardar borrador'}</button></div>
      </section>
    </div>}

    <section className="contract-print">
      <div className="print-header"><p>CONTRATO DE TRABAJO INDEFINIDO</p><h1>Servicio del hogar familiar</h1><span>Borrador generado por Contrata Hogar</span></div>
      <h2>1. Partes del contrato</h2><div className="parties"><p><b>Persona empleadora</b><br />{contract.employerName}<br />DNI/NIE: {contract.employerDni}<br />{contract.employerAddress}</p><p><b>Persona trabajadora</b><br />{contract.employeeName}<br />DNI/NIE: {contract.employeeDni}<br />N.º Seguridad Social: {contract.employeeNss}<br />{contract.employeeAddress}</p></div>
      <h2>2. Condiciones acordadas</h2><table><tbody><tr><td>Modalidad</td><td>Contrato indefinido a tiempo parcial</td></tr><tr><td>Fecha de inicio</td><td>{formatDate(contract.startDate)}</td></tr><tr><td>Jornada</td><td>{contract.weeklyHours} horas semanales</td></tr><tr><td>Distribución</td><td>{contract.workDays}</td></tr><tr><td>Retribución</td><td>{euro(contract.hourlyRate)} por hora · {euro(salary)} mensuales estimados</td></tr><tr><td>Pagas extraordinarias</td><td>{contract.extraPays === 'prorated' ? 'Prorrateadas en 12 mensualidades' : 'Dos pagas separadas'}</td></tr><tr><td>Vacaciones</td><td>{contract.vacationDays} días naturales al año</td></tr><tr><td>Periodo de prueba</td><td>{contract.trialPeriod} días</td></tr><tr><td>Pago habitual</td><td>Día {contract.paymentDay} de cada mes</td></tr></tbody></table>
      <p className="contract-clause">No se acuerdan horas de presencia, pernoctas ni prestaciones salariales en especie. En lo no previsto se estará a la normativa vigente aplicable a la relación laboral especial del servicio del hogar familiar.</p>
      <div className="signatures"><p>Firma de la persona empleadora</p><p>Firma de la persona trabajadora</p></div><p className="draft-warning">BORRADOR — Completa los datos identificativos y revisa el documento antes de firmarlo o presentarlo.</p>
    </section>

    <section className="receipt"><h1>Recibo individual justificativo del pago de salarios</h1><p><b>Periodo:</b> 1–31 de agosto de 2026</p><div className="parties"><p><b>Empleador</b><br />{contract.employerName || 'Pendiente'}</p><p><b>Persona trabajadora</b><br />{contract.employeeName || 'Pendiente'}</p></div><table><tbody><tr><td>Salario base estimado</td><td>{euro(salary)}</td></tr><tr><td>Aportación trabajadora a la Seguridad Social (estimada)</td><td>− {euro(deduction)}</td></tr><tr><td><b>Líquido total a percibir</b></td><td><b>{euro(net)}</b></td></tr></tbody></table><small>Documento de prueba. Revisa las cuantías y deducciones aplicables antes de entregarlo.</small></section>
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </main>;
}

function Title({ title, action, note, onClick }: { title: string; action?: string; note?: string; onClick?: () => void }) { return <div className="title"><h2>{title}</h2>{action ? <button onClick={onClick}>{action}</button> : <span>{note}</span>}</div>; }
function Task({ day, month, title, detail, calm, onClick }: { day: string; month: string; title: string; detail: string; calm?: boolean; onClick: () => void }) { return <article><time className={calm ? 'calm' : ''}><b>{day}</b>{month}</time><p><strong>{title}</strong><small>{detail}</small></p><button onClick={onClick}>Recordarme</button></article>; }
