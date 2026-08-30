'use client';

import { useEffect, useMemo, useState } from 'react';

type Contract = { startDate: string; weeklyHours: number; hourlyRate: number };
const defaults: Contract = { startDate: '2026-02-15', weeklyHours: 12, hourlyRate: 10 };
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
  const [paid, setPaid] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('contrata-hogar-contract');
    if (saved) {
      try { const parsed = JSON.parse(saved) as Contract; setContract(parsed); setDraft(parsed); } catch { /* ignore invalid local data */ }
    }
  }, []);

  const salary = useMemo(() => +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2), [contract]);
  const deduction = useMemo(() => +(salary * .0637).toFixed(2), [salary]);
  const net = salary - deduction;
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const openEditor = () => { setDraft(contract); setEditing(true); };
  const saveContract = () => {
    if (!draft.startDate || draft.weeklyHours <= 0 || draft.hourlyRate <= 0) return;
    setContract(draft);
    window.localStorage.setItem('contrata-hogar-contract', JSON.stringify(draft));
    setEditing(false);
    notify('Datos laborales guardados en este dispositivo');
  };

  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="Contrata Hogar, inicio"><b>C</b><span>Contrata Hogar</span></a>
      <nav><a className="active" href="#top"><i>⌂</i><span>Resumen</span></a><a href="#persona"><i>♙</i><span>Persona</span></a><a href="#docs"><i>▤</i><span>Documentos</span></a><a href="#tareas"><i>□</i><span>Calendario</span></a></nav>
      <div className="sidebottom"><a href="#ajustes"><i>⚙</i><span>Ajustes</span></a><div className="profile"><b>JM</b><p>Jorge M.<small>Empleador</small></p></div></div>
    </aside>

    <section className="workspace" id="top">
      <header><div><small>DOMINGO, 30 DE AGOSTO</small><h1>Buenos días, Jorge</h1></div><button className="help" onClick={() => notify('Centro de ayuda: disponible en la siguiente versión')}>ⓘ Ayuda</button></header>
      <div className="content">
        <section className="hero"><div><label><i /> RELACIÓN LABORAL ACTIVA</label><h2>Todo está al día</h2><p>Tu próxima tarea es pagar la nómina de agosto.</p></div><div className="next"><span>Próximo pago</span><b>31 AGO</b><small>Mañana</small></div></section>
        <Title title="Este mes" action="Ver calendario →" onClick={() => notify('Calendario abierto')} />
        <div className="month">
          <article className={'pay ' + (paid ? 'done' : '')}><div className="cardtop"><b>€</b><span>{paid ? 'PAGADA' : 'PENDIENTE'}</span></div><p>Nómina de agosto</p><strong>{euro(net)}</strong><small>Neto estimado a transferir</small><div className="actions"><button className="primary" disabled={paid} onClick={() => { setPaid(true); notify('Pago marcado como realizado'); }}>{paid ? 'Pago registrado' : 'Marcar como pagada'}</button><button onClick={() => window.print()}>Ver recibo</button></div></article>
          <article className="person" id="persona">
            <div className="personhead"><b>MR</b><p><strong>María R.</strong><small>Empleada del hogar · Contrato indefinido</small></p><button className="edit-link" onClick={openEditor}>Editar datos</button></div>
            <dl><div><dt>Antigüedad</dt><dd>{seniority(contract.startDate)}<small>Inicio: {formatDate(contract.startDate)}</small></dd></div><div><dt>Jornada</dt><dd>{contract.weeklyHours.toLocaleString('es-ES')} h / semana<small>Horario acordado</small></dd></div><div><dt>Salario por hora</dt><dd>{euro(contract.hourlyRate)}<small>{euro(salary)} brutos / mes estimados</small></dd></div></dl>
          </article>
        </div>
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

    <section className="receipt"><h1>Recibo individual justificativo del pago de salarios</h1><p><b>Periodo:</b> 1–31 de agosto de 2026</p><div className="parties"><p><b>Empleador</b><br />Jorge M.</p><p><b>Persona trabajadora</b><br />María R.</p></div><table><tbody><tr><td>Salario base estimado</td><td>{euro(salary)}</td></tr><tr><td>Aportación trabajadora a la Seguridad Social (estimada)</td><td>− {euro(deduction)}</td></tr><tr><td><b>Líquido total a percibir</b></td><td><b>{euro(net)}</b></td></tr></tbody></table><small>Documento de prueba. Revisa las cuantías y deducciones aplicables antes de entregarlo.</small></section>
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </main>;
}

function Title({ title, action, note, onClick }: { title: string; action?: string; note?: string; onClick?: () => void }) { return <div className="title"><h2>{title}</h2>{action ? <button onClick={onClick}>{action}</button> : <span>{note}</span>}</div>; }
function Task({ day, month, title, detail, calm, onClick }: { day: string; month: string; title: string; detail: string; calm?: boolean; onClick: () => void }) { return <article><time className={calm ? 'calm' : ''}><b>{day}</b>{month}</time><p><strong>{title}</strong><small>{detail}</small></p><button onClick={onClick}>Recordarme</button></article>; }
