'use client';

import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

type ScheduleEntry = { day: string; start: string; end: string };
type VacationPeriod = { id: string; start: string; end: string };
type MonthlyAdjustment = { endDate: string; additionalHours: number; holidayCompensation: number; sickLeaveDeduction: number; unpaidAbsenceDeduction: number; otherAdjustment: number; workerContributionOverride: number | null; employerContributionOverride: number | null; notes: string };
const emptyMonthlyAdjustment: MonthlyAdjustment = { endDate: '', additionalHours: 0, holidayCompensation: 0, sickLeaveDeduction: 0, unpaidAbsenceDeduction: 0, otherAdjustment: 0, workerContributionOverride: null, employerContributionOverride: null, notes: '' };
type Contract = {
  startDate: string;
  weeklyHours: number;
  hourlyRate: number;
  workDays: string;
  workAddress: string;
  schedule: string;
  scheduleEntries: ScheduleEntry[];
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
  employerMunicipality: string;
  employerPostcode: string;
  contributionAccount: string;
  employeeName: string;
  employeeDni: string;
  employeeNss: string;
  employeeAddress: string;
  employeeBirthDate: string;
  employeeNationality: string;
  employeeMunicipality: string;
  employeePostcode: string;
  workMunicipality: string;
  workPostcode: string;
  contributionCommonBenefit: 'general20' | 'largeFamily45' | 'none';
  unemploymentFogasaBonus: boolean;
  professionalContingencyRate: number;
};
const defaults: Contract = { startDate: '2026-02-15', weeklyHours: 6, hourlyRate: 12, workDays: 'Lunes y jueves', workAddress: '', schedule: '', scheduleEntries: [{ day: 'Lunes', start: '10:00', end: '13:00' }, { day: 'Jueves', start: '10:00', end: '13:00' }], paymentDay: 31, extraPays: 'prorated', trialPeriod: 0, hasTrialPeriod: false, vacationDays: 30, signaturePlace: '', signatureDate: '', employerName: '', employerDni: '', employerAddress: '', employerMunicipality: '', employerPostcode: '', contributionAccount: '', employeeName: '', employeeDni: '', employeeNss: '', employeeAddress: '', employeeBirthDate: '', employeeNationality: 'Española', employeeMunicipality: '', employeePostcode: '', workMunicipality: '', workPostcode: '', contributionCommonBenefit: 'general20', unemploymentFogasaBonus: true, professionalContingencyRate: 1.5 };
const euro = (n: number) => Number.isFinite(n) ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : 'Sin cálculo';
const scheduleHours = (entries: ScheduleEntry[]) => entries.reduce((total, entry) => { const [startHour, startMinute] = entry.start.split(':').map(Number); const [endHour, endMinute] = entry.end.split(':').map(Number); const minutes = endHour * 60 + endMinute - startHour * 60 - startMinute; return total + (minutes > 0 ? minutes / 60 : 0); }, 0);
const scheduleText = (entries: ScheduleEntry[]) => entries.map(entry => `${entry.day}, de ${entry.start} a ${entry.end}`).join('; ');
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const calendarDays = (start: string, end: string) => Math.floor((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1;
const contributionRules: Record<number, { brackets: number[][]; commonWorker: number; commonEmployer: number; unemploymentWorker: number; unemploymentEmployer: number; fogasaEmployer: number; meiWorker: number; meiEmployer: number }> = {
  2024: { brackets: [[306,284],[474,405],[644,559],[814,729],[986,901],[1153,1069],[1323,1323]], commonWorker:.047, commonEmployer:.236, unemploymentWorker:.0155, unemploymentEmployer:.055, fogasaEmployer:.002, meiWorker:.0012, meiEmployer:.0058 },
  2025: { brackets: [[319,296],[495,423],[672,584],[850,761],[1029,941],[1204,1116],[1381.20,1381.20]], commonWorker:.047, commonEmployer:.236, unemploymentWorker:.0155, unemploymentEmployer:.055, fogasaEmployer:.002, meiWorker:.0013, meiEmployer:.0067 },
  2026: { brackets: [[329,306],[510,436],[693,602],[877,785],[1061,970],[1242,1151],[1424.40,1424.40]], commonWorker:.047, commonEmployer:.236, unemploymentWorker:.0155, unemploymentEmployer:.055, fogasaEmployer:.002, meiWorker:.0015, meiEmployer:.0075 },
};
const socialSecurity = (grossSalary: number, year: number, commonBenefit: Contract['contributionCommonBenefit'], unemploymentFogasaBonus: boolean, professionalRate: number) => {
  const rules = contributionRules[year];
  if (!rules) return { supported: false, year, base: NaN, worker: NaN, employer: NaN, directDebit: NaN, net: NaN, totalCost: NaN };
  const base = rules.brackets.find(([limit]) => grossSalary <= limit)?.[1] ?? grossSalary;
  const commonReduction = commonBenefit === 'general20' ? .20 : commonBenefit === 'largeFamily45' ? .45 : 0;
  const bonus = unemploymentFogasaBonus ? .80 : 0;
  const worker = cents(base * rules.commonWorker) + cents(base * rules.unemploymentWorker) + cents(base * rules.meiWorker);
  const commonEmployer = cents(base * rules.commonEmployer) - cents(base * rules.commonEmployer * commonReduction);
  const unemploymentEmployer = cents(base * rules.unemploymentEmployer) - cents(base * rules.unemploymentEmployer * bonus);
  const fogasaEmployer = cents(base * rules.fogasaEmployer) - cents(base * rules.fogasaEmployer * bonus);
  const employer = cents(commonEmployer + unemploymentEmployer + fogasaEmployer + cents(base * rules.meiEmployer) + cents(base * professionalRate / 100));
  return { supported: true, year, base: cents(base), worker: cents(worker), employer, directDebit: cents(worker + employer), net: cents(grossSalary - worker), totalCost: cents(grossSalary + employer) };
};
const weekdayNumbers: Record<string, number> = { Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };
const monthLabel = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};
const monthWorkdays = (value: string, entries: ScheduleEntry[], startDate: string) => {
  const [year, month] = value.split('-').map(Number);
  const contractStart = new Date(`${startDate}T00:00:00`);
  return Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => new Date(year, month - 1, index + 1))
    .filter(date => date >= contractStart)
    .flatMap(date => entries.filter(entry => weekdayNumbers[entry.day] === date.getDay()).map((entry, entryIndex) => ({
      key: `${year}-${String(month).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${entryIndex}`,
      date,
      entry,
    })));
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`)).replace('.', '');
}

const officialDate = (value: string) => value ? value.split('-').reverse().join('/') : '';

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
  const [activeView, setActiveView] = useState<'home' | 'contract' | 'attendance' | 'annual' | 'documents'>('home');
  const [contract, setContract] = useState<Contract>(defaults);
  const [draft, setDraft] = useState<Contract>(defaults);
  const [contractWizard, setContractWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [attendanceMonth, setAttendanceMonth] = useState('2026-08');
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, 'scheduled' | 'completed' | 'sick' | 'vacation' | 'holiday'>>({});
  const [closedMonths, setClosedMonths] = useState<Record<string, boolean>>({});
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [vacationStart, setVacationStart] = useState('2026-08-03');
  const [vacationEnd, setVacationEnd] = useState('2026-08-09');
  const [monthlyAdjustments, setMonthlyAdjustments] = useState<Record<string, MonthlyAdjustment>>({});
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [annualYear, setAnnualYear] = useState(2026);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('contrata-hogar-contract');
    if (saved) {
      try { const parsed = { ...defaults, ...JSON.parse(saved) } as Contract; setContract(parsed); setDraft(parsed); } catch { /* ignore invalid local data */ }
    }
    const savedAttendance = window.localStorage.getItem('contrata-hogar-attendance');
    if (savedAttendance) {
      try { const parsed = JSON.parse(savedAttendance) as Record<string, 'scheduled' | 'completed' | 'sick' | 'vacation' | 'holiday'>; setAttendanceStatus(Object.fromEntries(Object.entries(parsed).filter(([, status]) => status !== 'vacation'))); } catch { /* ignore invalid local data */ }
    }
    const savedClosedMonths = window.localStorage.getItem('contrata-hogar-closed-months');
    if (savedClosedMonths) {
      try { setClosedMonths(JSON.parse(savedClosedMonths)); } catch { /* ignore invalid local data */ }
    }
    const savedVacationPeriods = window.localStorage.getItem('contrata-hogar-vacation-periods');
    if (savedVacationPeriods) {
      try { setVacationPeriods(JSON.parse(savedVacationPeriods)); } catch { /* ignore invalid local data */ }
    }
    const savedMonthlyAdjustments = window.localStorage.getItem('contrata-hogar-monthly-adjustments');
    if (savedMonthlyAdjustments) {
      try { setMonthlyAdjustments(JSON.parse(savedMonthlyAdjustments)); } catch { /* ignore invalid local data */ }
    }
    setAttendanceLoaded(true);
  }, []);

  useEffect(() => {
    if (attendanceLoaded) {
      window.localStorage.setItem('contrata-hogar-attendance', JSON.stringify(attendanceStatus));
      window.localStorage.setItem('contrata-hogar-closed-months', JSON.stringify(closedMonths));
      window.localStorage.setItem('contrata-hogar-vacation-periods', JSON.stringify(vacationPeriods));
      window.localStorage.setItem('contrata-hogar-monthly-adjustments', JSON.stringify(monthlyAdjustments));
    }
  }, [attendanceLoaded, attendanceStatus, closedMonths, vacationPeriods, monthlyAdjustments]);

  const salary = useMemo(() => +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2), [contract]);
  const contributionYear = Number(attendanceMonth.slice(0, 4));
  const monthAdjustment = { ...emptyMonthlyAdjustment, ...(monthlyAdjustments[attendanceMonth] || {}) };
  const [settlementYear, settlementMonth] = attendanceMonth.split('-').map(Number);
  const settlementDays = new Date(settlementYear, settlementMonth, 0).getDate();
  const contractStartsThisMonth = contract.startDate.slice(0, 7) === attendanceMonth;
  const contractStartsLater = contract.startDate > `${attendanceMonth}-${String(settlementDays).padStart(2, '0')}`;
  const settlementStartDay = contractStartsLater ? settlementDays + 1 : contractStartsThisMonth ? Number(contract.startDate.slice(8, 10)) : 1;
  const validEndDate = monthAdjustment.endDate?.slice(0, 7) === attendanceMonth ? Number(monthAdjustment.endDate.slice(8, 10)) : settlementDays;
  const settlementEndDay = Math.min(settlementDays, Math.max(settlementStartDay - 1, validEndDate));
  const activeSettlementDays = Math.max(0, settlementEndDay - settlementStartDay + 1);
  const proratedSalary = cents(salary * activeSettlementDays / settlementDays);
  const monthlyGross = Math.max(0, cents(proratedSalary + monthAdjustment.additionalHours + monthAdjustment.holidayCompensation - monthAdjustment.sickLeaveDeduction - monthAdjustment.unpaidAbsenceDeduction + monthAdjustment.otherAdjustment));
  const otherEarning = Math.max(0, monthAdjustment.otherAdjustment);
  const otherDeduction = Math.max(0, -monthAdjustment.otherAdjustment);
  const totalAccrued = cents(proratedSalary + monthAdjustment.additionalHours + monthAdjustment.holidayCompensation + otherEarning);
  const wageDeductions = cents(monthAdjustment.sickLeaveDeduction + monthAdjustment.unpaidAbsenceDeduction + otherDeduction);
  const estimatedContributions = useMemo(() => socialSecurity(monthlyGross, contributionYear, contract.contributionCommonBenefit, contract.unemploymentFogasaBonus, contract.professionalContingencyRate), [monthlyGross, contributionYear, contract.contributionCommonBenefit, contract.unemploymentFogasaBonus, contract.professionalContingencyRate]);
  const workerContribution = monthAdjustment.workerContributionOverride ?? estimatedContributions.worker;
  const employerContribution = monthAdjustment.employerContributionOverride ?? estimatedContributions.employer;
  const contributions = { ...estimatedContributions, worker: workerContribution, employer: employerContribution, directDebit: cents(workerContribution + employerContribution), net: cents(monthlyGross - workerContribution), totalCost: cents(monthlyGross + employerContribution) };
  const deduction = contributions.worker;
  const net = contributions.net;
  const contractScheduleHours = scheduleHours(contract.scheduleEntries || []);
  const draftScheduleHours = scheduleHours(draft.scheduleEntries || []);
  const draftHoursMatch = Math.abs(draftScheduleHours - draft.weeklyHours) < .01;
  const partiesComplete = Boolean(contract.employerName && contract.employerDni && contract.employerAddress && contract.employerMunicipality && contract.employerPostcode && contract.contributionAccount && contract.employeeName && contract.employeeDni && contract.employeeNss && contract.employeeAddress && contract.employeeBirthDate && contract.employeeNationality && contract.employeeMunicipality && contract.employeePostcode);
  const contractReady = Boolean(partiesComplete && contract.workAddress && contract.workMunicipality && contract.workPostcode && contract.signaturePlace && contract.signatureDate && contract.scheduleEntries?.length && Math.abs(contractScheduleHours - contract.weeklyHours) < .01);
  const attendanceDays = useMemo(() => monthWorkdays(attendanceMonth, contract.scheduleEntries || [], contract.startDate), [attendanceMonth, contract.scheduleEntries, contract.startDate]);
  const payrollPrepared = Boolean(closedMonths[attendanceMonth]);
  const sickDaysInMonth = attendanceDays.filter(day => attendanceStatus[day.key] === 'sick').length;
  const setPayrollPrepared = (ready: boolean) => setClosedMonths(previous => ({ ...previous, [attendanceMonth]: ready }));
  const isVacationDate = (date: Date) => {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return vacationPeriods.some(period => value >= period.start && value <= period.end);
  };
  const reviewedAttendanceDays = attendanceDays.filter(day => isVacationDate(day.date) || attendanceStatus[day.key] === 'completed' || attendanceStatus[day.key] === 'sick' || attendanceStatus[day.key] === 'holiday').length;
  const annualMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const month = `${annualYear}-${String(index + 1).padStart(2, '0')}`;
    const days = monthWorkdays(month, contract.scheduleEntries || [], contract.startDate);
    return {
      month,
      label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(annualYear, index, 1)),
      planned: days.length,
      worked: days.filter(day => !isVacationDate(day.date) && attendanceStatus[day.key] === 'completed').length,
      sick: days.filter(day => !isVacationDate(day.date) && attendanceStatus[day.key] === 'sick').length,
      vacation: days.filter(day => isVacationDate(day.date)).length,
    };
  }), [annualYear, attendanceStatus, contract.scheduleEntries, contract.startDate, vacationPeriods]);
  const annualTotals = annualMonths.reduce((total, month) => ({ planned: total.planned + month.planned, worked: total.worked + month.worked, sick: total.sick + month.sick, vacation: total.vacation + month.vacation }), { planned: 0, worked: 0, sick: 0, vacation: 0 });
  const contractualDaysPerWeek = Math.max(1, new Set((contract.scheduleEntries || []).map(entry => entry.day)).size);
  const vacationPeriodsForYear = vacationPeriods.filter(period => new Date(`${period.start}T12:00:00`).getFullYear() === annualYear);
  const vacationNaturalDays = vacationPeriodsForYear.reduce((total, period) => total + calendarDays(period.start, period.end), 0);
  const yearStart = new Date(annualYear, 0, 1);
  const yearEnd = new Date(annualYear, 11, 31);
  const contractStart = new Date(`${contract.startDate}T00:00:00`);
  const millisecondsPerDay = 86400000;
  const daysInYear = Math.round((yearEnd.getTime() - yearStart.getTime()) / millisecondsPerDay) + 1;
  const entitlementStart = contractStart > yearStart ? contractStart : yearStart;
  const entitledCalendarDays = entitlementStart > yearEnd ? 0 : Math.round((yearEnd.getTime() - entitlementStart.getTime()) / millisecondsPerDay) + 1;
  const vacationEntitlement = cents(contract.vacationDays * entitledCalendarDays / daysInYear);
  const vacationRemaining = Math.max(0, cents(vacationEntitlement - vacationNaturalDays));
  const moveAttendanceMonth = (offset: number) => {
    const [year, month] = attendanceMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setAttendanceMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const updateContributionSettings = (update: Partial<Pick<Contract, 'contributionCommonBenefit' | 'unemploymentFogasaBonus' | 'professionalContingencyRate'>>) => {
    const updated = { ...contract, ...update };
    setContract(updated); setDraft(updated);
    window.localStorage.setItem('contrata-hogar-contract', JSON.stringify(updated));
    notify('Supuestos de cotización actualizados');
  };
  const updateMonthAdjustment = (update: Partial<MonthlyAdjustment>) => {
    if (payrollPrepared) { notify('Abre el mes antes de modificar su liquidación'); return; }
    setMonthlyAdjustments(previous => ({ ...previous, [attendanceMonth]: { ...emptyMonthlyAdjustment, ...(previous[attendanceMonth] || {}), ...update } }));
  };
  const setVacationPreset = (days: number) => {
    if (!vacationStart) return;
    const end = new Date(`${vacationStart}T12:00:00`); end.setDate(end.getDate() + days - 1);
    setVacationEnd(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`);
  };
  const addVacationPeriod = () => {
    const days = calendarDays(vacationStart, vacationEnd);
    if (!vacationStart || !vacationEnd || days <= 0) { notify('Revisa las fechas del periodo de vacaciones'); return; }
    if (vacationStart.slice(0, 4) !== vacationEnd.slice(0, 4)) { notify('Registra por separado las vacaciones de cada año natural'); return; }
    if (vacationPeriods.some(period => vacationStart <= period.end && vacationEnd >= period.start)) { notify('Este periodo se solapa con otras vacaciones'); return; }
    const affectedClosedMonth = Object.keys(closedMonths).find(month => closedMonths[month] && vacationStart.slice(0, 7) <= month && vacationEnd.slice(0, 7) >= month);
    if (affectedClosedMonth) { notify(`Abre primero ${monthLabel(affectedClosedMonth)} para añadir vacaciones`); return; }
    const year = new Date(`${vacationStart}T12:00:00`).getFullYear();
    const used = vacationPeriods.filter(period => new Date(`${period.start}T12:00:00`).getFullYear() === year).reduce((total, period) => total + calendarDays(period.start, period.end), 0);
    const startOfYear = new Date(year, 0, 1), endOfYear = new Date(year, 11, 31), start = new Date(`${contract.startDate}T00:00:00`);
    const entitlementFrom = start > startOfYear ? start : startOfYear;
    const entitlement = entitlementFrom > endOfYear ? 0 : cents(contract.vacationDays * ((endOfYear.getTime() - entitlementFrom.getTime()) / 86400000 + 1) / ((endOfYear.getTime() - startOfYear.getTime()) / 86400000 + 1));
    if (used + days > entitlement + .01) { notify(`El periodo supera el saldo disponible de ${entitlement.toLocaleString('es-ES')} días`); return; }
    setVacationPeriods([...vacationPeriods, { id: `${Date.now()}`, start: vacationStart, end: vacationEnd }].sort((a, b) => a.start.localeCompare(b.start)));
    notify(`Periodo de ${days} días naturales añadido`);
  };
  const removeVacationPeriod = (period: VacationPeriod) => {
    const affectedClosedMonth = Object.keys(closedMonths).find(month => closedMonths[month] && period.start.slice(0, 7) <= month && period.end.slice(0, 7) >= month);
    if (affectedClosedMonth) { notify(`Abre primero ${monthLabel(affectedClosedMonth)} para modificar sus vacaciones`); return; }
    setVacationPeriods(vacationPeriods.filter(item => item.id !== period.id));
    notify('Periodo de vacaciones eliminado');
  };
  const updateSchedule = (index: number, update: Partial<ScheduleEntry>) => setDraft({ ...draft, scheduleEntries: draft.scheduleEntries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...update } : entry) });
  const addSchedule = () => setDraft({ ...draft, scheduleEntries: [...draft.scheduleEntries, { day: 'Lunes', start: '10:00', end: '13:00' }] });
  const removeSchedule = (index: number) => setDraft({ ...draft, scheduleEntries: draft.scheduleEntries.filter((_, entryIndex) => entryIndex !== index) });
  const openContractWizard = () => { setDraft(contract); setWizardStep(1); setContractWizard(true); };
  const saveWizard = () => {
    if (!draft.startDate || draft.weeklyHours <= 0 || draft.hourlyRate <= 0 || !draft.workAddress.trim() || !draft.workMunicipality || !draft.workPostcode || !draft.scheduleEntries.length || !draftHoursMatch || !draft.signaturePlace.trim() || !draft.signatureDate || !draft.employerName || !draft.employerDni || !draft.employerAddress || !draft.employerMunicipality || !draft.employerPostcode || !draft.contributionAccount || !draft.employeeName || !draft.employeeDni || !draft.employeeNss || !draft.employeeAddress || !draft.employeeBirthDate || !draft.employeeNationality || !draft.employeeMunicipality || !draft.employeePostcode) { notify(draftHoursMatch ? 'Completa todos los datos necesarios del contrato oficial' : 'El horario debe sumar exactamente las horas semanales pactadas'); return; }
    setContract(draft);
    window.localStorage.setItem('contrata-hogar-contract', JSON.stringify(draft));
    setContractWizard(false);
    notify('Datos contractuales guardados en este dispositivo');
  };
  const generateReceipt = () => {
    if (!contributions.supported) { notify(`No hay reglas de cotización verificadas para ${contributionYear}`); return; }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const period = monthLabel(attendanceMonth);
    const employerContribution = contributions.employer;
    const familyTotal = contributions.totalCost;
    const left = 15, width = 180;
    const box = (x: number, y: number, w: number, h: number, title: string, lines: string[]) => {
      pdf.setDrawColor(118, 137, 145).rect(x, y, w, h);
      pdf.setFillColor(237, 247, 252).rect(x, y, w, 7, 'F');
      pdf.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(23, 36, 43).text(title.toUpperCase(), x + 3, y + 4.8);
      pdf.setFont('helvetica', 'normal').setFontSize(7.3);
      lines.forEach((line, index) => pdf.text(line, x + 3, y + 12 + index * 4.2));
    };
    pdf.setFillColor(8, 125, 189).rect(0, 0, 210, 16, 'F');
    pdf.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(8).text('CONTRATA HOGAR', left, 10);
    pdf.setTextColor(23, 36, 43).setFontSize(15).text('RECIBO INDIVIDUAL JUSTIFICATIVO DEL PAGO DE SALARIOS', left, 25);
    pdf.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 115, 122).text('Servicio del hogar familiar', left, 30);
    box(left, 35, 88, 31, 'Persona empleadora', [contract.employerName || 'Pendiente de completar', `DNI/NIE: ${contract.employerDni || 'Pendiente'}`, `Domicilio: ${contract.employerAddress || 'Pendiente'}`]);
    box(107, 35, 88, 31, 'Persona trabajadora', [contract.employeeName || 'Pendiente de completar', `DNI/NIE: ${contract.employeeDni || 'Pendiente'}`, `N. afiliación S.S.: ${contract.employeeNss || 'Pendiente'}`]);
    box(left, 70, width, 20, 'Periodo de liquidación', [`Del ${settlementStartDay} al ${settlementEndDay} de ${period} | Días en alta: ${activeSettlementDays} | Jornada: ${contract.weeklyHours} h/semana`]);
    pdf.setFillColor(237, 247, 252).rect(left, 95, width, 8, 'F');
    pdf.setDrawColor(118, 137, 145).rect(left, 95, width, 50);
    pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(23, 36, 43).text('I. DEVENGOS', left + 3, 100.5);
    pdf.setFontSize(7).text('CONCEPTO', left + 3, 109).text('IMPORTE', 190, 109, { align: 'right' });
    pdf.setFont('helvetica', 'normal').text('Salario base del periodo (pagas extraordinarias prorrateadas)', left + 3, 116).text(euro(proratedSalary), 190, 116, { align: 'right' });
    pdf.text('Horas adicionales', left + 3, 122).text(euro(monthAdjustment.additionalHours), 190, 122, { align: 'right' });
    pdf.text('Compensación económica por festivos trabajados', left + 3, 128).text(euro(monthAdjustment.holidayCompensation), 190, 128, { align: 'right' });
    pdf.text('Otros devengos / regularización positiva', left + 3, 134).text(euro(otherEarning), 190, 134, { align: 'right' });
    pdf.setDrawColor(205, 217, 223).line(left + 3, 133, 192, 133);
    pdf.setFont('helvetica', 'bold').text('A. TOTAL DEVENGADO', left + 3, 140).text(euro(totalAccrued), 190, 140, { align: 'right' });
    pdf.setFillColor(237, 247, 252).rect(left, 151, width, 8, 'F');
    pdf.setDrawColor(118, 137, 145).rect(left, 151, width, 43);
    pdf.setFont('helvetica', 'bold').setFontSize(8).text('II. DEDUCCIONES', left + 3, 156.5);
    pdf.setFont('helvetica', 'normal').setFontSize(6.5).text('Aportación trabajadora a la Seguridad Social (estimada)', left + 3, 166).text(euro(deduction), 190, 166, { align: 'right' });
    pdf.text('Ajuste comunicado por incapacidad temporal', left + 3, 171).text(euro(monthAdjustment.sickLeaveDeduction), 190, 171, { align: 'right' });
    pdf.text('Ausencias no retribuidas', left + 3, 176).text(euro(monthAdjustment.unpaidAbsenceDeduction), 190, 176, { align: 'right' });
    pdf.text('Otras deducciones / regularización negativa', left + 3, 181).text(euro(otherDeduction), 190, 181, { align: 'right' });
    pdf.text('Retención IRPF', left + 3, 186).text('No calculada', 190, 186, { align: 'right' });
    pdf.setDrawColor(205, 217, 223).line(left + 3, 184, 192, 184);
    pdf.setFont('helvetica', 'bold').text('B. TOTAL A DEDUCIR', left + 3, 191).text(euro(cents(deduction + wageDeductions)), 190, 191, { align: 'right' });
    pdf.setFillColor(8, 125, 189).rect(left, 201, width, 18, 'F');
    pdf.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(10).text('LÍQUIDO TOTAL A PERCIBIR (A - B)', left + 4, 212).text(euro(net), 190, 212, { align: 'right' });
    pdf.setDrawColor(118, 137, 145).rect(left, 226, width, 46);
    pdf.setFillColor(237, 247, 252).rect(left, 226, width, 8, 'F');
    pdf.setTextColor(23, 36, 43).setFont('helvetica', 'bold').setFontSize(8).text('COSTE Y COTIZACIÓN DE LA PERSONA EMPLEADORA', left + 3, 231.5);
    pdf.setFont('helvetica', 'normal').setFontSize(6.8).text(`Base de cotización ${contributionYear}`, left + 3, 239).text(euro(contributions.base), 190, 239, { align: 'right' });
    pdf.text('Aportación de la persona trabajadora incluida en el cargo', left + 3, 245).text(euro(contributions.worker), 190, 245, { align: 'right' });
    pdf.text('Aportación a cargo de la persona empleadora', left + 3, 251).text(euro(employerContribution), 190, 251, { align: 'right' });
    pdf.setFont('helvetica', 'bold').text('CARGO TOTAL DOMICILIADO DE SEGURIDAD SOCIAL', left + 3, 258).text(euro(contributions.directDebit), 190, 258, { align: 'right' });
    pdf.setDrawColor(205, 217, 223).line(left + 3, 262, 192, 262);
    pdf.setFontSize(8).text('COSTE TOTAL', left + 3, 268).text(euro(familyTotal), 190, 268, { align: 'right' });
    pdf.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(100, 115, 122).text(`Cálculo orientativo ${contributionYear}; el cargo definitivo es el liquidado por la Seguridad Social.`, left, 277);
    pdf.setFontSize(7).setTextColor(70, 85, 92).text('Pago previsto por transferencia bancaria', left, 281);
    pdf.text('Firma de la persona empleadora', left, 291).text('Recibí: persona trabajadora', 125, 291);
    pdf.save(`recibo-salario-${attendanceMonth}.pdf`); notify('Recibo de salario descargado');
  };
  const generateContract = async (finalDocument = false) => {
    if (!contractReady) { openContractWizard(); notify(Math.abs(contractScheduleHours - contract.weeklyHours) < .01 ? 'El documento está incompleto: revisa los datos obligatorios' : `El horario suma ${contractScheduleHours.toLocaleString('es-ES')} h y la jornada pactada es de ${contract.weeklyHours.toLocaleString('es-ES')} h`); return; }
    try {
      const response = await fetch('/Contrato-indefinido-SEPE-editable.pdf');
      if (!response.ok) throw new Error('No se ha podido cargar el modelo oficial');
      const pdf = await PDFDocument.load(await response.arrayBuffer());
      const form = pdf.getForm();
      const monthlySalary = cents(contract.hourlyRate * contract.weeklyHours * 52 / 12);
      const text = (name: string, value: string | number) => form.getTextField(name).setText(String(value));
      const radio = (name: string, value: string) => form.getRadioGroup(name).select(value);
      const check = (name: string) => form.getCheckBox(name).check();

      text('AA0101-E09', contract.employerDni); text('AA0102', contract.employerName); text('AA0103-E09', contract.employerDni);
      text('AA0104', 'Titular del hogar familiar'); text('AA0105', contract.employerName); text('AA0106', contract.employerAddress);
      text('AA0107', contract.employerMunicipality); text('AA0109-E05', contract.employerPostcode); text('AA0110', 'España');
      text('AA0201-E04', '0138'); text('AA0202-E11', contract.contributionAccount.replace(/\s/g, '')); text('AA0203', 'Servicio del hogar familiar');
      text('AA0301', contract.workMunicipality); text('AA0303-E05', contract.workPostcode); text('AA0304', 'España');
      text('AA0401', contract.employeeName); text('AA0402-E09', contract.employeeDni); text('AA0403-FE-E10', officialDate(contract.employeeBirthDate));
      text('AA0404-E12', contract.employeeNss.replace(/\s/g, '')); text('AA0405', contract.employeeNationality); text('AA0407', 'Sin especificar');
      text('AA0409', contract.employeeMunicipality); text('AA0411-E05', contract.employeePostcode); text('AA0412', 'España');
      text('C0101', 'Empleado/a del hogar'); text('C0102', 'Personal al servicio del hogar familiar');
      text('C0103', 'Limpieza y mantenimiento ordinario del domicilio familiar'); text('C0104', `${contract.workAddress}, ${contract.workMunicipality}`);
      radio('C03BO1', 'Elección2'); text('C0304', contract.weeklyHours.toLocaleString('es-ES')); radio('C03BO2', 'Elección3');
      text('C0305', scheduleText(contract.scheduleEntries)); radio('C03BO3', 'Elección2'); text('C0401-FE', officialDate(contract.startDate));
      text('C0402', contract.hasTrialPeriod ? `${contract.trialPeriod} días` : 'No se establece');
      text('C0501', monthlySalary.toLocaleString('es-ES', { minimumFractionDigits: 2 })); text('C0502', 'mensuales');
      text('C0503', `Salario base y pagas extraordinarias prorrateadas en 12 mensualidades (${contract.hourlyRate.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/hora)`);
      radio('C06BO1', 'Elección2'); text('C0701', `${contract.vacationDays} días naturales`); radio('C09BO1', 'Elección2');
      text('C0801', 'Real Decreto 1620/2011, Estatuto de los Trabajadores y normativa aplicable');
      check('IP16CV1'); radio('IP16BO1', 'Elección2'); radio('IP16BO2', 'Elección2'); radio('IP16BO4', 'Elección2'); radio('IP16BO5', 'Elección2');

      const signature = new Date(`${contract.signatureDate}T12:00:00`);
      text('ICA02', contract.signaturePlace); text('ICA03', signature.getDate());
      text('ICA04', new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(signature)); text('ICA05', signature.getFullYear());
      form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica));
      form.flatten();
      for (let index = pdf.getPageCount() - 1; index >= 0; index--) if (![0, 1, 2, 3, 4, 16, 19].includes(index)) pdf.removePage(index);
      if (!finalDocument) {
        const font = await pdf.embedFont(StandardFonts.HelveticaBold);
        pdf.getPages().forEach(page => page.drawText('BORRADOR', { x: 150, y: 360, size: 58, font, color: rgb(.68, .72, .77), opacity: .18, rotate: degrees(35) }));
      }
      const bytes = await pdf.save();
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${finalDocument ? 'contrato-definitivo' : 'borrador-contrato'}-${contract.startDate}.pdf`; anchor.click(); URL.revokeObjectURL(url);
      notify(finalDocument ? 'Contrato oficial definitivo descargado' : 'Borrador oficial descargado para revisar');
    } catch (error) { console.error(error); notify('No se ha podido generar el PDF oficial. Revisa los datos e inténtalo de nuevo.'); }
  };
  const confirmFinalContract = () => {
    if (window.confirm('¿Confirmas que has revisado todos los datos del borrador y quieres generar el contrato oficial definitivo para firmarlo?')) generateContract(true);
  };
  const generateManagementSheet = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const gross = +(contract.hourlyRate * contract.weeklyHours * 52 / 12).toFixed(2);
    const sheetYear = Number(contract.startDate.slice(0, 4));
    const socialSecurityEstimate = socialSecurity(gross, sheetYear, contract.contributionCommonBenefit, contract.unemploymentFogasaBonus, contract.professionalContingencyRate);
    if (!socialSecurityEstimate.supported) { notify(`No hay reglas de cotización verificadas para ${sheetYear}`); return; }
    const rows = [['Ejercicio de cálculo', String(sheetYear)], ['Salario bruto mensual', euro(gross)], [`Base de cotización ${sheetYear}`, euro(socialSecurityEstimate.base)], ['Aportación trabajadora', euro(socialSecurityEstimate.worker)], ['Neto a transferir', euro(socialSecurityEstimate.net)], ['Cuota empleadora', euro(socialSecurityEstimate.employer)], ['Cargo total Seguridad Social', euro(socialSecurityEstimate.directDebit)], ['Coste total', euro(socialSecurityEstimate.totalCost)], ['Día habitual de pago', `Día ${contract.paymentDay}`], ['Fecha de alta prevista', formatDate(contract.startDate)], ['Fecha de baja', 'Sin registrar']];
    pdf.setTextColor(8, 125, 189).setFont('helvetica', 'bold').setFontSize(9).text('CONTRATA HOGAR · DOCUMENTO INTERNO', 20, 20);
    pdf.setTextColor(23, 36, 43).setFontSize(21).text('Ficha interna de gestión', 20, 32);
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(95, 117, 128).text('No forma parte del contrato firmado', 20, 39);
    let y = 52;
    rows.forEach(([label, value]) => { pdf.setFillColor(246, 249, 250).rect(20, y, 65, 10, 'F'); pdf.setDrawColor(218, 227, 232).rect(20, y, 170, 10); pdf.setFont('helvetica', 'bold').setTextColor(45, 59, 66).text(label, 24, y + 6.5); pdf.setFont('helvetica', 'normal').text(value, 90, y + 6.5); y += 10; });
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(110, 125, 132).text('Las cotizaciones son estimaciones orientativas y deben comprobarse con los datos vigentes de la Seguridad Social.', 20, 145);
    pdf.addPage(); y = 20; pdf.setTextColor(8, 125, 189).setFont('helvetica', 'bold').setFontSize(9).text('CONTRATA HOGAR · REGISTROS INTERNOS', 20, y);
    const register = (title: string, columns: string[]) => { y += 10; pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(23, 36, 43).text(title, 20, y); y += 5; const columnWidth = 170 / columns.length; columns.forEach((column, index) => { pdf.setFillColor(234, 247, 253).rect(20 + index * columnWidth, y, columnWidth, 9, 'F'); pdf.setFontSize(8).text(column, 23 + index * columnWidth, y + 6); }); y += 9; for (let row = 0; row < 3; row++) { pdf.setDrawColor(218, 227, 232).rect(20, y, 170, 10); y += 10; } };
    register('Pagos mensuales', ['Mes', 'Importe', 'Fecha', 'Estado']);
    register('Recibos de salario', ['Periodo', 'Fecha', 'Documento']);
    register('Vacaciones y festivos', ['Fecha / periodo', 'Tipo', 'Acuerdo / situación']);
    register('Documentos asociados', ['Documento', 'Fecha', 'Observaciones']);
    pdf.save(`ficha-interna-${contract.startDate}.pdf`);
    notify('Ficha interna descargada en PDF');
  };

  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="Contrata Hogar, inicio"><b>C</b><span>Contrata Hogar</span></a>
      <nav><button aria-label="Inicio" title="Inicio" className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')}><i>⌂</i><span>Inicio</span></button><button aria-label="Contrato" title="Contrato" className={activeView === 'contract' ? 'active' : ''} onClick={() => setActiveView('contract')}><i>▧</i><span>Contrato</span></button><button aria-label="Asistencia" title="Asistencia" className={activeView === 'attendance' ? 'active' : ''} onClick={() => setActiveView('attendance')}><i>✓</i><span>Asistencia</span></button><button aria-label="Resumen anual" title="Resumen anual" className={activeView === 'annual' ? 'active' : ''} onClick={() => setActiveView('annual')}><i>◫</i><span>Resumen anual</span></button><button aria-label="Documentos" title="Documentos" className={activeView === 'documents' ? 'active' : ''} onClick={() => setActiveView('documents')}><i>▤</i><span>Documentos</span></button></nav>
      <div className="sidebottom"><a href="#ajustes"><i>⚙</i><span>Ajustes</span></a><div className="profile"><b>{contract.employerName ? contract.employerName.slice(0, 2).toUpperCase() : 'EM'}</b><p>{contract.employerName || 'Empleador'}<small>Empleador</small></p></div></div>
    </aside>

    <section className="workspace" id="top">
      <header><div><small>DOMINGO, 30 DE AGOSTO</small><h1>{activeView === 'home' ? 'Buenos días, Jorge' : activeView === 'contract' ? 'Contrato' : activeView === 'attendance' ? 'Asistencia' : activeView === 'annual' ? 'Resumen anual' : 'Documentos'}</h1></div><button className="help" onClick={() => notify('Centro de ayuda: disponible en la siguiente versión')}>ⓘ Ayuda</button></header>
      <div className="content">
        {activeView === 'contract' && <section className="contribution-settings"><div className="contribution-settings-head"><div><span>COTIZACIÓN ESTIMADA</span><h3>Supuestos aplicados</h3><p>Reglas oficiales versionadas por ejercicio. Comprueba en Importass qué beneficios reconoce la TGSS.</p></div><strong>{contributions.supported ? `Ejercicio ${contributionYear}` : `${contributionYear} sin reglas verificadas`}</strong></div><div className="contribution-settings-grid"><label>Beneficio en contingencias comunes<select value={contract.contributionCommonBenefit} onChange={event => updateContributionSettings({ contributionCommonBenefit: event.target.value as Contract['contributionCommonBenefit'] })}><option value="general20">Reducción general del 20 %</option><option value="largeFamily45">Bonificación del 45 % · familia numerosa</option><option value="none">Sin reducción ni bonificación</option></select><small>El 45 % es alternativo al 20 % y exige cumplir sus requisitos.</small></label><label className="toggle-setting"><span><b>Bonificación del 80 %</b><small>Desempleo y FOGASA</small></span><input type="checkbox" checked={contract.unemploymentFogasaBonus} onChange={event => updateContributionSettings({ unemploymentFogasaBonus: event.target.checked })} /></label><label>Contingencias profesionales (%)<input type="number" min="0" max="10" step="0.01" value={contract.professionalContingencyRate} onChange={event => updateContributionSettings({ professionalContingencyRate: Number(event.target.value) })} /><small>Tipo AT/EP asumido. Contrástalo con el aplicado por la TGSS.</small></label></div><div className="contribution-result"><div><span>Base</span><strong>{euro(contributions.base)}</strong></div><div><span>Aportación trabajadora</span><strong>{euro(contributions.worker)}</strong></div><div><span>Aportación empleadora</span><strong>{euro(contributions.employer)}</strong></div><div><span>Cargo total S. Social</span><strong>{euro(contributions.directDebit)}</strong></div></div><p className="contribution-warning">Estimación, no liquidación oficial. El importe válido es el cargo emitido por la Tesorería General de la Seguridad Social.</p></section>}
        {activeView === 'attendance' && <section className={`settlement-panel ${payrollPrepared ? 'locked' : ''}`}><div className="settlement-head"><div><span>LIQUIDACIÓN DE {monthLabel(attendanceMonth).toUpperCase()}</span><h3>Ajustes del recibo</h3><p>El salario base se prorratea automáticamente si el alta comienza o termina durante el mes.</p></div><strong>{activeSettlementDays} de {settlementDays} días en alta</strong></div><div className="settlement-fields"><label>Último día en alta durante este mes<input type="date" min={`${attendanceMonth}-01`} max={`${attendanceMonth}-${String(settlementDays).padStart(2, '0')}`} value={monthAdjustment.endDate} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ endDate: event.target.value })} /><small>Déjalo vacío si la relación continúa.</small></label><label>Horas adicionales (€)<input type="number" min="0" step="0.01" value={monthAdjustment.additionalHours} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ additionalHours: Number(event.target.value) })} /></label><label>Festivos trabajados (€)<input type="number" min="0" step="0.01" value={monthAdjustment.holidayCompensation} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ holidayCompensation: Number(event.target.value) })} /></label><label>Ajuste por baja médica (€)<input type="number" min="0" step="0.01" value={monthAdjustment.sickLeaveDeduction} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ sickLeaveDeduction: Number(event.target.value) })} /><small>{sickDaysInMonth ? `${sickDaysInMonth} jornada(s) marcada(s) como baja.` : 'Sin jornadas de baja registradas.'}</small></label><label>Ausencias no retribuidas (€)<input type="number" min="0" step="0.01" value={monthAdjustment.unpaidAbsenceDeduction} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ unpaidAbsenceDeduction: Number(event.target.value) })} /></label><label>Otra regularización (€)<input type="number" step="0.01" value={monthAdjustment.otherAdjustment} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ otherAdjustment: Number(event.target.value) })} /><small>Positiva para sumar; negativa para deducir.</small></label><label className="settlement-notes">Concepto u observaciones<textarea value={monthAdjustment.notes} disabled={payrollPrepared} onChange={event => updateMonthAdjustment({ notes: event.target.value })} placeholder="Ej.: 3 horas adicionales del 18 de agosto" /></label></div><div className="settlement-totals"><div><span>Salario base del periodo</span><strong>{euro(proratedSalary)}</strong></div><div><span>Bruto tras ajustes</span><strong>{euro(monthlyGross)}</strong></div><div><span>Neto estimado</span><strong>{euro(net)}</strong></div></div><p className="settlement-warning">La baja médica queda registrada en asistencia, pero su efecto económico debe introducirse con el importe comprobado. La app no deduce automáticamente días de incapacidad temporal.</p></section>}
        {activeView === 'attendance' && <section className="official-charge"><div><span>COTIZACIÓN DEL MES</span><h3>Importes reales de la TGSS</h3><p>Opcional. Si Importass o el cargo bancario muestra importes distintos, introdúcelos aquí y prevalecerán sobre la estimación.</p></div><label>Aportación trabajadora<input type="number" min="0" step="0.01" value={monthAdjustment.workerContributionOverride ?? ''} disabled={payrollPrepared} placeholder={euro(estimatedContributions.worker)} onChange={event => updateMonthAdjustment({ workerContributionOverride: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Aportación empleadora<input type="number" min="0" step="0.01" value={monthAdjustment.employerContributionOverride ?? ''} disabled={payrollPrepared} placeholder={euro(estimatedContributions.employer)} onChange={event => updateMonthAdjustment({ employerContributionOverride: event.target.value === '' ? null : Number(event.target.value) })} /></label><strong>{monthAdjustment.workerContributionOverride !== null || monthAdjustment.employerContributionOverride !== null ? 'Importe oficial introducido' : 'Usando estimación'}</strong></section>}
        {activeView === 'home' && <>
        <section className="hero"><div><label><i /> RELACIÓN LABORAL ACTIVA</label><h2>{payrollPrepared ? 'Recibo de nómina disponible' : 'Revisa la asistencia'}</h2><p>{payrollPrepared ? 'El mes está cerrado y ya puedes descargar el recibo salarial.' : 'Confirma las jornadas para cerrar el mes y generar la nómina.'}</p></div><div className="next"><span>Próxima acción</span><b>{payrollPrepared ? 'RECIBO' : 'ASISTENCIA'}</b><small>{payrollPrepared ? 'Disponible' : 'Pendiente'}</small></div></section>
        <Title title="Este mes" action="Abrir asistencia →" onClick={() => setActiveView('attendance')} />
        <div className="month month-home">
          <article className={'pay ' + (payrollPrepared ? 'done' : '')}><div className="cardtop"><b>€</b><span>{payrollPrepared ? 'RECIBO DISPONIBLE' : 'CIERRA LA ASISTENCIA'}</span></div><p>Nómina de {monthLabel(attendanceMonth)}</p><div className="monthly-amounts"><div><span>Neto a transferir</span><strong>{euro(net)}</strong></div><div><span>Aportación de la persona trabajadora</span><strong>{euro(contributions.worker)}</strong></div><div><span>Aportación de la persona empleadora</span><strong>{euro(contributions.employer)}</strong></div></div><div className="actions"><button className="primary" disabled={!payrollPrepared} onClick={generateReceipt}>Descargar recibo PDF</button><button onClick={() => setActiveView('attendance')}>Ver asistencia</button></div></article>
        </div>
        </>}

        {activeView === 'contract' && <section className="app-view contract-view"><div className="view-head"><div><span>RELACIÓN LABORAL</span><h2>Contrato oficial</h2><p>Contrata Hogar cumplimenta el modelo oficial del SEPE con los datos guardados en esta ficha.</p></div></div><section className="official-contract"><div className="official-step"><b>SEPE</b><div><span>MODELO OFICIAL VIGENTE</span><h3>Contrato indefinido · Servicio del hogar familiar</h3><p>La descarga incluye las páginas generales, la modalidad específica de hogar familiar y la página de firmas. Contrata Hogar no envía ni registra el contrato ante la Administración.</p></div><a href="https://www.sepe.es/NuevoSepe/contratos-trabajo/indefinido/Contrato-indefinido.pdf" target="_blank" rel="noreferrer">Ver original ↗</a></div></section><section className="contract-card" id="contrato"><div className="contract-icon">✓</div><div className="contract-copy"><span>{contractReady ? 'CONTRATO LISTO PARA REVISAR' : 'CONTRATO INCOMPLETO'}</span><h2>Generador del modelo oficial</h2><p>{contract.weeklyHours.toLocaleString('es-ES')} horas semanales · {euro(contract.hourlyRate)}/hora · {euro(salary)} brutos/mes</p><div className="contract-checks"><span>{partiesComplete ? '✓ Datos administrativos completos' : '○ Faltan datos obligatorios'}</span><span>{Math.abs(contractScheduleHours - contract.weeklyHours) < .01 ? '✓ Horario y jornada coinciden' : `○ El horario suma ${contractScheduleHours.toLocaleString('es-ES')} h`}</span></div></div><div className="contract-actions"><button onClick={openContractWizard}>Completar datos</button><button disabled={!contractReady} title={contractReady ? 'Descargar borrador oficial' : 'Completa los datos y corrige el horario'} onClick={() => generateContract(false)}>Generar borrador</button><button className="primary" disabled={!contractReady} title={contractReady ? 'Generar contrato definitivo' : 'Completa los datos y corrige el horario'} onClick={confirmFinalContract}>Confirmar contrato definitivo</button><button onClick={generateManagementSheet}>Ficha interna PDF</button></div></section><article className="person" id="persona"><div className="personhead"><b>{contract.employeeName ? contract.employeeName.slice(0, 2).toUpperCase() : 'TR'}</b><p><strong>{contract.employeeName || 'Persona trabajadora'}</strong><small>Ficha informativa · Contrato indefinido activo</small></p><span className="source-badge">Datos del contrato</span></div><dl><div><dt>Antigüedad</dt><dd>{seniority(contract.startDate)}<small>Inicio: {formatDate(contract.startDate)}</small></dd></div><div><dt>Jornada</dt><dd>{contract.weeklyHours.toLocaleString('es-ES')} h / semana<small>Horario acordado</small></dd></div><div><dt>Salario por hora</dt><dd>{euro(contract.hourlyRate)}<small>{euro(salary)} brutos / mes estimados</small></dd></div></dl></article></section>}

        {activeView === 'attendance' && <section className="app-view"><div className="view-head attendance-head"><div><span>CALENDARIO MENSUAL</span><h2>Revisar jornadas</h2><p>{payrollPrepared ? 'El mes está cerrado. Reábrelo para modificar cualquier jornada o ajuste.' : 'Confirma cada jornada, registra una baja o identifica manualmente un festivo.'}</p></div><span className={`status-pill ${payrollPrepared ? 'ok' : ''}`}>{payrollPrepared ? 'Mes cerrado' : `${reviewedAttendanceDays}/${attendanceDays.length} revisadas`}</span></div><div className="month-selector"><button aria-label="Mes anterior" onClick={() => moveAttendanceMonth(-1)}>‹</button><label>Mes<input type="month" value={attendanceMonth} onChange={event => setAttendanceMonth(event.target.value)} /></label><strong>{monthLabel(attendanceMonth)}</strong><button aria-label="Mes siguiente" onClick={() => moveAttendanceMonth(1)}>›</button></div><div className="attendance-summary"><div><span>Horas previstas</span><strong>{contract.weeklyHours.toLocaleString('es-ES')} h/semana</strong></div><div><span>Horario contractual</span><strong>{scheduleText(contract.scheduleEntries)}</strong></div></div><div className="attendance-list">{attendanceDays.length ? attendanceDays.map(({ key, date, entry }) => { const vacation = isVacationDate(date); const status = vacation ? 'vacation' : attendanceStatus[key] || 'scheduled'; const formatted = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date); return <article key={key} className={payrollPrepared || vacation ? 'locked' : ''}><div className="attendance-day-number"><b>{date.getDate()}</b><small>{new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).replace('.', '')}</small></div><div className="attendance-date"><b>{formatted.charAt(0).toUpperCase() + formatted.slice(1)}</b><small>{entry.start}–{entry.end}</small></div><span className={`attendance-state ${status}`}>{status === 'completed' ? 'Confirmada' : status === 'sick' ? 'Baja' : status === 'holiday' ? 'Festivo' : status === 'vacation' ? 'Vacaciones' : 'Pendiente'}</span>{vacation ? <small className="vacation-origin">Periodo de vacaciones</small> : <div className="attendance-actions"><button disabled={payrollPrepared} className={status === 'completed' ? 'selected' : ''} onClick={() => setAttendanceStatus({ ...attendanceStatus, [key]: 'completed' })}>Confirmar</button><button disabled={payrollPrepared} className={status === 'sick' ? 'selected sick' : ''} onClick={() => setAttendanceStatus({ ...attendanceStatus, [key]: 'sick' })}>Baja</button><button disabled={payrollPrepared} className={status === 'holiday' ? 'selected holiday' : ''} onClick={() => setAttendanceStatus({ ...attendanceStatus, [key]: 'holiday' })}>Festivo</button></div>}</article>}) : <div className="empty-month">No hay jornadas contractuales previstas en este mes.</div>}</div>{payrollPrepared ? <button className="view-secondary" onClick={() => { setPayrollPrepared(false); notify(`${monthLabel(attendanceMonth)} abierto de nuevo`); }}>Abrir mes de nuevo</button> : <button className="view-primary" disabled={!attendanceDays.length || reviewedAttendanceDays < attendanceDays.length} onClick={() => { setPayrollPrepared(true); notify(`Mes cerrado y recibo de ${monthLabel(attendanceMonth)} disponible`); }}>Cerrar mes y generar recibo</button>}</section>}

        {activeView === 'annual' && <section className="app-view annual-view"><div className="view-head"><div><span>PLANIFICACIÓN</span><h2>Resumen anual</h2><p>Vista consolidada de asistencia, bajas y periodos completos de vacaciones.</p></div><div className="year-selector"><button aria-label="Año anterior" onClick={() => setAnnualYear(annualYear - 1)}>‹</button><strong>{annualYear}</strong><button aria-label="Año siguiente" onClick={() => setAnnualYear(annualYear + 1)}>›</button></div></div><div className="annual-cards"><article><span>Jornadas previstas</span><strong>{annualTotals.planned}</strong><small>Según el contrato</small></article><article><span>Jornadas trabajadas</span><strong>{annualTotals.worked}</strong><small>Confirmadas</small></article><article><span>Bajas</span><strong>{annualTotals.sick}</strong><small>Jornadas registradas</small></article><article className="vacation-card"><span>Vacaciones disfrutadas</span><strong>{vacationNaturalDays.toLocaleString('es-ES')} días</strong><small>{annualTotals.vacation} jornadas contractuales incluidas</small></article><article className="remaining-card"><span>Saldo de vacaciones</span><strong>{vacationRemaining.toLocaleString('es-ES')} días</strong><small>De {vacationEntitlement.toLocaleString('es-ES')} días generados en {annualYear}</small></article></div><section className="vacation-manager"><div><span>VACACIONES</span><h3>Añadir periodo</h3><p>Selecciona fechas naturales completas. Las jornadas de trabajo incluidas se marcarán automáticamente.</p></div><div className="vacation-form"><label>Desde<input type="date" value={vacationStart} onChange={event => setVacationStart(event.target.value)} /></label><label>Hasta<input type="date" value={vacationEnd} onChange={event => setVacationEnd(event.target.value)} /></label><div className="vacation-presets"><button onClick={() => setVacationPreset(7)}>1 semana · 7 días</button><button onClick={() => setVacationPreset(14)}>2 semanas · 14 días</button><button onClick={() => setVacationPreset(15)}>Periodo mínimo · 15 días</button></div><button className="primary" onClick={addVacationPeriod}>Añadir periodo</button></div><div className="vacation-periods">{vacationPeriodsForYear.length ? vacationPeriodsForYear.map(period => <article key={period.id}><div><strong>{formatDate(period.start)} — {formatDate(period.end)}</strong><small>{calendarDays(period.start, period.end)} días naturales{calendarDays(period.start, period.end) >= 15 ? ' · Cumple el periodo mínimo' : ''}</small></div><button onClick={() => setVacationPeriods(vacationPeriods.filter(item => item.id !== period.id))}>Eliminar</button></article>) : <p>No hay periodos de vacaciones registrados en {annualYear}.</p>}</div><div className={`vacation-rule ${vacationPeriodsForYear.some(period => calendarDays(period.start, period.end) >= 15) ? 'ok' : ''}`}>{vacationPeriodsForYear.some(period => calendarDays(period.start, period.end) >= 15) ? '✓ Existe un periodo de al menos 15 días naturales consecutivos.' : 'Pendiente: debe existir al menos un periodo de 15 días naturales consecutivos.'}</div></section><div className="vacation-explanation"><b>Cómo se calcula el saldo</b><p>En {annualYear} corresponden {vacationEntitlement.toLocaleString('es-ES')} días naturales, prorrateados desde el inicio del contrato. Cada periodo descuenta los días naturales comprendidos entre su fecha inicial y final. Una semana completa consume 7 días y marca automáticamente las {contractualDaysPerWeek} jornadas contractuales comprendidas.</p></div><div className="annual-table"><div className="annual-table-head"><span>Mes</span><span>Previstas</span><span>Trabajadas</span><span>Bajas</span><span>Vacaciones</span></div>{annualMonths.map(month => <div className="annual-table-row" key={month.month}><strong>{month.label}</strong><span>{month.planned}</span><span>{month.worked}</span><span>{month.sick}</span><span>{month.vacation}</span></div>)}</div></section>}

        {activeView === 'documents' && <section className="app-view"><div className="view-head"><div><span>ARCHIVO</span><h2>Documentos</h2><p>Contrato oficial, recibos salariales y documentos internos.</p></div></div><div className="document-grid"><article><b>SEPE</b><h3>Contrato oficial cumplimentado</h3><p>Genera una copia con marca de borrador para comprobar todos los datos.</p><button disabled={!contractReady} onClick={() => generateContract(false)}>Descargar borrador</button></article><article><b>SEPE</b><h3>Modelo oficial original</h3><p>Consulta el formulario en la web del organismo.</p><a className="document-link" href="https://www.sepe.es/NuevoSepe/contratos-trabajo/indefinido/Contrato-indefinido.pdf" target="_blank" rel="noreferrer">Ver original ↗</a></article><article><b>PDF</b><h3>Recibo de {monthLabel(attendanceMonth)}</h3><p>{payrollPrepared ? 'Disponible tras cerrar la asistencia' : 'Cierra primero la asistencia del mes'}</p><button disabled={!payrollPrepared} onClick={generateReceipt}>Descargar</button></article><article><b>PDF</b><h3>Ficha interna</h3><p>Estimaciones y registros de gestión.</p><button onClick={generateManagementSheet}>Descargar</button></article></div></section>}
      </div>
    </section>

    {contractWizard && <div className="modal-backdrop" role="presentation" onMouseDown={() => setContractWizard(false)}>
      <section className="edit-modal contract-wizard" role="dialog" aria-modal="true" aria-labelledby="contract-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>PASO {wizardStep} DE 4</span><h2 id="contract-title">{wizardStep === 1 ? 'Datos de las partes' : wizardStep === 2 ? 'Jornada y salario' : wizardStep === 3 ? 'Condiciones del contrato' : 'Revisar borrador'}</h2></div><button aria-label="Cerrar" onClick={() => setContractWizard(false)}>×</button></div>
        <div className="steps four"><i className="done" /><i className={wizardStep >= 2 ? 'done' : ''} /><i className={wizardStep >= 3 ? 'done' : ''} /><i className={wizardStep >= 4 ? 'done' : ''} /></div>
        {wizardStep === 1 && <div className="wizard-fields"><h3>Persona empleadora</h3><div className="field-row"><label>Nombre y apellidos<input value={draft.employerName} onChange={e => setDraft({ ...draft, employerName: e.target.value })} /></label><label>DNI/NIE<input value={draft.employerDni} onChange={e => setDraft({ ...draft, employerDni: e.target.value })} /></label></div><label>Domicilio (calle y número)<input value={draft.employerAddress} onChange={e => setDraft({ ...draft, employerAddress: e.target.value })} /></label><div className="field-row"><label>Municipio<input value={draft.employerMunicipality} onChange={e => setDraft({ ...draft, employerMunicipality: e.target.value })} /></label><label>Código postal<input inputMode="numeric" value={draft.employerPostcode} onChange={e => setDraft({ ...draft, employerPostcode: e.target.value })} /></label></div><label>Código de cuenta de cotización<input value={draft.contributionAccount} onChange={e => setDraft({ ...draft, contributionAccount: e.target.value })} placeholder="11 dígitos, sin espacios" /></label><h3>Persona trabajadora</h3><div className="field-row"><label>Nombre y apellidos<input value={draft.employeeName} onChange={e => setDraft({ ...draft, employeeName: e.target.value })} /></label><label>DNI/NIE<input value={draft.employeeDni} onChange={e => setDraft({ ...draft, employeeDni: e.target.value })} /></label></div><div className="field-row"><label>Fecha de nacimiento<input type="date" value={draft.employeeBirthDate} onChange={e => setDraft({ ...draft, employeeBirthDate: e.target.value })} /></label><label>Nacionalidad<input value={draft.employeeNationality} onChange={e => setDraft({ ...draft, employeeNationality: e.target.value })} /></label></div><label>Número de la Seguridad Social<input value={draft.employeeNss} onChange={e => setDraft({ ...draft, employeeNss: e.target.value })} /></label><label>Domicilio (calle y número)<input value={draft.employeeAddress} onChange={e => setDraft({ ...draft, employeeAddress: e.target.value })} /></label><div className="field-row"><label>Municipio del domicilio<input value={draft.employeeMunicipality} onChange={e => setDraft({ ...draft, employeeMunicipality: e.target.value })} /></label><label>Código postal<input inputMode="numeric" value={draft.employeePostcode} onChange={e => setDraft({ ...draft, employeePostcode: e.target.value })} /></label></div><div className="privacy-note">Datos guardados solo en este navegador. No se envían a una base de datos.</div></div>}
        {wizardStep === 2 && <div className="wizard-fields"><label>Fecha de inicio<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label><div className="field-row"><label>Horas semanales pactadas<input type="number" min="0.5" max="40" step="0.5" value={draft.weeklyHours} onChange={e => setDraft({ ...draft, weeklyHours: Number(e.target.value) })} /></label><label>Salario bruto por hora (€)<input type="number" min="0.01" step="0.01" value={draft.hourlyRate} onChange={e => setDraft({ ...draft, hourlyRate: Number(e.target.value) })} /></label></div><label>Domicilio donde se presta el servicio<input type="text" value={draft.workAddress} onChange={e => setDraft({ ...draft, workAddress: e.target.value })} placeholder="Calle y número" /></label><div className="field-row"><label>Municipio del centro de trabajo<input value={draft.workMunicipality} onChange={e => setDraft({ ...draft, workMunicipality: e.target.value })} /></label><label>Código postal<input inputMode="numeric" value={draft.workPostcode} onChange={e => setDraft({ ...draft, workPostcode: e.target.value })} /></label></div><h3>Horario semanal</h3>{draft.scheduleEntries.map((entry, index) => <div className="schedule-row" key={`${index}-${entry.day}`}><select aria-label={`Día ${index + 1}`} value={entry.day} onChange={e => updateSchedule(index, { day: e.target.value })}>{['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(day => <option key={day}>{day}</option>)}</select><input aria-label={`Hora de inicio ${index + 1}`} type="time" value={entry.start} onChange={e => updateSchedule(index, { start: e.target.value })} /><span>a</span><input aria-label={`Hora de fin ${index + 1}`} type="time" value={entry.end} onChange={e => updateSchedule(index, { end: e.target.value })} /><button type="button" aria-label={`Eliminar ${entry.day}`} onClick={() => removeSchedule(index)}>×</button></div>)}<button type="button" className="add-schedule" onClick={addSchedule}>+ Añadir otro día</button><div className={`schedule-total ${draftHoursMatch ? 'valid' : 'invalid'}`}><span>Horario calculado: <b>{draftScheduleHours.toLocaleString('es-ES')} h</b></span><span>Jornada pactada: <b>{draft.weeklyHours.toLocaleString('es-ES')} h</b></span><small>{draftHoursMatch ? '✓ Las horas coinciden' : 'El horario debe sumar exactamente la jornada pactada para continuar.'}</small></div><div className="estimate"><span>Salario bruto mensual</span><strong>{euro(draft.hourlyRate * draft.weeklyHours * 52 / 12)}</strong><small>Se recalcula automáticamente: salario/hora × horas semanales × 52 ÷ 12</small></div></div>}
        {wizardStep === 3 && <div className="wizard-fields"><div className="field-row"><label>Día habitual de pago<input type="number" min="1" max="31" value={draft.paymentDay} onChange={e => setDraft({ ...draft, paymentDay: Number(e.target.value) })} /></label><label>Periodo de prueba<select value={draft.hasTrialPeriod ? 'yes' : 'no'} onChange={e => setDraft({ ...draft, hasTrialPeriod: e.target.value === 'yes', trialPeriod: e.target.value === 'yes' ? Math.max(draft.trialPeriod, 1) : 0 })}><option value="no">No se establece</option><option value="yes">Sí se establece</option></select></label></div>{draft.hasTrialPeriod && <label>Duración del periodo de prueba (días)<input type="number" min="1" max="60" value={draft.trialPeriod} onChange={e => setDraft({ ...draft, trialPeriod: Number(e.target.value) })} /></label>}<label>Pagas extraordinarias<select value="prorated" disabled><option value="prorated">Prorrateadas en 12 mensualidades</option></select></label><div className="field-row"><label>Lugar de firma<input value={draft.signaturePlace} onChange={e => setDraft({ ...draft, signaturePlace: e.target.value })} placeholder="Ej.: Madrid" /></label><label>Fecha de firma<input type="date" value={draft.signatureDate} onChange={e => setDraft({ ...draft, signatureDate: e.target.value })} /></label></div><div className="info-box">Contrato indefinido a tiempo parcial, en régimen externo, sin pernocta ni tiempos de presencia. Si la relación ya existía, se recomienda no establecer un nuevo periodo de prueba.</div></div>}
        {wizardStep === 4 && <div className="review-grid"><div><span>Empleador</span><strong>{draft.employerName || 'Pendiente'}</strong></div><div><span>Persona trabajadora</span><strong>{draft.employeeName || 'Pendiente'}</strong></div><div><span>Fecha de inicio</span><strong>{formatDate(draft.startDate)}</strong></div><div><span>Jornada semanal</span><strong>{draft.weeklyHours} horas</strong></div><div><span>Salario bruto mensual</span><strong>{euro(draft.hourlyRate * draft.weeklyHours * 52 / 12)}</strong></div><div><span>Periodo de prueba</span><strong>{draft.hasTrialPeriod ? `${draft.trialPeriod} días` : 'No se establece'}</strong></div><p>Se generará un contrato de dos páginas. La ficha interna de gestión permanecerá separada y no formará parte del documento firmado.</p></div>}
        <div className="modal-actions wizard-actions">{wizardStep > 1 ? <button onClick={() => setWizardStep(wizardStep - 1)}>Atrás</button> : <button onClick={() => setContractWizard(false)}>Cancelar</button>}<button className="primary" disabled={wizardStep === 2 && !draftHoursMatch} onClick={() => wizardStep < 4 ? setWizardStep(wizardStep + 1) : saveWizard()}>{wizardStep < 4 ? 'Continuar' : 'Guardar borrador'}</button></div>
      </section>
    </div>}

    <section className="receipt"><h1>Recibo individual justificativo del pago de salarios</h1><p><b>Periodo:</b> 1–31 de agosto de 2026</p><div className="parties"><p><b>Empleador</b><br />{contract.employerName || 'Pendiente'}</p><p><b>Persona trabajadora</b><br />{contract.employeeName || 'Pendiente'}</p></div><table><tbody><tr><td>Salario base estimado</td><td>{euro(salary)}</td></tr><tr><td>Aportación trabajadora a la Seguridad Social (estimada)</td><td>− {euro(deduction)}</td></tr><tr><td><b>Líquido total a percibir</b></td><td><b>{euro(net)}</b></td></tr></tbody></table><small>Documento de prueba. Revisa las cuantías y deducciones aplicables antes de entregarlo.</small></section>
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </main>;
}

function Title({ title, action, note, onClick }: { title: string; action?: string; note?: string; onClick?: () => void }) { return <div className="title"><h2>{title}</h2>{action ? <button onClick={onClick}>{action}</button> : <span>{note}</span>}</div>; }
function Task({ day, month, title, detail, calm, onClick }: { day: string; month: string; title: string; detail: string; calm?: boolean; onClick: () => void }) { return <article><time className={calm ? 'calm' : ''}><b>{day}</b>{month}</time><p><strong>{title}</strong><small>{detail}</small></p><button onClick={onClick}>Recordarme</button></article>; }
