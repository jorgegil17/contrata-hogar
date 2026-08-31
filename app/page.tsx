'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { jsPDF } from 'jspdf';

type Contract = {
  startDate: string;
  weeklyHours: number;
  hourlyRate: number;
  workDays: string;
  workAddress: string;
  schedule: string;
  paymentDay: number;
  extraPays: 'prorated' | 'separate';
  trialPeriod: number;
  hasTrialPeriod: boolean;
  vacationDays: number;
  signaturePlace: string;
  signatureDate: string;
  employerName: string;
  employerDni: string;
  employerAddress: string;
  employeeName: string;
  employeeDni: string;
  employeeNss: string;
  employeeAddress: string;
};
const defaults: Contract = { startDate: '2026-02-15', weeklyHours: 12, hourlyRate: 10, workDays: 'Lunes, miércoles y viernes', workAddress: '', schedule: 'Lunes, miércoles y viernes, de 10:00 a 14:00', paymentDay: 31, extraPays: 'prorated', trialPeriod: 0, hasTrialPeriod: false, vacationDays: 30, signaturePlace: '', signatureDate: new Date().toISOString().slice(0, 10), employerName: '', employerDni: '', employerAddress: '', employeeName: '', employeeDni: '', employeeNss: '', employeeAddress: '' };
const euro = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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
    if (!draft.startDate || draft.weeklyHours <= 0 || draft.hourlyRate <= 0 || !draft.workDays.trim() || !draft.workAddress.trim() || !draft.schedule.trim() || !draft.signaturePlace.trim() || !draft.signatureDate || !draft.employerName || !draft.employerDni || !draft.employerAddress || !draft.employeeName || !draft.employeeDni || !draft.employeeNss || !draft.employeeAddress) { notify('Completa todos los datos necesarios del contrato'); return; }
    setContract(draft);
    window.localStorage.setItem('contrata-hogar-contract', JSON.stringify(draft));
    setContractWizard(false);
    notify('Borrador del contrato guardado en este dispositivo');
  };
  const print = (document: 'payroll' | 'contract') => { flushSync(() => setPrintDoc(document)); window.print(); };
  const generateContract = () => {
    if (!partiesComplete || !contract.workAddress || !contract.schedule || !contract.signaturePlace || !contract.signatureDate) { openContractWizard(); notify('Completa primero todos los datos del contrato'); return; }
    const monthlySalary = +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const left = 20;
    const width = 170;
    let y = 18;
    const pageHeader = (page: number) => { if (page > 1) { pdf.addPage(); y = 18; } pdf.setTextColor(8, 125, 189).setFont('helvetica', 'bold').setFontSize(8).text('CONTRATA HOGAR · CONTRATO INDEFINIDO A TIEMPO PARCIAL', left, y); pdf.setFont('helvetica', 'normal').setTextColor(120, 137, 145).text(`Página ${page} de 3`, left + width, y, { align: 'right' }); y += 10; };
    const heading = (title: string) => { pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(23, 36, 43).text(title, left, y); y += 3; pdf.setDrawColor(204, 217, 223).line(left, y, left + width, y); y += 7; };
    const paragraph = (text: string) => { pdf.setFont('helvetica', 'normal').setFontSize(8.7).setTextColor(45, 59, 66); const lines = pdf.splitTextToSize(text, width); pdf.text(lines, left, y); y += lines.length * 4.3 + 3; };
    pageHeader(1);
    pdf.setTextColor(23, 36, 43).setFont('helvetica', 'bold').setFontSize(20).text('Contrato de trabajo indefinido', left, y);
    y += 8; pdf.setTextColor(8, 125, 189).setFontSize(15).text('a tiempo parcial', left, y);
    y += 7; pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(95, 117, 128).text('Servicio del hogar familiar · Régimen externo sin pernocta', left, y); y += 13;
    heading('1. Partes del contrato');
    const partyWidth = 81;
    pdf.setDrawColor(204, 217, 223).rect(left, y, partyWidth, 34).rect(left + 89, y, partyWidth, 34);
    pdf.setFontSize(9).setFont('helvetica', 'bold').text('Persona empleadora', left + 4, y + 6).text('Persona trabajadora', left + 93, y + 6);
    pdf.setFont('helvetica', 'normal').text(pdf.splitTextToSize(`${contract.employerName}\nDNI/NIE: ${contract.employerDni}\n${contract.employerAddress}`, partyWidth - 8), left + 4, y + 12).text(pdf.splitTextToSize(`${contract.employeeName}\nDNI/NIE: ${contract.employeeDni}\nN.º Seguridad Social: ${contract.employeeNss}\n${contract.employeeAddress}`, partyWidth - 8), left + 93, y + 12);
    y += 40;
    paragraph('Ambas partes se reconocen capacidad suficiente para formalizar el presente contrato de trabajo.');
    heading('2. Objeto del contrato');
    paragraph(`La persona trabajadora prestará servicios como empleada del hogar, realizando principalmente tareas ordinarias de limpieza y mantenimiento del domicilio familiar, así como otras tareas domésticas similares razonablemente vinculadas a dicha actividad. El servicio se prestará en ${contract.workAddress}, en régimen externo, sin residencia ni pernocta en el domicilio.`);
    heading('3. Duración');
    paragraph(`El contrato se concierta por tiempo indefinido y comenzará el ${formatDate(contract.startDate)}. ${contract.hasTrialPeriod ? `Se establece por escrito un periodo de prueba de ${contract.trialPeriod} días.` : 'No se establece periodo de prueba.'}`);
    heading('Resumen de condiciones principales');
    const rows = [['Jornada', `${contract.weeklyHours} horas semanales`], ['Horario', contract.schedule], ['Salario bruto mensual', euro(monthlySalary)], ['Salario bruto por hora', euro(contract.hourlyRate)], ['Pagas extraordinarias', 'Prorrateadas en 12 mensualidades'], ['Día habitual de pago', `Día ${contract.paymentDay}`]];
    pdf.setFontSize(8.5);
    rows.forEach(([label, value]) => { pdf.setFillColor(246, 249, 250).rect(left, y, 50, 9, 'F'); pdf.setDrawColor(218, 227, 232).rect(left, y, width, 9); pdf.setFont('helvetica', 'bold').text(label, left + 3, y + 6); pdf.setFont('helvetica', 'normal').text(value, left + 53, y + 6); y += 9; });

    pageHeader(2);
    heading('4. Jornada y horario');
    paragraph(`La jornada ordinaria será de ${contract.weeklyHours} horas semanales, distribuidas del siguiente modo: ${contract.schedule}. Cualquier modificación permanente del horario deberá acordarse entre ambas partes. No se pactan tiempos de presencia, pernoctas ni disponibilidad fuera de las horas indicadas.`);
    heading('5. Retribución');
    paragraph(`La persona trabajadora percibirá una retribución bruta de ${euro(monthlySalary)} mensuales, equivalente a ${euro(contract.hourlyRate)} brutos por hora para una jornada ordinaria de ${contract.weeklyHours} horas semanales, calculada sobre 52 semanas al año y prorrateada en 12 mensualidades.`);
    paragraph(`De la retribución bruta se deducirá la aportación a la Seguridad Social correspondiente a la persona trabajadora. La persona empleadora asumirá las cotizaciones a la Seguridad Social que legalmente le correspondan. El pago se realizará mensualmente mediante transferencia bancaria, habitualmente el día ${contract.paymentDay}, y se entregará el correspondiente recibo justificativo de salario.`);
    heading('6. Pagas extraordinarias');
    paragraph('Las partes acuerdan que las pagas extraordinarias legalmente previstas quedan prorrateadas en las 12 mensualidades.');
    heading('7. Vacaciones');
    paragraph('La persona trabajadora tendrá derecho a 30 días naturales de vacaciones por cada año completo trabajado, o a la parte proporcional si el periodo trabajado es inferior al año. Las fechas se fijarán de común acuerdo entre las partes y las vacaciones serán retribuidas conforme a la jornada y salario ordinarios pactados. Se recomienda dejar las fechas acordadas por escrito, incluido mediante correo electrónico o mensajería.');
    heading('8. Festivos y permisos');
    paragraph('La persona trabajadora tendrá derecho a los festivos, permisos y descansos establecidos en la legislación laboral vigente y en la normativa específica del servicio del hogar familiar. Si un día ordinario de trabajo coincide con festivo, se aplicará lo previsto en la normativa vigente.');

    pageHeader(3);
    heading('9. Seguridad Social');
    paragraph('La persona empleadora dará de alta a la persona trabajadora en el Sistema Especial para Empleados de Hogar del Régimen General de la Seguridad Social. La fecha de efectos del alta coincidirá con la fecha de inicio del contrato. La cotización se realizará conforme a la normativa vigente; la parte correspondiente a la persona trabajadora será deducida de su retribución bruta y la parte correspondiente a la persona empleadora será asumida por esta.');
    heading('10. Prevención y condiciones de trabajo');
    paragraph('La persona empleadora procurará que el trabajo se realice en condiciones adecuadas de seguridad y salud y proporcionará los medios y productos necesarios para realizar las tareas domésticas en condiciones seguras. La persona trabajadora se compromete a utilizar adecuadamente dichos medios y a comunicar cualquier situación que pueda suponer un riesgo.');
    heading('11. Confidencialidad');
    paragraph('La persona trabajadora se compromete a respetar la intimidad personal y familiar de las personas que residen en el domicilio y a mantener la confidencialidad sobre cualquier información personal o familiar conocida como consecuencia de su trabajo.');
    heading('12. Extinción del contrato');
    paragraph('La extinción de la relación laboral se regirá por el Estatuto de los Trabajadores, por el Real Decreto 1620/2011, por la normativa específica del servicio del hogar familiar y por las demás disposiciones legales vigentes en cada momento.');
    heading('13. Normativa aplicable');
    paragraph('En todo lo no previsto expresamente en este contrato será de aplicación la normativa reguladora de la relación laboral de carácter especial del servicio del hogar familiar, especialmente el Real Decreto 1620/2011, el Estatuto de los Trabajadores y demás legislación laboral y de Seguridad Social que resulte aplicable.');
    heading('14. Firma');
    paragraph(`Firmado en ${contract.signaturePlace}, el ${formatDate(contract.signatureDate)}.`);
    y += 13; pdf.setDrawColor(100, 115, 122).line(left, y, left + 65, y).line(left + 105, y, left + width, y); pdf.setFontSize(8).text('Firma de la persona empleadora', left, y + 5).text('Firma de la persona trabajadora', left + 105, y + 5);
    pdf.setFillColor(255, 247, 231).rect(left, 276, width, 8, 'F'); pdf.setFont('helvetica', 'bold').setTextColor(110, 91, 45).text('BORRADOR - Revisar antes de firmar o presentar.', left + 4, 281);
    pdf.save(`borrador-contrato-${contract.startDate}.pdf`);
    notify('Borrador descargado en PDF');
  };
  const generateManagementSheet = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const gross = +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2);
    const workerContribution = +(gross * .0637).toFixed(2);
    const estimatedEmployerContribution = +(gross * .30).toFixed(2);
    const rows = [['Salario bruto mensual', euro(gross)], ['Aportación trabajadora estimada', euro(workerContribution)], ['Neto estimado', euro(gross - workerContribution)], ['Cuota empleadora estimada', euro(estimatedEmployerContribution)], ['Coste familiar estimado', euro(gross + estimatedEmployerContribution)], ['Día habitual de pago', `Día ${contract.paymentDay}`], ['Fecha de alta prevista', formatDate(contract.startDate)], ['Fecha de baja', 'Sin registrar']];
    pdf.setTextColor(8, 125, 189).setFont('helvetica', 'bold').setFontSize(9).text('CONTRATA HOGAR · DOCUMENTO INTERNO', 20, 20);
    pdf.setTextColor(23, 36, 43).setFontSize(21).text('Ficha interna de gestión', 20, 32);
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(95, 117, 128).text('No forma parte del contrato firmado', 20, 39);
    let y = 52;
    rows.forEach(([label, value]) => { pdf.setFillColor(246, 249, 250).rect(20, y, 65, 10, 'F'); pdf.setDrawColor(218, 227, 232).rect(20, y, 170, 10); pdf.setFont('helvetica', 'bold').setTextColor(45, 59, 66).text(label, 24, y + 6.5); pdf.setFont('helvetica', 'normal').text(value, 90, y + 6.5); y += 10; });
    const register = (title: string, columns: string[]) => { y += 10; pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(23, 36, 43).text(title, 20, y); y += 5; const columnWidth = 170 / columns.length; columns.forEach((column, index) => { pdf.setFillColor(234, 247, 253).rect(20 + index * columnWidth, y, columnWidth, 9, 'F'); pdf.setFontSize(8).text(column, 23 + index * columnWidth, y + 6); }); y += 9; for (let row = 0; row < 3; row++) { pdf.setDrawColor(218, 227, 232).rect(20, y, 170, 10); y += 10; } };
    register('Registro de pagos mensuales', ['Mes', 'Importe', 'Fecha', 'Estado']);
    register('Vacaciones y festivos', ['Fecha / periodo', 'Tipo', 'Acuerdo / situación']);
    register('Documentos asociados', ['Documento', 'Fecha', 'Observaciones']);
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(110, 125, 132).text('Las cotizaciones son estimaciones orientativas y deben comprobarse con los datos vigentes de la Seguridad Social.', 20, 286);
    pdf.save(`ficha-interna-${contract.startDate}.pdf`);
    notify('Ficha interna descargada en PDF');
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
        <section className="contract-card" id="contrato"><div className="contract-icon">▧</div><div className="contract-copy"><span>CONTRATO Y GESTIÓN</span><h2>Contrato indefinido · Tiempo parcial</h2><p>{contract.weeklyHours.toLocaleString('es-ES')} horas semanales · {euro(contract.hourlyRate)}/hora · Inicio {formatDate(contract.startDate)}</p><div className="contract-checks"><span>{partiesComplete ? '✓ Datos de ambas partes completos' : '○ Faltan datos de las partes'}</span><span>⌁ Contrato y ficha interna separados</span></div></div><div className="contract-actions"><button onClick={openContractWizard}>Completar contrato</button><button className="primary" onClick={generateContract}>Generar contrato PDF</button><button onClick={generateManagementSheet}>Ficha interna PDF</button></div></section>
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
        {wizardStep === 2 && <div className="wizard-fields"><label>Fecha de inicio<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label><div className="field-row"><label>Horas semanales<input type="number" min="0.5" max="40" step="0.5" value={draft.weeklyHours} onChange={e => setDraft({ ...draft, weeklyHours: Number(e.target.value) })} /></label><label>Salario bruto por hora (€)<input type="number" min="0.01" step="0.01" value={draft.hourlyRate} onChange={e => setDraft({ ...draft, hourlyRate: Number(e.target.value) })} /></label></div><label>Domicilio donde se presta el servicio<input type="text" value={draft.workAddress} onChange={e => setDraft({ ...draft, workAddress: e.target.value })} placeholder="Calle, número, localidad" /></label><label>Distribución detallada de días y horas<input type="text" value={draft.schedule} onChange={e => setDraft({ ...draft, schedule: e.target.value })} placeholder="Ej.: lunes y jueves, de 10:00 a 13:00" /></label><div className="estimate"><span>Salario bruto mensual</span><strong>{euro(draft.hourlyRate * draft.weeklyHours * 52 / 12)}</strong><small>Salario/hora × horas semanales × 52 ÷ 12</small></div></div>}
        {wizardStep === 3 && <div className="wizard-fields"><div className="field-row"><label>Día habitual de pago<input type="number" min="1" max="31" value={draft.paymentDay} onChange={e => setDraft({ ...draft, paymentDay: Number(e.target.value) })} /></label><label>Periodo de prueba<select value={draft.hasTrialPeriod ? 'yes' : 'no'} onChange={e => setDraft({ ...draft, hasTrialPeriod: e.target.value === 'yes', trialPeriod: e.target.value === 'yes' ? Math.max(draft.trialPeriod, 1) : 0 })}><option value="no">No se establece</option><option value="yes">Sí se establece</option></select></label></div>{draft.hasTrialPeriod && <label>Duración del periodo de prueba (días)<input type="number" min="1" max="60" value={draft.trialPeriod} onChange={e => setDraft({ ...draft, trialPeriod: Number(e.target.value) })} /></label>}<label>Pagas extraordinarias<select value="prorated" disabled><option value="prorated">Prorrateadas en 12 mensualidades</option></select></label><div className="field-row"><label>Lugar de firma<input value={draft.signaturePlace} onChange={e => setDraft({ ...draft, signaturePlace: e.target.value })} placeholder="Ej.: Madrid" /></label><label>Fecha de firma<input type="date" value={draft.signatureDate} onChange={e => setDraft({ ...draft, signatureDate: e.target.value })} /></label></div><div className="info-box">Contrato indefinido a tiempo parcial, en régimen externo, sin pernocta ni tiempos de presencia. Si la relación ya existía, se recomienda no establecer un nuevo periodo de prueba.</div></div>}
        {wizardStep === 4 && <div className="review-grid"><div><span>Empleador</span><strong>{draft.employerName || 'Pendiente'}</strong></div><div><span>Persona trabajadora</span><strong>{draft.employeeName || 'Pendiente'}</strong></div><div><span>Fecha de inicio</span><strong>{formatDate(draft.startDate)}</strong></div><div><span>Jornada semanal</span><strong>{draft.weeklyHours} horas</strong></div><div><span>Salario bruto mensual</span><strong>{euro(draft.hourlyRate * draft.weeklyHours * 52 / 12)}</strong></div><div><span>Periodo de prueba</span><strong>{draft.hasTrialPeriod ? `${draft.trialPeriod} días` : 'No se establece'}</strong></div><p>Se generará un contrato de tres páginas. La ficha interna de gestión permanecerá separada y no formará parte del documento firmado.</p></div>}
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
