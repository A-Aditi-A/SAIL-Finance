/* ============================================================
   AuraFinance — Full App Script
   Features: Tab switching, Scooty Calculator, Budget Planner,
   Cooking/Nutrition tools, Daily Log Calendar with localStorage,
   12-Month Savings Calendar with localStorage
   ============================================================ */

// ─── STORAGE HELPERS ──────────────────────────────────────────
const STORAGE_KEYS = {
    DAILY_LOG:      'aura_daily_log',       // { "2026-06-05": {food,travel,misc,other,note} }
    SAVINGS_MONTHS: 'aura_savings_months',  // { "2026-06": true, ... }
    ROUTINE:        'aura_routine',
};

function loadData(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ─── GLOBAL STATE ─────────────────────────────────────────────
let dailyLog     = loadData(STORAGE_KEYS.DAILY_LOG);
let savingsMonths= loadData(STORAGE_KEYS.SAVINGS_MONTHS);
const DEFAULT_TIMES = {
    breakfast: '09:00',
    lunch: '13:30',
    munch: '15:30',
    dinner: '20:30'
};
let mealTimes = loadData(STORAGE_KEYS.ROUTINE);
if (Object.keys(mealTimes).length === 0 || Array.isArray(mealTimes)) {
    mealTimes = DEFAULT_TIMES;
}

// Calendar view state
const today = new Date();
let calViewYear  = today.getFullYear();
let calViewMonth = today.getMonth(); // 0-indexed

// Modal state
let modalDateKey = null; // "YYYY-MM-DD"

// ─── DOM READY ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initTabs();
    initSidebarToggle();
    initTracker();
    initRoutine();
    initDailyLog();
    initSavingsCalendar();
    initModal();
});

// ============================================================
// TAB SWITCHING
// ============================================================
const TAB_META = {
    tracker:  { title: 'Scooty Fund Tracker',            subtitle: 'Track your ₹8,000 monthly savings target & Ludhiana expenses' },
    dailylog: { title: 'Daily Log & Savings Calendar',   subtitle: 'Log daily costs by category and mark saved months' },
    cooking:  { title: 'Kettle Cooking Hacks',           subtitle: 'Safe, healthy, no-stove meals designed for a busy desk job' },
    nutrition:{ title: 'Daily Routine Planner',          subtitle: 'Schedule your day and let the app remind you what to eat/do' },
    ludhiana: { title: 'Ludhiana Survival & Shopping Guide', subtitle: 'Practical shopping hacks for fixed-price dairy & local bargains' },
};

function initTabs() {
    const navItems    = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabTitle    = document.getElementById('tab-title');
    const tabSubtitle = document.getElementById('tab-subtitle');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.tab;
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(c => c.classList.remove('active'));
            const sec = document.getElementById(target);
            if (sec) sec.classList.add('active');
            if (TAB_META[target]) {
                tabTitle.textContent    = TAB_META[target].title;
                tabSubtitle.textContent = TAB_META[target].subtitle;
            }
            // Re-render calendar when switching to it
            if (target === 'dailylog') {
                renderCalendar();
                renderBreakdown();
                renderSavingsCalendar();
            }
        });
    });
}

// ============================================================
// TAB 1 — SCOOTY FUND TRACKER & BUDGET
// ============================================================
// No fixed model list — user enters their own target amount

function initTracker() {
    const targetInput    = document.getElementById('target-amount');
    const interestInput  = document.getElementById('interest-rate');
    const spendPgIn      = document.getElementById('spend-pg');
    const spendFoodIn    = document.getElementById('spend-food');
    const spendTravelIn  = document.getElementById('spend-travel');
    const spendMiscIn    = document.getElementById('spend-misc');
    const resetBtn       = document.getElementById('reset-budget-btn');

    targetInput.addEventListener('input', calcScooty);
    interestInput.addEventListener('input', calcScooty);
    spendPgIn.addEventListener('input', calcBudget);
    spendFoodIn.addEventListener('input', calcBudget);
    spendTravelIn.addEventListener('input', calcBudget);
    spendMiscIn.addEventListener('input', calcBudget);
    resetBtn.addEventListener('click', () => {
        spendPgIn.value = 6000; spendFoodIn.value = 2500; spendTravelIn.value = 1500; spendMiscIn.value = 2320;
        calcBudget();
    });

    calcScooty();
    calcBudget();
    updateRingFromSavings(); // sync ring with savings calendar
}

