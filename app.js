// ============================================================================
// GESTOR DE HORARIOS INTELIGENTE - MOTOR MANAGER PRO V8 (SÁBADOS CORREGIDOS)
// ============================================================================

const employees = [
    { name: 'Valen', target: 30 }, { name: 'Susana', target: 40 },
    { name: 'María', target: 40 }, { name: 'Julián', target: 40 },
    { name: 'Isa', target: 40 },   { name: 'Carmen', target: 40 }
];
const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const templates = {
    1: { satGroup: ['Julián', 'Carmen'] },
    2: { satGroup: ['Isa', 'María'] },
    3: { satGroup: ['Valen', 'Susana'] }
};

let activeMobileShift = null;
const STORAGE_KEY = 'supermercado_horarios_v1';

// ============================================================================
// 1. FUNCIONES DE EXPORTACIÓN
// ============================================================================

window.prepareExport = function() {
    const section = document.getElementById('export-section');
    section.classList.add('exporting');
    return section;
};

window.finishExport = function() {
    const section = document.getElementById('export-section');
    section.classList.remove('exporting');
};

window.downloadImage = function() {
    const element = window.prepareExport();
    setTimeout(() => {
        html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true }).then(canvas => {
            let link = document.createElement('a');
            link.download = 'Cuadrante_Semanal.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            window.finishExport();
        });
    }, 100);
};

window.downloadPDF = function() {
    const element = window.prepareExport();
    setTimeout(() => {
        const opt = {
            margin: 10,
            filename: 'Cuadrante_Semanal.pdf',
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, backgroundColor: "#ffffff" },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save().then(() => window.finishExport());
    }, 100);
};

// ============================================================================
// 2. CLASE SHIFT Y FORMATEADORES VISUALES
// ============================================================================

class Shift {
    constructor() {
        this.status = "Libre";
        this.mStart = null; this.mEnd = null;
        this.aStart = null; this.aEnd = null;
    }

    setSpecial(status) { this.status = status; this.mStart = null; this.mEnd = null; this.aStart = null; this.aEnd = null; }
    addMorning(s, e) { this.status = "Trabajando"; this.mStart = s; this.mEnd = e; }
    addAfternoon(s, e) { this.status = "Trabajando"; this.aStart = s; this.aEnd = e; }
    removeMorning() { this.mStart = null; this.mEnd = null; if (this.aStart === null) this.status = "Libre"; }

    getHours() {
        if (this.status !== "Trabajando") return 0;
        let h = 0;
        if (this.mStart !== null) h += (this.mEnd - this.mStart);
        if (this.aStart !== null) h += (this.aEnd - this.aStart);
        return h;
    }

    toString() {
        if (this.status !== "Trabajando") return this.status;
        const fmt = n => `${String(Math.floor(n)).padStart(2,'0')}:${String(Math.round((n-Math.floor(n))*60)).padStart(2,'0')}`;
        let p = [];
        if (this.mStart !== null) p.push(`${fmt(this.mStart)}-${fmt(this.mEnd)}`);
        if (this.aStart !== null) p.push(`${fmt(this.aStart)}-${fmt(this.aEnd)}`);
        return p.length ? p.join(", ") : "Libre";
    }

    toHTML() {
        if (this.status === "Libre") return `<div class="shift-block libre">Libre</div>`;
        if (this.status === "Festivo") return `<div class="shift-block festivo">Festivo</div>`;
        if (this.status === "Baja") return `<div class="shift-block baja">Baja Médica</div>`;

        const fmt = n => `${String(Math.floor(n)).padStart(2,'0')}:${String(Math.round((n-Math.floor(n))*60)).padStart(2,'0')}`;
        let html = '<div class="shift-container">';
        if (this.mStart !== null) html += `<div class="shift-block morning">${fmt(this.mStart)}-${fmt(this.mEnd)}</div>`;
        if (this.aStart !== null) html += `<div class="shift-block afternoon">${fmt(this.aStart)}-${fmt(this.aEnd)}</div>`;
        return html + '</div>';
    }

    static fromString(shiftStr) {
        let s = new Shift();
        if (!shiftStr || shiftStr.includes("Libre")) return s;
        if (shiftStr.includes("Festivo")) { s.setSpecial("Festivo"); return s; }
        if (shiftStr.includes("Baja")) { s.setSpecial("Baja"); return s; }

        const matches = shiftStr.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g);
        if (matches) {
            s.status = "Trabajando";
            matches.forEach(match => {
                const [st, en] = match.split('-');
                const [sH, sM] = st.trim().split(':').map(Number);
                const [eH, eM] = en.trim().split(':').map(Number);
                let startDec = sH + (sM / 60);
                let endDec = eH + (eM / 60);

                if (startDec < 15.0) { s.mStart = startDec; s.mEnd = endDec; }
                else { s.aStart = startDec; s.aEnd = endDec; }
            });
        }
        return s;
    }
}

