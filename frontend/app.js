const API_URL = (location.protocol === 'http:' || location.protocol === 'https:')
    ? `${location.origin}/api`
    : 'http://127.0.0.1:8000/api';
let incomeChart = null;
let expenseChart = null;
let balanceChart = null;

let allTransactions = [];
let currentFilter = 'all';

// ====== Default Categories ======
const defaultCategories = {
    income: ['เงินเดือน', 'โบนัส', 'ธุรกิจส่วนตัว', 'การลงทุน', 'งานฟรีแลนซ์/งานเสริม', 'ของขวัญ/เงินช่วยเหลือ', 'รายรับอื่น ๆ'],
    expense: ['อาหารและเครื่องดื่ม', 'ค่าเดินทาง/ยานพาหนะ', 'ค่าที่อยู่อาศัย/ค่าเช่า', 'ค่าสาธารณูปโภค (น้ำ/ไฟ/เน็ต)', 'ช้อปปิ้ง/เสื้อผ้า', 'สุขภาพ/การแพทย์', 'การศึกษา', 'ความบันเทิง/ท่องเที่ยว', 'เงินออม/การลงทุน', 'รายจ่ายอื่น ๆ']
};

const defaultOwners = ['ฉัน', 'แฟน'];

const incomePalette = ['#1F7A5C', '#3D8B76', '#4A7C9B', '#6B8F71', '#8A9A7B', '#5B7C99', '#9CA3AF'];
const expensePalette = ['#C4504A', '#C47A4A', '#A67C52', '#7A6B8A', '#5B7C99', '#8B6B62', '#9CA3AF'];