function calcScooty() {
    const target  = parseFloat(document.getElementById('target-amount').value) || 100000;
    const rate    = parseFloat(document.getElementById('interest-rate').value) || 0;
    const P = 8000, n = 12, i = rate / 100 / 12;
    const fund    = i === 0 ? P * n : P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    const rounded = Math.round(fund);

    document.getElementById('est-scooty-cost').textContent = `₹${target.toLocaleString('en-IN')}`;
    document.getElementById('projected-fund').textContent  = `₹${rounded.toLocaleString('en-IN')}`;

    const diff = rounded - target;
    const fb   = document.getElementById('calculator-feedback');
    if (diff >= 0) {
        fb.innerHTML = `<span class="badge badge-success">Goal Achieved!</span>
        <p>You have a surplus of <strong>₹${diff.toLocaleString('en-IN')}</strong>.
        Covers your first helmet, registration &amp; initial fuel!</p>`;
    } else {
        const needed = Math.ceil(target / 12);
        fb.innerHTML = `<span class="badge badge-warning">Shortfall Identified</span>
        <p>Short by <strong>₹${Math.abs(diff).toLocaleString('en-IN')}</strong>.
        To hit your goal in 12 months, save <strong>₹${needed.toLocaleString('en-IN')}/month</strong> instead.</p>`;
    }
}

function calcBudget() {
    const pg     = parseFloat(document.getElementById('spend-pg').value)     || 0;
    const food   = parseFloat(document.getElementById('spend-food').value)   || 0;
    const travel = parseFloat(document.getElementById('spend-travel').value) || 0;
    const misc   = parseFloat(document.getElementById('spend-misc').value)   || 0;
    const total  = pg + food + travel + misc;
    document.getElementById('total-actual-spend').textContent = `₹${total.toLocaleString('en-IN')}`;
    setRowStatus('status-pg',     6000 - pg);
    setRowStatus('status-food',   2500 - food);
    setRowStatus('status-travel', 1500 - travel);
    setRowStatus('status-misc',   2320 - misc);
    const diff = 12320 - total;
    document.getElementById('budget-overall-status').innerHTML =
        diff >= 0 ? `<span class="badge badge-success">On Budget (+₹${diff})</span>`
                  : `<span class="badge badge-danger">Over Budget (-₹${Math.abs(diff)})</span>`;
}

function setRowStatus(id, diff) {
    const el = document.getElementById(id);
    if (!el) return;
    if (diff > 0)       el.innerHTML = `<span class="status-badge status-on-track">+₹${diff} Saved</span>`;
    else if (diff === 0) el.innerHTML = `<span class="status-badge status-fixed">Exact</span>`;
    else                el.innerHTML = `<span class="status-badge status-danger">-₹${Math.abs(diff)} Over</span>`;
}

// Sync the radial ring on Tab 1 from saved months
function updateRingFromSavings() {
    const savedCount    = Object.keys(savingsMonths).length;
    const totalSaved    = savedCount * 8000;
    const pct           = Math.min(100, Math.round((savedCount / 12) * 100));
    const ring          = document.getElementById('savings-progress-ring');
    const circumference = 2 * Math.PI * 40;
    ring.style.strokeDasharray  = `${circumference} ${circumference}`;
    ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
    document.getElementById('progress-percentage').textContent  = `${pct}%`;
    document.getElementById('current-saved-val').textContent    = `₹${totalSaved.toLocaleString('en-IN')}`;
}

// Removed Tab 3 Nutrition logic (protein planner) as requested.
// Removed Tab 4 Egg Checker logic as requested.

// ============================================================
// TAB 5 — DAILY LOG & CALENDAR
// ============================================================
function initDailyLog() {
    document.getElementById('cal-prev-month').addEventListener('click', () => {
        calViewMonth--;
        if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
        renderCalendar();
        renderBreakdown();
    });
    document.getElementById('cal-next-month').addEventListener('click', () => {
        calViewMonth++;
        if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
        renderCalendar();
        renderBreakdown();
    });
    renderCalendar();
    renderBreakdown();
}

function dateKey(year, month, day) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function monthKey(year, month) {
    return `${year}-${String(month+1).padStart(2,'0')}`;
}