// ============================================================================
// 3. SISTEMA DE GUARDADO (PERSISTENCIA)
// ============================================================================

function saveScheduleLocally() {
    let rawData = {};
    employees.forEach(emp => {
        rawData[emp.name] = {};
        days.forEach(day => {
            const htmlCell = document.querySelector(`td[data-emp="${emp.name}"][data-day="${day}"]`);
            let textVals = Array.from(htmlCell.querySelectorAll('.shift-block')).map(b => b.innerText);
            rawData[emp.name][day] = textVals.length > 0 ? textVals.join(", ") : htmlCell.innerText.trim();
        });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rawData));
    const status = document.getElementById('save-status');
    status.classList.add('show');
    setTimeout(() => status.classList.remove('show'), 2000);
}

function loadScheduleLocally() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    try {
        const rawData = JSON.parse(saved);
        employees.forEach(emp => {
            days.forEach(day => {
                const shiftObj = Shift.fromString(rawData[emp.name][day]);
                document.querySelector(`td[data-emp="${emp.name}"][data-day="${day}"]`).innerHTML = shiftObj.toHTML();
            });
        });
        return true;
    } catch (e) { return false; }
}

// ============================================================================
// 4. EL CEREBRO DE GENERACIÓN MATEMÁTICO (V8 - SIN SÁBADOS MAÑANA)
// ============================================================================

window.generateStandard = function() { window.generateSmartSchedule(); };

window.applyVariablesAndGenerate = function() {
    const festivo = document.getElementById('selFestivo').value;
    const baja = document.getElementById('selBaja').value;
    window.generateSmartSchedule(festivo, baja);
    window.closeModal();
};

