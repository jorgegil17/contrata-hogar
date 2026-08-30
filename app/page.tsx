'use client';
import { useMemo, useState } from 'react';

const euro=(n:number)=>n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
export default function Home(){
 const [salary,setSalary]=useState(520),[paid,setPaid]=useState(false),[toast,setToast]=useState('');
 const deduction=useMemo(()=>+(salary*.0637).toFixed(2),[salary]),net=salary-deduction;
 const notify=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(''),2600)};
 return <main className="shell">
  <aside className="sidebar"><a className="brand" href="#top"><b>C</b><span>cuida</span></a><nav><a className="active" href="#top"><i>⌂</i><span>Resumen</span></a><a href="#persona"><i>♙</i><span>Persona</span></a><a href="#docs"><i>▤</i><span>Documentos</span></a><a href="#tareas"><i>□</i><span>Calendario</span></a></nav><div className="sidebottom"><a href="#ajustes"><i>⚙</i><span>Ajustes</span></a><div className="profile"><b>JM</b><p>Jorge M.<small>Empleador</small></p></div></div></aside>
  <section className="workspace" id="top"><header><div><small>DOMINGO, 30 DE AGOSTO</small><h1>Buenos días, Jorge</h1></div><button className="help" onClick={()=>notify('Centro de ayuda: disponible en la siguiente versión')}>ⓘ Ayuda</button></header>
   <div className="content"><section className="hero"><div><label><i/> RELACIÓN LABORAL ACTIVA</label><h2>Todo está al día</h2><p>Tu próxima tarea es pagar la nómina de agosto.</p></div><div className="next"><span>Próximo pago</span><b>31 AGO</b><small>Mañana</small></div></section>
    <Title title="Este mes" action="Ver calendario →" onClick={()=>notify('Calendario abierto')}/>
    <div className="month"><article className={'pay '+(paid?'done':'')}><div className="cardtop"><b>€</b><span>{paid?'PAGADA':'PENDIENTE'}</span></div><p>Nómina de agosto</p><strong>{euro(net)}</strong><small>Neto estimado a transferir</small><div className="actions"><button className="primary" disabled={paid} onClick={()=>{setPaid(true);notify('Pago marcado como realizado')}}>{paid?'Pago registrado':'Marcar como pagada'}</button><button onClick={()=>window.print()}>Ver recibo</button></div></article>
     <article className="person" id="persona"><div className="personhead"><b>MR</b><p><strong>María R.</strong><small>Empleada del hogar · Contrato indefinido</small></p><button onClick={()=>notify('Edición de ficha: próxima versión')}>•••</button></div><dl><div><dt>Antigüedad</dt><dd>6 meses y 15 días<small>Alta: 15 feb 2026</small></dd></div><div><dt>Jornada</dt><dd>12 h / semana<small>Lunes, miércoles y viernes</small></dd></div><div><dt>Salario mensual</dt><dd><input aria-label="Salario mensual" type="number" value={salary} min="0" onChange={e=>setSalary(Number(e.target.value))}/> €<small>12 pagas · bruto</small></dd></div></dl></article></div>
    <Title title="Próximas tareas" note="2 pendientes"/><section className="tasks" id="tareas"><Task day="31" month="AGO" title="Pagar nómina de agosto" detail={`Transferencia a María R. · ${euro(net)}`} onClick={()=>notify('Recordatorio activado para mañana')}/><Task day="15" month="SEP" title="Revisar horas del mes" detail="Comprueba ausencias o cambios antes de cerrar la nómina." calm onClick={()=>notify('Recordatorio activado para el 15 de septiembre')}/></section>
    <section className="documents" id="docs"><Title title="Documentos recientes" action="Ver todos →" onClick={()=>notify('No hay más documentos en esta prueba')}/><div className="doc"><b>PDF</b><p><strong>Recibo de salarios · Julio 2026</strong><small>Generado el 31 jul · Pagado</small></p><button onClick={()=>notify('Documento de ejemplo')}>Descargar</button></div></section>
   </div>
  </section>
  <section className="receipt"><h1>Recibo individual justificativo del pago de salarios</h1><p><b>Periodo:</b> 1–31 de agosto de 2026</p><div className="parties"><p><b>Empleador</b><br/>Jorge M.</p><p><b>Persona trabajadora</b><br/>María R.</p></div><table><tbody><tr><td>Salario base</td><td>{euro(salary)}</td></tr><tr><td>Aportación trabajadora a la Seguridad Social (estimada)</td><td>− {euro(deduction)}</td></tr><tr><td><b>Líquido total a percibir</b></td><td><b>{euro(net)}</b></td></tr></tbody></table><small>Documento de prueba. Revisa las cuantías y deducciones aplicables antes de entregarlo.</small></section>
  {toast&&<div className="toast" role="status">✓ {toast}</div>}
 </main>
}
function Title({title,action,note,onClick}:{title:string,action?:string,note?:string,onClick?:()=>void}){return <div className="title"><h2>{title}</h2>{action?<button onClick={onClick}>{action}</button>:<span>{note}</span>}</div>}
function Task({day,month,title,detail,calm,onClick}:{day:string,month:string,title:string,detail:string,calm?:boolean,onClick:()=>void}){return <article><time className={calm?'calm':''}><b>{day}</b>{month}</time><p><strong>{title}</strong><small>{detail}</small></p><button onClick={onClick}>Recordarme</button></article>}