function getHashColor(str, type) {
    const palette = type === 'income' ? incomePalette : expensePalette;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

function formatBaht(n, compact = false) {
    const num = Number(n) || 0;
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (compact) {
        if (abs >= 1000000) return `${sign}฿${(abs / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}M`;
        if (abs >= 1000) return `${sign}฿${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    }
    return sign + '฿' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function parseAmountInput(value) {
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!cleaned) return NaN;
    return parseFloat(cleaned);
}

function formatAmountInput(value) {
    let raw = String(value).replace(/,/g, '').replace(/[^\d.]/g, '');
    const firstDot = raw.indexOf('.');
    if (firstDot !== -1) {
        raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
    }
    if (raw === '' || raw === '.') return raw;

    const endsWithDot = raw.endsWith('.');
    const [intPart = '', decPart] = raw.split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (endsWithDot && decPart === undefined) return intFormatted + '.';
    if (decPart !== undefined) return intFormatted + '.' + decPart.slice(0, 2);
    return intFormatted;
}

function setupAmountInput() {
    const input = document.getElementById('amount');
    if (!input) return;

    input.addEventListener('input', () => {
        const cursor = input.selectionStart;
        const prev = input.value;
        const digitsBefore = prev.slice(0, cursor).replace(/\D/g, '').length;
        const next = formatAmountInput(prev);
        input.value = next;

        let seen = 0;
        let pos = next.length;
        for (let i = 0; i < next.length; i++) {
            if (/\d/.test(next[i])) {
                seen++;
                if (seen >= digitsBefore) {
                    pos = i + 1;
                    break;
                }
            }
        }
        if (prev.endsWith('.') && next.endsWith('.')) pos = next.length;
        input.setSelectionRange(pos, pos);
    });

    input.addEventListener('blur', () => {
        const n = parseAmountInput(input.value);
        if (Number.isFinite(n)) input.value = formatAmountInput(String(n));
    });
}

function refreshIcons() {
    if (window.lucide) lucide.createIcons();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function chipHtml(label, onClick) {
    return `<span class="chip">${escapeHtml(label)} <button type="button" class="chip-remove" title="ลบ" onclick="${onClick}"><i data-lucide="x"></i></button></span>`;
}

// ====== localStorage Helpers ======
function getCustomCategories() {
    return JSON.parse(localStorage.getItem('customCategories') || '{"income":[],"expense":[]}');
}

function saveCustomCategories(data) {
    localStorage.setItem('customCategories', JSON.stringify(data));
}

function getHiddenCategories() {
    return JSON.parse(localStorage.getItem('hiddenCategories') || '{"income":[],"expense":[]}');
}

function saveHiddenCategories(data) {
    localStorage.setItem('hiddenCategories', JSON.stringify(data));
}

function getCustomOwners() {
    return JSON.parse(localStorage.getItem('customOwners') || '[]');
}

function saveCustomOwners(data) {
    localStorage.setItem('customOwners', JSON.stringify(data));
}

function getHiddenOwners() {
    return JSON.parse(localStorage.getItem('hiddenOwners') || '[]');
}

function saveHiddenOwners(data) {
    localStorage.setItem('hiddenOwners', JSON.stringify(data));
}

function getAllCategories(type) {
    const custom = getCustomCategories();
    const hiddenDefaults = new Set((getHiddenCategories()[type] || []).filter(h => defaultCategories[type].includes(h)));
    const fromDB = new Set();
    allTransactions.forEach(t => {
        if (t.type === type && t.category) fromDB.add(t.category);
    });
    const defaultsVisible = defaultCategories[type].filter(c => !hiddenDefaults.has(c));
    return [...new Set([...defaultsVisible, ...(custom[type] || []), ...fromDB])];
}

function getAllOwners() {
    const custom = getCustomOwners();
    const hiddenDefaults = new Set(getHiddenOwners().filter(h => defaultOwners.includes(h)));
    const fromDB = new Set();
    allTransactions.forEach(t => {
        if (t.owner) fromDB.add(t.owner);
    });
    const defaultsVisible = defaultOwners.filter(o => !hiddenDefaults.has(o));
    return [...new Set([...defaultsVisible, ...custom, ...fromDB])];
}

async function bulkDelete({ type, category, owner } = {}) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    if (owner) params.set('owner', owner);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/expenses${qs ? '?' + qs : ''}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('bulk delete failed');
    return res.json();
}

// ====== Modal Controls ======
function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (id === 'categoryModal') renderCategoryChips();
    if (id === 'ownerModal') renderOwnerChips();
    if (id === 'transactionModal') updateDatalists();
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    closeAllMenus();
    if (!document.querySelector('.modal-overlay.active')) {
        document.body.style.overflow = '';
    }
}

// ====== Category Management (Modal) ======
function addCustomCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const typeSelect = document.getElementById('newCategoryType');
    const name = nameInput.value.trim();
    const type = typeSelect.value;

    if (!name) return;

    const hidden = getHiddenCategories();
    if ((hidden[type] || []).includes(name)) {
        hidden[type] = hidden[type].filter(c => c !== name);
        saveHiddenCategories(hidden);
    } else {
        const custom = getCustomCategories();
        if (!custom[type].includes(name) && !defaultCategories[type].includes(name)) {
            custom[type].push(name);
            saveCustomCategories(custom);
        }
    }

    nameInput.value = '';
    renderCategoryChips();
    updateDatalists();
}

async function removeCategory(type, encodedName) {
    const name = decodeURIComponent(encodedName);
    const related = allTransactions.filter(t => t.type === type && t.category === name);
    const msg = related.length
        ? `มี ${related.length} รายการในหมวดหมู่ "${name}" ต้องการลบหมวดหมู่และรายการที่เกี่ยวข้องหรือไม่?`
        : `ต้องการลบหมวดหมู่ "${name}" หรือไม่?`;
    if (!confirm(msg)) return;

    try {
        if (related.length) {
            await bulkDelete({ type, category: name });
        }

        const custom = getCustomCategories();
        custom[type] = (custom[type] || []).filter(c => c !== name);
        saveCustomCategories(custom);

        if (defaultCategories[type].includes(name)) {
            const hidden = getHiddenCategories();
            if (!hidden[type].includes(name)) hidden[type].push(name);
            saveHiddenCategories(hidden);
        }

        if (related.length) {
            await fetchTransactions();
        } else {
            renderCategoryChips();
            updateDatalists();
        }
    } catch (e) {
        console.error(e);
        alert('ไม่สามารถลบหมวดหมู่ได้');
    }
}

function renderCategoryChips() {
    const custom = getCustomCategories();

    const incomeContainer = document.getElementById('incomeCategoryChips');
    const incomeCats = getAllCategories('income');
    incomeContainer.innerHTML = incomeCats.length
        ? incomeCats.map(cat => chipHtml(cat, `removeCategory('income','${encodeURIComponent(cat)}')`)).join('')
        : '<p class="empty-hint">ยังไม่มีหมวดหมู่</p>';

    const expenseContainer = document.getElementById('expenseCategoryChips');
    const expenseCats = getAllCategories('expense');
    expenseContainer.innerHTML = expenseCats.length
        ? expenseCats.map(cat => chipHtml(cat, `removeCategory('expense','${encodeURIComponent(cat)}')`)).join('')
        : '<p class="empty-hint">ยังไม่มีหมวดหมู่</p>';

    incomeCats.forEach((cat, i) => {
        if (custom.income.includes(cat) && incomeContainer.children[i]) {
            incomeContainer.children[i].classList.add('chip-custom');
        }
    });
    expenseCats.forEach((cat, i) => {
        if (custom.expense.includes(cat) && expenseContainer.children[i]) {
            expenseContainer.children[i].classList.add('chip-custom');
        }
    });

    refreshIcons();
}

// ====== Owner Management (Modal) ======
function addCustomOwner() {
    const nameInput = document.getElementById('newOwnerName');
    const name = nameInput.value.trim();
    if (!name) return;

    const hidden = getHiddenOwners();
    if (hidden.includes(name)) {
        saveHiddenOwners(hidden.filter(o => o !== name));
    } else {
        const custom = getCustomOwners();
        if (!custom.includes(name) && !defaultOwners.includes(name)) {
            custom.push(name);
            saveCustomOwners(custom);
        }
    }

    nameInput.value = '';
    renderOwnerChips();
    updateDatalists();
    updateFilterButtons();
}

async function removeOwner(encodedName) {
    const name = decodeURIComponent(encodedName);
    const related = allTransactions.filter(t => t.owner === name);
    const msg = related.length
        ? `มี ${related.length} รายการของผู้ทำรายการ "${name}" ต้องการลบชื่อนี้และรายการที่เกี่ยวข้องหรือไม่?`
        : `ต้องการลบผู้ทำรายการ "${name}" หรือไม่?`;
    if (!confirm(msg)) return;

    try {
        if (related.length) {
            await bulkDelete({ owner: name });
        }

        saveCustomOwners(getCustomOwners().filter(o => o !== name));

        if (defaultOwners.includes(name)) {
            const hidden = getHiddenOwners();
            if (!hidden.includes(name)) hidden.push(name);
            saveHiddenOwners(hidden);
        }

        if (currentFilter === name) currentFilter = 'all';

        if (related.length) {
            await fetchTransactions();
        } else {
            renderOwnerChips();
            updateDatalists();
            updateFilterButtons();
        }
    } catch (e) {
        console.error(e);
        alert('ไม่สามารถลบผู้ทำรายการได้');
    }
}

function renderOwnerChips() {
    const container = document.getElementById('ownerChips');
    const owners = getAllOwners();
    const custom = getCustomOwners();

    if (!owners.length) {
        container.innerHTML = '<p class="empty-hint">ยังไม่มีผู้ทำรายการ</p>';
        refreshIcons();
        return;
    }

    container.innerHTML = owners.map(o => chipHtml(o, `removeOwner('${encodeURIComponent(o)}')`)).join('');
    owners.forEach((o, i) => {
        if (custom.includes(o) && container.children[i]) {
            container.children[i].classList.add('chip-custom');
        }
    });
    refreshIcons();
}

// ====== Custom dropdowns ======
function positionMenu(anchor, menu) {
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    menu.style.position = 'fixed';
    menu.style.left = `${Math.max(8, r.left)}px`;
    menu.style.width = `${r.width}px`;
    menu.style.right = 'auto';
    menu.style.maxHeight = '220px';

    const spaceBelow = window.innerHeight - r.bottom - gap;
    if (spaceBelow < 140 && r.top > spaceBelow) {
        menu.style.top = 'auto';
        menu.style.bottom = `${window.innerHeight - r.top + gap}px`;
    } else {
        menu.style.bottom = 'auto';
        menu.style.top = `${r.bottom + gap}px`;
    }
}

function closeAllMenus() {
    document.querySelectorAll('.combo.open, .select.open').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.combo-menu, .select-menu').forEach(menu => {
        menu.hidden = true;
    });
}

function setupCombo(root, getItems) {
    const input = root.querySelector('input');
    const menu = root.querySelector('.combo-menu');
    const chevron = root.querySelector('.combo-chevron');
    let activeIndex = -1;
    let suppressOpen = false;

    function filtered() {
        const q = input.value.trim().toLowerCase();
        const all = getItems();
        if (!q) return all;
        return all.filter(v => v.toLowerCase().includes(q));
    }

    function render() {
        const list = filtered();
        activeIndex = -1;
        if (!list.length) {
            const typed = input.value.trim();
            menu.innerHTML = typed
                ? `<li class="combo-empty">ใช้ “${escapeHtml(typed)}” เป็นค่าใหม่</li>`
                : `<li class="combo-empty">ยังไม่มีรายการ</li>`;
            return;
        }
        menu.innerHTML = list.map(v => `<li role="option">${escapeHtml(v)}</li>`).join('');
    }

    function open() {
        closeAllMenus();
        render();
        menu.hidden = false;
        root.classList.add('open');
        positionMenu(root, menu);
    }

    function close() {
        menu.hidden = true;
        root.classList.remove('open');
        activeIndex = -1;
    }

    function selectValue(value) {
        input.value = value;
        suppressOpen = true;
        close();
        input.focus();
        requestAnimationFrame(() => { suppressOpen = false; });
    }

    function moveActive(delta) {
        const items = [...menu.querySelectorAll('li:not(.combo-empty)')];
        if (!items.length) return;
        activeIndex = (activeIndex + delta + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    chevron.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (root.classList.contains('open')) close();
        else open();
    });

    input.addEventListener('focus', () => {
        if (!suppressOpen) open();
    });
    input.addEventListener('input', () => {
        if (!root.classList.contains('open')) open();
        else {
            render();
            positionMenu(root, menu);
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!root.classList.contains('open')) open();
            else moveActive(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (root.classList.contains('open')) moveActive(-1);
        } else if (e.key === 'Enter' && root.classList.contains('open')) {
            const items = [...menu.querySelectorAll('li:not(.combo-empty)')];
            if (activeIndex >= 0 && items[activeIndex]) {
                e.preventDefault();
                selectValue(items[activeIndex].textContent);
            }
        } else if (e.key === 'Escape') {
            close();
        }
    });

    menu.addEventListener('mousedown', (e) => {
        const li = e.target.closest('li');
        if (!li || li.classList.contains('combo-empty')) return;
        e.preventDefault();
        selectValue(li.textContent);
    });

    return { open, close };
}

function setupSelect(root) {
    const trigger = root.querySelector('.select-trigger');
    const menu = root.querySelector('.select-menu');
    const hidden = root.querySelector('input[type="hidden"]');
    const label = trigger.querySelector('span');

    function open() {
        closeAllMenus();
        menu.hidden = false;
        root.classList.add('open');
        positionMenu(root, menu);
    }

    function close() {
        menu.hidden = true;
        root.classList.remove('open');
    }

    function choose(li) {
        hidden.value = li.dataset.value;
        label.textContent = li.textContent;
        menu.querySelectorAll('li').forEach(item => {
            item.classList.toggle('is-selected', item === li);
        });
        close();
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (root.classList.contains('open')) close();
        else open();
    });

    menu.addEventListener('mousedown', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        e.preventDefault();
        choose(li);
    });
}

function updateDatalists() {}

function setupDropdowns() {
    setupCombo(document.getElementById('ownerCombo'), getAllOwners);
    setupCombo(document.getElementById('categoryCombo'), () => {
        const type = document.getElementById('transactionType').value;
        return getAllCategories(type);
    });
    setupSelect(document.getElementById('newCategoryTypeSelect'));

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.combo') && !e.target.closest('.select') && !e.target.closest('.combo-menu') && !e.target.closest('.select-menu')) {
            closeAllMenus();
        }
    });

    window.addEventListener('resize', closeAllMenus);
    document.querySelectorAll('.modal-card').forEach(card => {
        card.addEventListener('scroll', closeAllMenus, { passive: true });
    });
}

// ====== Dynamic Filter Buttons ======
function updateFilterButtons() {
    const container = document.getElementById('chartFilter');
    const owners = getAllOwners();

    if (currentFilter !== 'all' && !owners.includes(currentFilter)) {
        currentFilter = 'all';
    }

    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `filter-btn ${currentFilter === 'all' ? 'active' : ''}`;
    allBtn.textContent = 'ทั้งหมด';
    allBtn.addEventListener('click', () => setFilter('all'));
    container.appendChild(allBtn);

    owners.forEach(owner => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `filter-btn ${currentFilter === owner ? 'active' : ''}`;
        btn.textContent = owner;
        btn.addEventListener('click', () => setFilter(owner));
        container.appendChild(btn);
    });
}

function setFilter(value) {
    currentFilter = value;
    document.querySelectorAll('#chartFilter .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === (value === 'all' ? 'ทั้งหมด' : value));
    });
    renderPage();
}

// ====== Init ======
document.addEventListener('DOMContentLoaded', () => {
    setupChartDefaults();
    refreshIcons();
    setupTypeSelector();
    setupAmountInput();
    setupDropdowns();
    fetchTransactions();

    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.getElementById('transactionType').value;
        const owner = document.getElementById('transactionOwner').value.trim() || 'ฉัน';
        const title = document.getElementById('title').value;
        const amount = parseAmountInput(document.getElementById('amount').value);
        const category = document.getElementById('category').value.trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, owner, title, amount, category })
            });

            if (response.ok) {
                document.getElementById('expenseForm').reset();
                resetFormType();
                closeModal('transactionModal');
                fetchTransactions();
            } else {
                alert('เกิดข้อผิดพลาดในการเพิ่มรายการ');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        }
    });
});

function setupTypeSelector() {
    const btnExpense = document.getElementById('btnExpense');
    const btnIncome = document.getElementById('btnIncome');
    const hiddenType = document.getElementById('transactionType');
    const modalCard = document.getElementById('modalCard');

    btnExpense.addEventListener('click', () => {
        btnExpense.classList.add('active');
        btnIncome.classList.remove('active');
        hiddenType.value = 'expense';
        modalCard.className = 'modal-card theme-expense';
        closeAllMenus();
        updateDatalists();
    });

    btnIncome.addEventListener('click', () => {
        btnIncome.classList.add('active');
        btnExpense.classList.remove('active');
        hiddenType.value = 'income';
        modalCard.className = 'modal-card theme-income';
        closeAllMenus();
        updateDatalists();
    });
}

function resetFormType() {
    document.getElementById('btnExpense').classList.add('active');
    document.getElementById('btnIncome').classList.remove('active');
    document.getElementById('transactionType').value = 'expense';
    document.getElementById('modalCard').className = 'modal-card theme-expense';
    document.getElementById('transactionOwner').value = '';
    updateDatalists();
}

// ====== Fetch & Render ======
async function fetchTransactions() {
    try {
        const response = await fetch(`${API_URL}/expenses`);
        allTransactions = await response.json();
        updateDatalists();
        updateFilterButtons();
        if (document.getElementById('categoryModal').classList.contains('active')) {
            renderCategoryChips();
        }
        if (document.getElementById('ownerModal').classList.contains('active')) {
            renderOwnerChips();
        }
        renderPage();
    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}

function renderPage() {
    const filtered = allTransactions.filter(t => currentFilter === 'all' || t.owner === currentFilter);
    updateSummary(filtered);
    updateTrendChart(filtered);
    updatePieCharts(filtered);
    renderTables(filtered);
}

function updateSummary(transactions) {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    document.getElementById('statIncome').textContent = formatBaht(income);
    document.getElementById('statExpense').textContent = formatBaht(expense);
    const balEl = document.getElementById('statBalance');
    balEl.textContent = formatBaht(balance);
    balEl.classList.toggle('income', balance > 0);
    balEl.classList.toggle('expense', balance < 0);
}

function renderTables(transactions) {
    const incomeList = document.getElementById('incomeList');
    const expenseList = document.getElementById('expenseList');
    incomeList.innerHTML = '';
    expenseList.innerHTML = '';

    let incomeCount = 0;
    let expenseCount = 0;

    transactions.forEach(t => {
        const date = new Date(t.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
        const tr = document.createElement('tr');
        const catColor = getHashColor(t.category, t.type);

        tr.innerHTML = `
            <td data-label="วันที่">${date}</td>
            <td data-label="ผู้บันทึก"><span class="badge-owner">${escapeHtml(t.owner || 'ฉัน')}</span></td>
            <td data-label="รายการ">${escapeHtml(t.title)}</td>
            <td data-label="หมวดหมู่"><span class="cat-cell"><span class="cat-dot" style="background:${catColor}"></span>${escapeHtml(t.category)}</span></td>
            <td data-label="จำนวน" class="amount ${t.type}">${formatBaht(t.amount)}</td>
            <td class="actions"><button type="button" class="delete-btn" title="ลบรายการ" onclick="deleteTransaction(${t.id})"><i data-lucide="trash-2"></i></button></td>
        `;
        if (t.type === 'income') {
            incomeList.appendChild(tr);
            incomeCount++;
        } else {
            expenseList.appendChild(tr);
            expenseCount++;
        }
    });

    if (!incomeCount) {
        incomeList.innerHTML = '<tr><td colspan="6" class="empty-row">ยังไม่มีรายการ</td></tr>';
    }
    if (!expenseCount) {
        expenseList.innerHTML = '<tr><td colspan="6" class="empty-row">ยังไม่มีรายการ</td></tr>';
    }

    const incBtn = document.getElementById('deleteAllIncomeBtn');
    const expBtn = document.getElementById('deleteAllExpenseBtn');
    if (incBtn) incBtn.disabled = incomeCount === 0;
    if (expBtn) expBtn.disabled = expenseCount === 0;

    refreshIcons();
}

async function deleteTransaction(id) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
    try {
        const res = await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
        if (res.ok) fetchTransactions();
        else alert('ไม่สามารถลบรายการได้');
    } catch (e) {
        console.error(e);
        alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
}

async function deleteAllByType(type) {
    const visible = allTransactions.filter(t => t.type === type && (currentFilter === 'all' || t.owner === currentFilter));
    if (!visible.length) return;

    const label = type === 'income' ? 'รายรับ' : 'รายจ่าย';
    if (!confirm(`ต้องการลบ${label}ที่แสดงอยู่ทั้งหมด (${visible.length} รายการ) หรือไม่?`)) return;

    try {
        const params = { type };
        if (currentFilter !== 'all') params.owner = currentFilter;
        await bulkDelete(params);
        await fetchTransactions();
    } catch (e) {
        console.error(e);
        alert('ไม่สามารถลบรายการได้');
    }
}

// ====== Charts ======
const doughnutCenterPlugin = {
    id: 'doughnutCenter',
    afterDraw(chart) {
        const opts = chart.config.options.plugins.doughnutCenter;
        if (!opts || !opts.text) return;
        const meta = chart.getDatasetMeta(0);
        const first = meta && meta.data[0];
        if (!first) return;
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#8A8A8A';
        ctx.font = '400 11px Kanit, sans-serif';
        ctx.fillText(opts.label || '', first.x, first.y - 9);
        ctx.fillStyle = '#1A1A1A';
        ctx.font = '500 14px Kanit, sans-serif';
        ctx.fillText(opts.text, first.x, first.y + 9);
        ctx.restore();
    }
};

function setupChartDefaults() {
    if (!window.Chart) return;
    if (!Chart.registry.plugins.get('doughnutCenter')) {
        Chart.register(doughnutCenterPlugin);
    }
    Chart.defaults.font.family = "'Kanit', 'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#8A8A8A';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.tooltip.backgroundColor = '#fff';
    Chart.defaults.plugins.tooltip.titleColor = '#1A1A1A';
    Chart.defaults.plugins.tooltip.bodyColor = '#1A1A1A';
    Chart.defaults.plugins.tooltip.borderColor = '#E8E8E6';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
}

function setEmptyState(canvasId, emptyId, isEmpty) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    if (canvas) canvas.style.display = isEmpty ? 'none' : 'block';
    if (empty) empty.classList.toggle('visible', isEmpty);
}

function buildTrendSeries(transactions) {
    const daily = {};
    transactions.forEach(t => {
        const d = t.date.split('T')[0];
        if (!daily[d]) daily[d] = { income: 0, expense: 0 };
        if (daily[d][t.type] !== undefined) daily[d][t.type] += t.amount;
    });

    const keys = Object.keys(daily).sort();
    if (keys.length >= 2) {
        const start = new Date(keys[0] + 'T00:00:00');
        const end = new Date(keys[keys.length - 1] + 'T00:00:00');
        const span = Math.round((end - start) / 86400000);

        if (span > 90) {
            const monthly = {};
            keys.forEach(d => {
                const k = d.slice(0, 7);
                if (!monthly[k]) monthly[k] = { income: 0, expense: 0 };
                monthly[k].income += daily[d].income;
                monthly[k].expense += daily[d].expense;
            });
            const months = Object.keys(monthly).sort();
            return {
                labels: months.map(k => {
                    const [y, m] = k.split('-');
                    return new Date(Number(y), Number(m) - 1).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                }),
                income: months.map(k => monthly[k].income),
                expense: months.map(k => monthly[k].expense),
                hint: 'รายเดือน'
            };
        }

        if (span <= 45) {
            for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, '0');
                const day = String(dt.getDate()).padStart(2, '0');
                const k = `${y}-${m}-${day}`;
                if (!daily[k]) daily[k] = { income: 0, expense: 0 };
            }
        }
    }

    const dates = Object.keys(daily).sort();
    return {
        labels: dates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })),
        income: dates.map(d => daily[d].income),
        expense: dates.map(d => daily[d].expense),
        hint: dates.length > 14 ? 'รายวัน' : ''
    };
}

function updateTrendChart(transactions) {
    const hint = document.getElementById('trendHint');
    if (balanceChart) {
        balanceChart.destroy();
        balanceChart = null;
    }

    if (!transactions.length) {
        setEmptyState('balanceChart', 'trendEmpty', true);
        if (hint) hint.textContent = '';
        return;
    }

    setEmptyState('balanceChart', 'trendEmpty', false);
    const series = buildTrendSeries(transactions);
    if (hint) hint.textContent = series.hint;

    const ctx = document.getElementById('balanceChart').getContext('2d');
    const incomeFill = ctx.createLinearGradient(0, 0, 0, 260);
    incomeFill.addColorStop(0, 'rgba(31, 122, 92, 0.12)');
    incomeFill.addColorStop(1, 'rgba(31, 122, 92, 0)');
    const expenseFill = ctx.createLinearGradient(0, 0, 0, 260);
    expenseFill.addColorStop(0, 'rgba(196, 80, 74, 0.12)');
    expenseFill.addColorStop(1, 'rgba(196, 80, 74, 0)');

    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: series.labels,
            datasets: [
                {
                    label: 'รายรับ',
                    data: series.income,
                    borderColor: '#1F7A5C',
                    backgroundColor: incomeFill,
                    borderWidth: 1.75,
                    tension: 0.35,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHitRadius: 12
                },
                {
                    label: 'รายจ่าย',
                    data: series.expense,
                    borderColor: '#C4504A',
                    backgroundColor: expenseFill,
                    borderWidth: 1.75,
                    tension: 0.35,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHitRadius: 12
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { padding: 16, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => ` ${item.dataset.label}: ${formatBaht(item.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    border: { display: false }
                },
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: '#F0F0EE', drawTicks: false },
                    ticks: {
                        padding: 8,
                        callback: (v) => formatBaht(v, true)
                    }
                }
            }
        }
    });
}