function renderCalendar() {
    const grid       = document.getElementById('calendar-grid');
    const titleEl    = document.getElementById('cal-month-title');
    const summaryEl  = document.getElementById('cal-month-spend-summary');
    grid.innerHTML   = '';

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    titleEl.textContent = `${MONTHS[calViewMonth]} ${calViewYear}`;

    const firstDay   = new Date(calViewYear, calViewMonth, 1).getDay(); // 0=Sun
    const daysInMonth= new Date(calViewYear, calViewMonth+1, 0).getDate();

    // Compute monthly total for subtitle
    let monthTotal = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const entry = dailyLog[dateKey(calViewYear, calViewMonth, d)];
        if (entry) monthTotal += (entry.food||0)+(entry.travel||0)+(entry.misc||0)+(entry.other||0);
    }
    summaryEl.textContent = `₹${monthTotal.toLocaleString('en-IN')} spent this month`;

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'cal-day empty-cell';
        grid.appendChild(blank);
    }

    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    for (let d = 1; d <= daysInMonth; d++) {
        const key   = dateKey(calViewYear, calViewMonth, d);
        const entry = dailyLog[key];
        const dayTotal = entry ? (entry.food||0)+(entry.travel||0)+(entry.misc||0)+(entry.other||0) : 0;

        const cell = document.createElement('div');
        cell.className = 'cal-day';

        // Today
        if (key === todayKey) cell.classList.add('day-today');

        // Future days (can't log yet)
        const cellDate = new Date(calViewYear, calViewMonth, d);
        if (cellDate > today) {
            cell.classList.add('day-future');
        } else {
            if (entry && dayTotal > 0) {
                cell.classList.add('day-has-data');
                if (dayTotal > 200) cell.classList.add('day-over-budget');
            }
            cell.addEventListener('click', () => openModal(key, d));
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'day-num';
        numSpan.textContent = d;
        cell.appendChild(numSpan);

        if (entry && dayTotal > 0) {
            const spendSpan = document.createElement('span');
            spendSpan.className = 'day-spend';
            spendSpan.textContent = `₹${dayTotal}`;
            cell.appendChild(spendSpan);
        }

        grid.appendChild(cell);
    }
}

function renderBreakdown() {
    const daysInMonth = new Date(calViewYear, calViewMonth+1, 0).getDate();
    let totals = { food:0, travel:0, misc:0, other:0 };

    for (let d = 1; d <= daysInMonth; d++) {
        const entry = dailyLog[dateKey(calViewYear, calViewMonth, d)];
        if (entry) {
            totals.food   += entry.food   || 0;
            totals.travel += entry.travel || 0;
            totals.misc   += entry.misc   || 0;
            totals.other  += entry.other  || 0;
        }
    }

    const grandTotal = totals.food + totals.travel + totals.misc + totals.other;
    const BUDGET = 6000;
    const remaining = BUDGET - grandTotal;

    document.getElementById('breakdown-total').textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
    const remEl = document.getElementById('breakdown-remaining');
    remEl.textContent = `₹${Math.abs(remaining).toLocaleString('en-IN')}${remaining < 0 ? ' Over!' : ''}`;
    remEl.className = remaining >= 0 ? 'text-success' : 'text-danger';
    if (!remEl.classList.contains('text-danger')) remEl.style.color = '';
    else remEl.style.color = 'var(--accent-rose)';

    const cats = [
        { key:'food',   label:'Food & Groceries',  color:'#f59e0b', icon:'shopping-bag', budget:2500 },
        { key:'travel', label:'Travel & Commute',   color:'#818cf8', icon:'bus',          budget:1500 },
        { key:'misc',   label:'Misc / Treats',      color:'#06b6d4', icon:'smile',        budget:2000 },
        { key:'other',  label:'Other / One-time',   color:'#ef4444', icon:'package',      budget:500  },
    ];

    const barsEl = document.getElementById('breakdown-bars');
    barsEl.innerHTML = '';
    cats.forEach(c => {
        const pct = Math.min(100, grandTotal > 0 ? Math.round((totals[c.key]/c.budget)*100) : 0);
        barsEl.innerHTML += `
        <div class="breakdown-bar-item">
            <div class="breakdown-bar-header">
                <span class="cat-name"><i data-lucide="${c.icon}"></i>${c.label}</span>
                <span>₹${totals[c.key].toLocaleString('en-IN')} <span style="color:var(--text-muted)">/ ₹${c.budget.toLocaleString('en-IN')}</span></span>
            </div>
            <div class="breakdown-bar-track">
                <div class="breakdown-bar-fill" style="width:${pct}%; background:${pct>=100?'var(--accent-rose)':c.color}"></div>
            </div>
        </div>`;
    });
    lucide.createIcons();
}