window.generateSmartSchedule = function(holiday = null, sickEmp = null) {
    let grid = {};
    employees.forEach(e => { grid[e.name] = {}; days.forEach(d => grid[e.name][d] = new Shift()); });
    const isAvail = (name, day) => grid[name][day].status === "Libre";
    const getHours = (name) => days.reduce((sum, d) => sum + grid[name][d].getHours(), 0);

    const weekType = Math.floor(Math.random() * 3) + 1;
    const t = templates[weekType];

    // FASE 1: BAJAS/FESTIVOS
    if (sickEmp) days.forEach(d => grid[sickEmp][d].setSpecial("Baja"));
    if (holiday) employees.forEach(e => grid[e.name][holiday].setSpecial("Festivo"));

    // FASE 2: TARDES (BLINDAJE DE 3 PERSONAS Y SÁBADOS)
    let aftCounts = { Valen:0, Susana:0, María:0, Julián:0, Isa:0, Carmen:0 };

    if (holiday !== 'sabado') {
        t.satGroup.forEach(emp => {
            if (isAvail(emp, 'sabado')) { grid[emp]['sabado'].addAfternoon(16.0, 21.5); aftCounts[emp]++; }
        });
    }

    const weekdays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].filter(d => d !== holiday);
    weekdays.forEach(day => {
        let needed = 3;
        if (weekType === 3 && day === 'lunes' && isAvail('Valen', day)) {
            grid['Valen'][day].addAfternoon(17.0, 21.5); aftCounts['Valen']++; needed--;
        }
        let cands = ['Susana', 'María', 'Julián', 'Isa', 'Carmen'].filter(e => isAvail(e, day));
        cands.sort((a, b) => aftCounts[a] - aftCounts[b]);

        for (let i = 0; i < needed && i < cands.length; i++) {
            let emp = cands[i];
            if (emp === 'Isa') grid[emp][day].addAfternoon(17.0, 20.0);
            else if (emp === 'Susana') grid[emp][day].addAfternoon(18.5, 21.5);
            else grid[emp][day].addAfternoon(17.0, 21.5);
            aftCounts[emp]++;
        }
    });

    // FASE 3: MAÑANAS BASE (SÓLO DE LUNES A VIERNES)
    if (holiday !== 'viernes') {
        ['Susana', 'María', 'Julián', 'Isa', 'Carmen'].forEach(emp => {
            if (grid[emp]['viernes'].status !== "Baja" && grid[emp]['viernes'].status !== "Festivo") {
                if (emp === 'Isa') grid[emp]['viernes'].addMorning(8.0, 13.5); else grid[emp]['viernes'].addMorning(8.0, 14.0);
            }
        });
    }

    // ELIMINADA LA ASIGNACIÓN DE SÁBADO MAÑANA.

    ['lunes', 'martes', 'miercoles', 'jueves'].filter(d => d !== holiday).forEach(day => {
        if (grid['Valen'][day].status !== "Baja" && grid['Valen'][day].status !== "Festivo" && grid['Valen'][day].aStart === null) grid['Valen'][day].addMorning(8.0, 14.0);
        ['Susana', 'María', 'Julián', 'Isa', 'Carmen'].forEach(emp => {
            if (grid[emp][day].status !== "Baja" && grid[emp][day].status !== "Festivo") {
                if (emp === 'Isa') grid[emp][day].addMorning(8.0, 13.5); else grid[emp][day].addMorning(8.0, 14.0);
            }
        });
    });

    // FASE 4: AMPUTACIONES
    employees.forEach(emp => {
        let diff = emp.target - getHours(emp.name);
        let failsafe = 10;
        while (diff <= -4.0 && failsafe > 0) {
            failsafe--; let trimmed = false;
            for (let day of weekdays) { if (grid[emp.name][day].mStart !== null && grid[emp.name][day].aStart !== null && day !== 'viernes') { grid[emp.name][day].removeMorning(); trimmed = true; break; } }
            if (!trimmed) { for (let day of weekdays) { if (grid[emp.name][day].mStart !== null && grid[emp.name][day].aStart === null && day !== 'viernes') { grid[emp.name][day].removeMorning(); trimmed = true; break; } } }
            diff = emp.target - getHours(emp.name);
        }
    });

    // FASE 5: MICRO-AJUSTES (EVITANDO TOCAR EL SÁBADO)
    for (let loop = 0; loop < 150; loop++) {
        let allPerfect = true;
        employees.forEach(emp => {
            if (emp.name === sickEmp) return;
            let diff = emp.target - getHours(emp.name);
            if (Math.abs(diff) < 0.1) return;
            allPerfect = false;

            let checkDays = [...days];
            if (Math.random() > 0.5) checkDays.reverse();

            for (let day of checkDays) {
                if (day === 'sabado') continue; // Sábado es intocable

                let s = grid[emp.name][day];
                if (s.status !== "Trabajando") continue;

                if (diff >= 0.5) {
                    if (s.mStart !== null && s.mEnd < 15.5) { s.mEnd += 0.5; diff -= 0.5; break; }
                    if (s.aStart !== null && s.aStart > 16.0) { s.aStart -= 0.5; diff -= 0.5; break; }
                } else if (diff <= -0.5) {
                    if (s.mStart !== null && s.mEnd > 11.0) { s.mEnd -= 0.5; diff += 0.5; break; }
                    if (s.aStart !== null && s.aStart < 19.5) { s.aStart += 0.5; diff += 0.5; break; }
                }
            }
        });
        if (allPerfect) break;
    }

    // FASE 6: RENDERIZADO
    employees.forEach(e => {
        days.forEach(d => {
            document.querySelector(`td[data-emp="${e.name}"][data-day="${d}"]`).innerHTML = grid[e.name][d].toHTML();
        });
    });

    calculateAndValidate();
};

// ============================================================================
// 5. UI, AUDITORÍA Y EVENTOS
// ============================================================================

window.openModal = function() { document.getElementById('varModal').classList.remove('hidden'); };
window.closeModal = function() { document.getElementById('varModal').classList.add('hidden'); };

window.clearTable = function() {
    const emptyHTML = new Shift().toHTML();
    document.querySelectorAll('td.dropzone').forEach(td => td.innerHTML = emptyHTML);
    calculateAndValidate();
};

