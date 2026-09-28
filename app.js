const monthSelect = document.getElementById('month-select');
const yearSelect = document.getElementById('year-select');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const calendarGrid = document.getElementById('calendar-grid');

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Пазим празниците тук, за да не питаме API-то при всяко цъкане на стрелките
let cachedHolidays = {};

// Асинхронна функция, която дърпа празниците от Nager.Date
async function fetchHolidays(year) {
    // Ако вече сме ги изтеглили за тази година, връщаме ги от кеша
    if (cachedHolidays[year]) {
        return cachedHolidays[year];
    }

    try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BG`);
        const data = await response.json();

        // Nager.Date връща датите във формат "YYYY-MM-DD". Ние взимаме само "MM-DD".
        const formattedDates = data.map(item => item.date.substring(5));

        // Записваме ги в кеша за следващия път
        cachedHolidays[year] = formattedDates;
        return formattedDates;
    } catch (error) {
        console.error("Грешка при зареждане на празниците от API:", error);
        return []; // При грешка (напр. няма интернет), връщаме празен масив
    }
}

// Начална дата: 27 Април 2026
const baseDate = Date.UTC(2026, 3, 27);

let currentDate = new Date();

function initDropdowns() {
    months.forEach((m, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = m;
        monthSelect.appendChild(option);
    });

    // Change the year when last ends so the app keeps going
    for (let y = 2025; y <= 2035; y++) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    }

    monthSelect.addEventListener('change', (e) => {
        currentDate.setMonth(parseInt(e.target.value));
        renderCalendar();
    });

    yearSelect.addEventListener('change', (e) => {
        currentDate.setFullYear(parseInt(e.target.value));
        renderCalendar();
    });
}

function updateDropdowns() {
    monthSelect.value = currentDate.getMonth();
    yearSelect.value = currentDate.getFullYear();
}

function getShiftsForDay(cycleDay) {
    let shifts = [];

    const addShift = (team, type) => {
        const shiftClass = team.toLowerCase();
        shifts.push({ class: shiftClass, team: team, text: `${team} - ${type}` });
    };

    const isBlueRedWorkDay = [0,1, 4,5,6, 9,10, 14,15, 18,19,20, 23,24].includes(cycleDay);
    if (isBlueRedWorkDay) {
        if (cycleDay < 14) {
            // РАЗМЯНАТА Е ТУК: Червените стават Дневна, Сините стават Нощна
            addShift('Red', 'Day'); addShift('Blue', 'Night');
        } else {
            // И ТУК: Сините стават Дневна, Червените стават Нощна
            addShift('Blue', 'Day'); addShift('Red', 'Night');
        }
    }

    const isGreenYellowWorkDay = [2,3, 7,8, 11,12,13, 16,17, 21,22, 25,26,27].includes(cycleDay);
    if (isGreenYellowWorkDay) {
        const greenNight = [2,3, 21,22, 25,26,27].includes(cycleDay);
        if (greenNight) {
            addShift('Yellow', 'Day'); addShift('Green', 'Night');
        } else {
            addShift('Green', 'Day'); addShift('Yellow', 'Night');
        }
    }

    return shifts;
}

async function renderCalendar() {
    calendarGrid.innerHTML = '';
    updateDropdowns();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // НОВО: Изчакваме празниците за съответната година да се заредят от API-то
    const holidaysForYear = await fetchHolidays(year);

    const actualToday = new Date();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty';
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');

        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${monthStr}-${dayStr}`;

        // Проверяваме директно в масива, който изтеглихме от API-то
        const isHoliday = holidaysForYear.includes(dateString);

        const isToday = (year === actualToday.getFullYear() && month === actualToday.getMonth() && day === actualToday.getDate());

        // Задаваме базовия клас
        cell.className = 'day-cell';

        // Ако е празник, добавяме празничния клас
        if (isHoliday) {
            cell.classList.add('holiday-cell');
        }

        // Ако е днес, добавяме класа за днешния ден (зеления контур)
        if (isToday) {
            cell.classList.add('today-cell');
        }

        let dayNumberHtml = `<span>${day}</span>`;
        if (isHoliday) {
            dayNumberHtml += ` <span title="Public Holiday - Double Pay!" style="cursor:help">💰</span>`;
        }
        cell.innerHTML = `<div class="day-number">${dayNumberHtml}</div>`;

        const targetDateUTC = Date.UTC(year, month, day);
        const diffDays = Math.floor((targetDateUTC - baseDate) / 86400000);

        let cycleDay = diffDays % 28;
        if (cycleDay < 0) cycleDay += 28;

        const shifts = getShiftsForDay(cycleDay);
        shifts.forEach(shift => {
            const shiftEl = document.createElement('div');
            shiftEl.className = `shift ${shift.class}`;
            shiftEl.textContent = shift.text;
            cell.appendChild(shiftEl);
        });

        // МОДИФИКАЦИЯ: Винаги добавяме marker-area за консистентност
        const holidayMarkerArea = document.createElement('div');
        holidayMarkerArea.className = 'holiday-marker-area';
        if (isHoliday) {
            // Добавяме видимия почивен маркер
            const holidayMarker = document.createElement('div');
            holidayMarker.className = 'holiday-marker';
            holidayMarker.textContent = 'Public Holiday';
            holidayMarkerArea.appendChild(holidayMarker);
        } else {
            // Добавяме скрития placeholder, за да запазим пространството
            const placeholderText = document.createElement('span');
            placeholderText.className = 'placeholder-text';
            placeholderText.innerHTML = '&nbsp;'; // Non-breaking space
            placeholderText.style.visibility = 'hidden';
            holidayMarkerArea.appendChild(placeholderText);
        }
        cell.appendChild(holidayMarkerArea);

        calendarGrid.appendChild(cell);
    }
}

prevBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

initDropdowns();
renderCalendar();