// ============================================================
// MODAL — DAY ENTRY
// ============================================================
function initModal() {
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeModal();
    });
    document.getElementById('modal-save-btn').addEventListener('click', saveModalEntry);
    document.getElementById('modal-clear-btn').addEventListener('click', clearModalEntry);
}

function openModal(key, dayNum) {
    modalDateKey = key;
    const entry = dailyLog[key] || {};
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('modal-date-title').textContent = `${dayNum} ${MONTHS[calViewMonth]} ${calViewYear}`;
    document.getElementById('modal-food').value   = entry.food   || '';
    document.getElementById('modal-travel').value = entry.travel || '';
    document.getElementById('modal-misc').value   = entry.misc   || '';
    document.getElementById('modal-other').value  = entry.other  || '';
    document.getElementById('modal-note').value   = entry.note   || '';
    document.getElementById('modal-overlay').classList.add('open');
    lucide.createIcons();
    document.getElementById('modal-food').focus();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    modalDateKey = null;
}

function saveModalEntry() {
    if (!modalDateKey) return;
    const food   = parseFloat(document.getElementById('modal-food').value)   || 0;
    const travel = parseFloat(document.getElementById('modal-travel').value) || 0;
    const misc   = parseFloat(document.getElementById('modal-misc').value)   || 0;
    const other  = parseFloat(document.getElementById('modal-other').value)  || 0;
    const note   = document.getElementById('modal-note').value.trim();

    if (food + travel + misc + other === 0 && !note) {
        delete dailyLog[modalDateKey];
    } else {
        dailyLog[modalDateKey] = { food, travel, misc, other, note };
    }
    saveData(STORAGE_KEYS.DAILY_LOG, dailyLog);
    closeModal();
    renderCalendar();
    renderBreakdown();
}

function clearModalEntry() {
    if (!modalDateKey) return;
    delete dailyLog[modalDateKey];
    saveData(STORAGE_KEYS.DAILY_LOG, dailyLog);
    closeModal();
    renderCalendar();
    renderBreakdown();
}

// ============================================================
// 12-MONTH SAVINGS CALENDAR
// ============================================================
// The 12 months always start from June 2026 (when Aditi starts)
const SAVINGS_START = { year: 2026, month: 5 }; // June = month index 5

function initSavingsCalendar() {
    renderSavingsCalendar();
}

function renderSavingsCalendar() {
    const grid = document.getElementById('savings-months-grid');
    grid.innerHTML = '';
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let savedCount = 0;

    for (let i = 0; i < 12; i++) {
        let m = SAVINGS_START.month + i;
        let y = SAVINGS_START.year + Math.floor(m / 12);
        m = m % 12;
        const mk      = `${y}-${String(m+1).padStart(2,'0')}`;
        const isSaved = !!savingsMonths[mk];
        const tileDate= new Date(y, m, 1);
        const isFuture= tileDate > new Date(today.getFullYear(), today.getMonth(), 1);

        if (isSaved) savedCount++;

        const tile = document.createElement('div');
        tile.className = 'savings-month-tile';
        if (isSaved)   tile.classList.add('tile-saved');
        if (isFuture)  tile.classList.add('tile-future');

        tile.innerHTML = `
            <div class="month-label">${MONTH_SHORT[m]}<br><span style="font-weight:400;opacity:0.7">${y}</span></div>
            <div class="month-amount">₹8,000</div>
            <i data-lucide="check-circle" class="tile-check"></i>`;

        if (!isFuture) {
            tile.addEventListener('click', () => toggleSavingsMonth(mk));
        }
        grid.appendChild(tile);
    }

    lucide.createIcons();

    // Update totals
    const total     = savedCount * 8000;
    const P = 8000, n = savedCount, iRate = 0.065/12;
    const projected = n === 0 ? 0 : Math.round(P * ((Math.pow(1+iRate,n)-1)/iRate)*(1+iRate));
    const remaining = Math.max(0, 96000 - total);

    document.getElementById('savings-months-done').textContent       = `${savedCount} / 12`;
    document.getElementById('savings-confirmed-total').textContent   = `₹${total.toLocaleString('en-IN')}`;
    document.getElementById('savings-projected-total').textContent   = `₹${projected.toLocaleString('en-IN')}`;
    document.getElementById('savings-remaining-goal').textContent    = `₹${remaining.toLocaleString('en-IN')}`;

    // Sync Tab 1 radial ring
    updateRingFromSavings();
}