window.calculateAndValidate = function() {
    let html = '<h3>Auditoría de Tienda en Tiempo Real</h3>';
    let coverage = { lunes:{m:0,a:0}, martes:{m:0,a:0}, miercoles:{m:0,a:0}, jueves:{m:0,a:0}, viernes:{m:0,a:0}, sabado:{m:0,a:0} };

    employees.forEach(emp => {
        let empTotal = 0;
        days.forEach(day => {
            const htmlCell = document.querySelector(`td[data-emp="${emp.name}"][data-day="${day}"]`);
            let textVals = Array.from(htmlCell.querySelectorAll('.shift-block')).map(b => b.innerText);
            let shiftStr = textVals.length > 0 ? textVals.join(", ") : htmlCell.innerText.trim();

            let shiftObj = Shift.fromString(shiftStr);
            empTotal += shiftObj.getHours();

            if (shiftObj.mStart !== null) coverage[day].m++;
            if (shiftObj.aStart !== null) coverage[day].a++;
        });

        const totalCell = document.getElementById(`total-${emp.name}`);
        totalCell.innerText = empTotal.toFixed(1) + 'h';
        totalCell.classList.remove('over-hours', 'perfect-hours');

        const diff = empTotal - emp.target;
        if (Math.abs(diff) < 0.1) totalCell.classList.add('perfect-hours');
        else if (diff > 0.1) {
            totalCell.classList.add('over-hours');
            html += `<div class="rule"><span class="badge fail">PASA</span> <span>${emp.name}: +${diff.toFixed(1)}h extra</span></div>`;
        } else if (diff < -0.1) {
            totalCell.style.color = "#d97706";
            html += `<div class="rule"><span class="badge warn">FALTA</span> <span>${emp.name}: -${Math.abs(diff).toFixed(1)}h</span></div>`;
        }
    });

    days.forEach(day => {
        const covCell = document.getElementById(`cov-${day}`);
        covCell.innerHTML = `<span class="cov-m">${coverage[day].m} Mñn</span><br><span class="cov-a">${coverage[day].a} Tar</span>`;
    });

    html += '<hr style="border-top:1px solid #e2e8f0; margin:15px 0;">';

    days.forEach(day => {
        let isFestivo = false;
        employees.forEach(emp => {
            const cell = document.querySelector(`td[data-emp="${emp.name}"][data-day="${day}"]`);
            if (cell.innerText.includes("Festivo")) isFestivo = true;
        });

        if (isFestivo) {
            html += `<div class="rule"><span class="badge warn">FESTIVO</span> <span>${day.toUpperCase()}: Cerrado</span></div>`;
        } else {
            const target = day === 'sabado' ? 2 : 3;
            const isOk = coverage[day].a === target;
            html += `<div class="rule"><span class="badge ${isOk ? 'ok' : 'fail'}">${isOk ? 'OK' : 'ERR'}</span> 
                     <span>${day.toUpperCase()}: ${coverage[day].a} tardes (Obj: ${target})</span></div>`;
        }
    });

    document.getElementById('validations').innerHTML = html;
    saveScheduleLocally();
};

function setupInteractions() {
    const pills = document.querySelectorAll('.shift-pill');
    const dropzones = document.querySelectorAll('.dropzone');

    pills.forEach(pill => {
        pill.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', pill.getAttribute('data-shift')));
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('selected'));
            pill.classList.add('selected');
            activeMobileShift = pill.getAttribute('data-shift');
        });
    });

    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            let rawStr = e.dataTransfer.getData('text/plain');
            zone.innerHTML = Shift.fromString(rawStr).toHTML();
            calculateAndValidate();
        });
        zone.addEventListener('click', () => {
            if (activeMobileShift) {
                zone.innerHTML = Shift.fromString(activeMobileShift).toHTML();
                calculateAndValidate();
            }
        });

        zone.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                zone.innerHTML = new Shift().toHTML();
                calculateAndValidate();
            }
        });

        zone.addEventListener('dblclick', (e) => {
            e.preventDefault();
            zone.innerHTML = new Shift().toHTML();
            calculateAndValidate();
        });

        zone.addEventListener('blur', () => {
            let text = zone.innerText.trim();
            if (text === "") {
                zone.innerHTML = new Shift().toHTML();
                calculateAndValidate();
            } else if (!zone.innerHTML.includes('shift-block')) {
                zone.innerHTML = Shift.fromString(text).toHTML();
                calculateAndValidate();
            }
        });
    });
}

function initTable() {
    const tbody = document.querySelector('#scheduleTable tbody');
    tbody.innerHTML = '';
    const emptyHTML = new Shift().toHTML();

    employees.forEach(emp => {
        const tr = document.createElement('tr');
        let tds = `<td><strong>${emp.name}</strong></td><td style="color:var(--primary); font-weight:bold;">${emp.target}h</td>`;
        days.forEach(day => tds += `<td class="dropzone" tabindex="0" contenteditable="true" data-emp="${emp.name}" data-day="${day}">${emptyHTML}</td>`);
        tds += `<td class="hours-col" id="total-${emp.name}">0.0h</td>`;
        tr.innerHTML = tds;
        tbody.appendChild(tr);
    });

    setupInteractions();
    if (!loadScheduleLocally()) calculateAndValidate();
    else calculateAndValidate();
}

document.addEventListener('DOMContentLoaded', initTable);