function renderLegend(elId, summary, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    el.innerHTML = entries.map(([label, value]) => {
        const pct = total ? Math.round((value / total) * 100) : 0;
        const color = getHashColor(label, type);
        return `<li>
            <span class="legend-swatch" style="background:${color}"></span>
            <span class="legend-label">${escapeHtml(label)}</span>
            <span class="legend-meta">${pct}% · ${formatBaht(value)}</span>
        </li>`;
    }).join('');
}

function renderDoughnut(canvasId, emptyId, legendId, totalId, summary, type) {
    if (type === 'income' && incomeChart) {
        incomeChart.destroy();
        incomeChart = null;
    }
    if (type === 'expense' && expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }

    const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
    const totalEl = document.getElementById(totalId);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (totalEl) totalEl.textContent = total ? formatBaht(total) : '';

    if (!entries.length) {
        setEmptyState(canvasId, emptyId, true);
        renderLegend(legendId, {}, type);
        return;
    }

    setEmptyState(canvasId, emptyId, false);
    renderLegend(legendId, summary, type);

    const ctx = document.getElementById(canvasId).getContext('2d');
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: labels.map(c => getHashColor(c, type)),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                doughnutCenter: {
                    label: type === 'income' ? 'รวมรับ' : 'รวมจ่าย',
                    text: formatBaht(total, true)
                },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            const pct = total ? Math.round((item.parsed / total) * 100) : 0;
                            return ` ${item.label}: ${formatBaht(item.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    if (type === 'income') incomeChart = chart;
    else expenseChart = chart;
}

function updatePieCharts(transactions) {
    const incSummary = {}, expSummary = {};
    transactions.forEach(t => {
        const map = t.type === 'income' ? incSummary : expSummary;
        map[t.category] = (map[t.category] || 0) + t.amount;
    });
    renderDoughnut('incomeChart', 'incomeEmpty', 'incomeLegend', 'incomeChartTotal', incSummary, 'income');
    renderDoughnut('expenseChart', 'expenseEmpty', 'expenseLegend', 'expenseChartTotal', expSummary, 'expense');
}