function toggleSavingsMonth(mk) {
    if (savingsMonths[mk]) delete savingsMonths[mk];
    else savingsMonths[mk] = true;
    saveData(STORAGE_KEYS.SAVINGS_MONTHS, savingsMonths);
    renderSavingsCalendar();
}

// ============================================================
// TAB 3 — ROUTINE PLANNER & REMINDERS
// ============================================================
function initRoutine() {
    document.getElementById('save-meal-times-btn').addEventListener('click', saveMealTimes);
    document.getElementById('toast-close').addEventListener('click', closeToast);
    
    // Load inputs
    document.getElementById('time-breakfast').value = mealTimes.breakfast || DEFAULT_TIMES.breakfast;
    document.getElementById('time-lunch').value = mealTimes.lunch || DEFAULT_TIMES.lunch;
    document.getElementById('time-munch').value = mealTimes.munch || DEFAULT_TIMES.munch;
    document.getElementById('time-dinner').value = mealTimes.dinner || DEFAULT_TIMES.dinner;

    // Check reminders every minute
    setInterval(checkReminders, 60000);
    // Check immediately on load
    checkReminders();
}

function saveMealTimes() {
    mealTimes.breakfast = document.getElementById('time-breakfast').value;
    mealTimes.lunch = document.getElementById('time-lunch').value;
    mealTimes.munch = document.getElementById('time-munch').value;
    mealTimes.dinner = document.getElementById('time-dinner').value;
    saveData(STORAGE_KEYS.ROUTINE, mealTimes);
    
    // show a temporary success on button
    const btn = document.getElementById('save-meal-times-btn');
    btn.textContent = 'Saved!';
    btn.classList.replace('btn-primary', 'btn-secondary');
    setTimeout(() => {
        btn.textContent = 'Save Meal Times';
        btn.classList.replace('btn-secondary', 'btn-primary');
    }, 2000);
}

