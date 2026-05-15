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

// =========================================
//          CALCULADORA DE HORAS
// =========================================
function parseHours(shiftStr) {
    if (!shiftStr || shiftStr === "Libre" || shiftStr === "Festivo" || shiftStr === "Baja") return 0;
    let total = 0;
    const matches = shiftStr.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/g);
    if (matches) {
        matches.forEach(match => {
            const [start, end] = match.split('-');
            const [sH, sM] = start.trim().split(':').map(Number);
            const [eH, eM] = end.trim().split(':').map(Number);
            total += ((eH + eM/60) - (sH + sM/60));
        });
    }
    return total;
}

// =========================================
// ALGORITMO INTELIGENTE DE GENERACIÓN
// =========================================
function generateStandard() { generateSmartSchedule(); }
function applyVariablesAndGenerate() {
    const festivo = document.getElementById('selFestivo').value;
    const baja = document.getElementById('selBaja').value;
    generateSmartSchedule(festivo, baja);
    closeModal();
}

function generateSmartSchedule(holiday = null, sickEmp = null) {
    clearTable();
    const weekType = Math.floor(Math.random() * 3) + 1;
    const t = templates[weekType];

    let grid = {};
    employees.forEach(e => { grid[e.name] = {}; days.forEach(d => grid[e.name][d] = "Libre"); });

    // 1. Aplicar Variables Críticas (Festivo y Baja)
    if (sickEmp) days.forEach(d => grid[sickEmp][d] = "Baja");
    if (holiday) employees.forEach(e => grid[e.name][holiday] = "Festivo");

    const isAvail = (emp, day) => grid[emp][day] === "Libre";

    // 2. Reglas Fijas y de Estructura
    if (isAvail('Isa', 'viernes')) grid['Isa']['viernes'] = "08:00-13:30";

    // Sábado: Tarde para el grupo, Mañana para uno al azar que esté disponible
    if (holiday !== 'sabado') {
        t.satGroup.forEach(emp => { if (isAvail(emp, 'sabado')) grid[emp]['sabado'] = "16:00-21:30"; });
        let sabMornCand = employees.filter(e => isAvail(e.name, 'sabado') && e.name !== 'Valen'); // Valen no hace sabado mañana normal
        if (sabMornCand.length > 0) {
            let lucky = sabMornCand[Math.floor(Math.random() * sabMornCand.length)];
            grid[lucky.name]['sabado'] = "08:00-14:00";
        }
    }

    // Viernes Camión: Todos a las 8 (menos Valen, baja o festivo)
    if (holiday !== 'viernes') {
        employees.forEach(e => {
            if (e.name !== 'Valen' && isAvail(e.name, 'viernes')) grid[e.name]['viernes'] = "08:00-14:00";
        });
    }

    // Valen (Semana normal o semana 3)
    days.forEach(day => {
        if (!isAvail('Valen', day)) return;
        if (weekType === 3 && day === 'lunes') grid['Valen'][day] = "17:00-21:30";
        else if (day !== 'sabado') grid['Valen'][day] = "08:00-14:00";
    });

    // Isa y Susana reglas base
    days.forEach(day => {
        if (day !== 'sabado' && day !== 'viernes') {
            if (isAvail('Isa', day)) grid['Isa'][day] = "08:00-13:30, 17:00-20:00";
            if (isAvail('Susana', day)) grid['Susana'][day] = "08:00-14:00, 18:30-21:30"; // Partimos de turno partido
        }
    });

    // 3. RELLENADOR INTELIGENTE (Busca acercarse a 40/30h)
    const getTempHours = (empName) => {
        let total = 0; days.forEach(d => total += parseHours(grid[empName][d])); return total;
    };

    const workableDays = ['lunes', 'martes', 'miercoles', 'jueves'].filter(d => d !== holiday);

    // Rellenar tardes restantes para llegar al objetivo (3 personas L-J)
    workableDays.forEach(day => {
        let aftCount = 0;
        employees.forEach(e => { if(grid[e.name][day].includes("16:") || grid[e.name][day].includes("17:") || grid[e.name][day].includes("18:")) aftCount++; });

        let needed = 3 - aftCount;
        let candidates = ['Julián', 'María', 'Carmen'].filter(name => isAvail(name, day));

        // ORDENAR: El que necesite más horas va primero
        candidates.sort((a,b) => (40 - getTempHours(a)) - (40 - getTempHours(b)));

        for(let i=0; i<needed && i<candidates.length; i++) {
            grid[candidates[i]][day] = "16:00-21:30";
        }
    });

    // Rellenar mañanas para cuadrar horas
    employees.forEach(emp => {
        if (emp.name === sickEmp) return;
        workableDays.forEach(day => {
            if (isAvail(emp.name, day)) {
                let neededHours = emp.target - getTempHours(emp.name);
                if (neededHours >= 5) {
                    grid[emp.name][day] = "08:00-14:00";
                }
            }
        });
    });

    // 4. Escribir en la tabla visual
    employees.forEach(e => {
        days.forEach(d => {
            document.querySelector(`td[data-emp="${e.name}"][data-day="${d}"]`).innerText = grid[e.name][d];
        });
    });

    calculateAndValidate();
}

function calculateAndValidate() {
    // 1. Mostrar Horas
    employees.forEach(emp => {
        let empTotal = 0;
        days.forEach(day => {
            const cell = document.querySelector(`td[data-emp="${emp.name}"][data-day="${day}"]`);
            empTotal += parseHours(cell.innerText);
        });
        const totalCell = document.getElementById(`total-${emp.name}`);
        totalCell.innerText = empTotal.toFixed(1) + 'h';

        totalCell.classList.remove('over-hours', 'perfect-hours');
        if (Math.abs(empTotal - emp.target) <= 1.5) totalCell.classList.add('perfect-hours');
        else if (Math.abs(empTotal - emp.target) > 4) totalCell.classList.add('over-hours');
    });

    // 2. Panel de Validación
    const panel = document.getElementById('validations');
    let html = '<h3>Auditoría de Reglas</h3>';

    days.forEach(day => {
        let afternoonCount = 0;
        let isFestivo = false;
        employees.forEach(emp => {
            const text = document.querySelector(`td[data-emp="${emp.name}"][data-day="${day}"]`).innerText;
            if (text === "Festivo") isFestivo = true;
            if (text.match(/1[6-9]:\d{2}|2[0-1]:\d{2}/)) afternoonCount++;
        });

        if (isFestivo) {
            html += `<div class="rule"><span class="badge warn">FESTIVO</span> <span>${day.toUpperCase()}: Tienda Cerrada</span></div>`;
        } else {
            const target = day === 'sabado' ? 2 : 3;
            const isOk = afternoonCount === target;
            html += `<div class="rule"><span class="badge ${isOk ? 'ok' : 'fail'}">${isOk ? 'OK' : 'ERR'}</span> 
                     <span>${day.toUpperCase()}: ${afternoonCount} de tarde (Objetivo: ${target})</span></div>`;
        }
    });
    panel.innerHTML = html;
}