let lastTriggeredTime = null;
function checkReminders() {
    const now = new Date();
    const currentH = String(now.getHours()).padStart(2, '0');
    const currentM = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentH}:${currentM}`;
    
    if (lastTriggeredTime === currentTime) return;

    const MEAL_MESSAGES = {
        breakfast: "Time for Breakfast! (Kettle Eggs + Soaked Oats/Poha)",
        lunch: "Time for Lunch! (Solid Meal / Bulked Suji Upma)",
        munch: "Time for The Munch! (Roasted Chana, Makhana, Power Refresh Drink)",
        dinner: "Time for Dinner! (Sprouts Chaat / Masala Oats)"
    };

    let dueMeals = [];
    for (const [meal, time] of Object.entries(mealTimes)) {
        if (time === currentTime) {
            dueMeals.push(MEAL_MESSAGES[meal]);
        }
    }

    if (dueMeals.length > 0) {
        showToast("Meal Reminder 🍽️", dueMeals.join(' | '));
        lastTriggeredTime = currentTime;
    }
}

function showToast(title, message) {
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    document.getElementById('reminder-toast').classList.add('show');
    
    // Auto hide after 15 seconds
    setTimeout(closeToast, 15000);
}


function closeToast() {
    document.getElementById('reminder-toast').classList.remove('show');
}

// ============================================================
// SIDEBAR COLLAPSE / EXPAND
// ============================================================
function initSidebarToggle() {
    const sidebar     = document.getElementById('sidebar');
    const main        = document.querySelector('.main-content');
    const collapseBtn = document.getElementById('sidebar-toggle-btn');
    const expandBtn   = document.getElementById('sidebar-expand-btn');

    // Restore saved state
    const isCollapsed = localStorage.getItem('aura_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        main.classList.add('expanded');
        expandBtn.style.opacity = '1';
        expandBtn.style.pointerEvents = 'auto';
    }

    collapseBtn.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        main.classList.add('expanded');
        expandBtn.style.opacity = '1';
        expandBtn.style.pointerEvents = 'auto';
        localStorage.setItem('aura_sidebar_collapsed', 'true');
        // Re-render lucide icons so they stay sharp after transition
        setTimeout(() => lucide.createIcons(), 310);
    });

    expandBtn.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        main.classList.remove('expanded');
        expandBtn.style.opacity = '0';
        expandBtn.style.pointerEvents = 'none';
        localStorage.setItem('aura_sidebar_collapsed', 'false');
        setTimeout(() => lucide.createIcons(), 310);
    });
}


function renderAnalytics(){
 if(typeof dailyLog==='undefined') return;

 let food=0,travel=0,misc=0,other=0;

 const body=document.getElementById('analytics-body');
 if(body) body.innerHTML='';

 Object.keys(dailyLog).sort().forEach(date=>{
   const e=dailyLog[date]||{};
   food += e.food||0;
   travel += e.travel||0;
   misc += e.misc||0;
   other += e.other||0;

   if(body){
      const total=(e.food||0)+(e.travel||0)+(e.misc||0)+(e.other||0);
      body.innerHTML += `<tr>
      <td>${date}</td>
      <td>₹${e.food||0}</td>
      <td>₹${e.travel||0}</td>
      <td>₹${e.misc||0}</td>
      <td>₹${e.other||0}</td>
      <td>₹${total}</td>
      <td>${e.note||''}</td>
      </tr>`;
   }
 });

 const total=food+travel+misc+other;

 const set=(id,val)=>{
   const el=document.getElementById(id);
   if(el) el.textContent='₹'+val.toLocaleString('en-IN');
 };

 set('analytics-total',total);
 set('analytics-food',food);
 set('analytics-travel',travel);
 set('analytics-misc',misc);

 const canvas=document.getElementById('analyticsCategoryChart');
 if(canvas && typeof Chart!=='undefined'){
   new Chart(canvas,{
      type:'pie',
      data:{
        labels:['Food','Travel','Misc','Other'],
        datasets:[{data:[food,travel,misc,other]}]
      }
   });
 }
}

document.addEventListener('DOMContentLoaded',()=>{
 setTimeout(renderAnalytics,1000);
});

function renderAnalyticsV2(){
 if(typeof dailyLog==='undefined') return;

 const monthly={};
 let food=0,travel=0,misc=0,other=0;

 Object.keys(dailyLog).forEach(date=>{
   const e=dailyLog[date]||{};
   const month=date.slice(0,7);

   if(!monthly[month]) monthly[month]={food:0,travel:0,misc:0,other:0};

   monthly[month].food += e.food||0;
   monthly[month].travel += e.travel||0;
   monthly[month].misc += e.misc||0;
   monthly[month].other += e.other||0;

   food += e.food||0;
   travel += e.travel||0;
   misc += e.misc||0;
   other += e.other||0;
 });

 const tbody=document.getElementById('monthly-summary-body');
 if(tbody){
   tbody.innerHTML='';
   Object.keys(monthly).sort().forEach(m=>{
      const x=monthly[m];
      const t=x.food+x.travel+x.misc+x.other;
      tbody.innerHTML += `<tr><td>${m}</td><td>₹${x.food}</td><td>₹${x.travel}</td><td>₹${x.misc}</td><td>₹${x.other}</td><td>₹${t}</td></tr>`;
   });
 }

 const body=document.getElementById('analytics-body');
 if(body){
   body.innerHTML='';
   Object.keys(dailyLog).sort().reverse().forEach(date=>{
      const e=dailyLog[date]||{};
      const total=(e.food||0)+(e.travel||0)+(e.misc||0)+(e.other||0);
      body.innerHTML += `<tr><td>${date}</td><td>${e.food||0}</td><td>${e.travel||0}</td><td>${e.misc||0}</td><td>${e.other||0}</td><td>${total}</td><td>${e.note||''}</td></tr>`;
   });
 }

 const total=food+travel+misc+other;
 const cats={Food:food,Travel:travel,Misc:misc,Other:other};
 const largest=Object.keys(cats).sort((a,b)=>cats[b]-cats[a])[0];

 const set=(id,val)=>{const e=document.getElementById(id); if(e) e.textContent=val;}
 set('analytics-total','₹'+total.toLocaleString('en-IN'));
 set('analytics-largest',largest);
 set('analytics-average','₹'+Math.round(total/Math.max(Object.keys(dailyLog).length,1)));
 set('analytics-remaining','₹'+Math.max(0,6000-total));

 if(document.getElementById('analyticsCategoryChart') && typeof Chart!=='undefined'){
   new Chart(document.getElementById('analyticsCategoryChart'),{
    type:'pie',
    data:{labels:['Food','Travel','Misc','Other'],datasets:[{data:[food,travel,misc,other]}]}
   });
 }
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(renderAnalyticsV2,1200));


/* Buffer support placeholder */
// Buffer removed

const MONTHLY_META_KEY='monthly_meta';
let monthlyMeta=JSON.parse(localStorage.getItem(MONTHLY_META_KEY)||'{}');

function initMonthlyMeta(){
 const btn=document.getElementById('save-monthly-meta');
 if(!btn) return;
 const filter=document.getElementById('analytics-month-filter');
 const month=(filter&&filter.value&&filter.value!='all')?filter.value:new Date().toISOString().slice(0,7);
 const data=monthlyMeta[month]||{};
 const inc=document.getElementById('monthly-extra-income');
 const note=document.getElementById('monthly-note');
 if(inc) inc.value=data.extraIncome||0;
 if(note) note.value=data.note||'';
 btn.onclick=function(){
   const activeMonth=((document.getElementById('analytics-month-filter')?.value)||new Date().toISOString().slice(0,7));
   monthlyMeta[activeMonth]={extraIncome:Number(inc.value||0),bonus:Number(inc.value||0),note:note.value||''};
   localStorage.setItem(MONTHLY_META_KEY,JSON.stringify(monthlyMeta));
   if(typeof renderFinanceAnalyticsV2==='function') renderFinanceAnalyticsV2();
   if(typeof renderAnalyticsV2==='function') renderAnalyticsV2();
   const bal=document.getElementById('finance-balance-display');
   if(bal){
      const salary=Number((window.appSettings && appSettings.salary) || 20320);
      const expenses=0;
      bal.textContent='Balance: ₹'+(salary+Number(inc.value||0)-expenses).toLocaleString('en-IN');
   }
   alert('Saved');
 };
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(initMonthlyMeta,1500));


/* Finance Dashboard Integration */
function renderFinanceAnalyticsV2(){
    try{
        const salary = Number((window.appSettings && appSettings.salary) || 20320);

        const month = (document.getElementById('analytics-month-filter')?.value || '').trim();

        let expenses = 0;
        if(typeof dailyLog !== 'undefined'){
            Object.keys(dailyLog).forEach(date=>{
                if(!month || month==='all' || date.startsWith(month)){
                    const e = dailyLog[date] || {};
                    expenses += (e.food||0)+(e.travel||0)+(e.misc||0)+(e.other||0);
                }
            });
        }

        let extraIncome = 0;
        try{
            const meta = JSON.parse(localStorage.getItem(MONTHLY_META_KEY) || '{}');
            if(month && month !== 'all' && meta[month]){
                extraIncome = Number(meta[month].extraIncome || 0);
            }
        }catch(e){}

        const totalIncome = salary + extraIncome;
        const balance = totalIncome - expenses;

        const cards = document.querySelectorAll('.stat-card .value');
        if(cards.length >= 4){
            cards[0].textContent = '₹' + expenses.toLocaleString('en-IN');
            cards[1].textContent = '₹' + totalIncome.toLocaleString('en-IN');
            cards[3].textContent = '₹' + balance.toLocaleString('en-IN');
        }

        const bal = document.getElementById('finance-balance-display');
        if(bal) bal.textContent = 'Balance: ₹' + balance.toLocaleString('en-IN');

    }catch(err){console.log(err);}
}

document.addEventListener('DOMContentLoaded',()=>{
    setInterval(renderFinanceAnalyticsV2,1000);
});


// Added fixes: month filter population and buffer inclusion in analytics balance
function populateAnalyticsMonthFilter(){
 const filter=document.getElementById('analytics-month-filter');
 if(!filter || typeof dailyLog==='undefined') return;
 const months=[...new Set(Object.keys(dailyLog).map(d=>String(d).slice(0,7)))].sort().reverse();
 filter.innerHTML='<option value="all">All Months</option>'+months.map(m=>`<option value="${m}">${m}</option>`).join('');
 filter.onchange=function(){
   if(typeof renderAnalyticsV2==='function') renderAnalyticsV2();
   if(typeof renderFinanceAnalyticsV2==='function') renderFinanceAnalyticsV2();
   initMonthlyMeta();
 };
}

document.addEventListener('DOMContentLoaded',()=>{
 setTimeout(populateAnalyticsMonthFilter,1200);
});

