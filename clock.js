// Очищаем sessionStorage при загрузке страницы
window.onload = function () {
  sessionStorage.removeItem('clockSettings');
  setupLiveSettings();
  loadSvgTemplate(generateClocks);
};

document.getElementById('settingsBtn').onclick = openModal;
document.getElementById('printBtn').onclick = () => window.print();
document.getElementById('regenBtn').onclick = generateClocks;

function openModal() {
  const modal = document.getElementById('settingsModal');
  modal.style.display = 'flex';
  // Добавляем backdrop listeners
  modal._mouseBackdropHandler = function (e) {
    if (e.target === modal) closeModal();
  };
  modal._touchBackdropHandler = function (e) {
    if (e.target === modal) setTimeout(closeModal, 0);
  };
  modal.addEventListener('mousedown', modal._mouseBackdropHandler);
  modal.addEventListener('touchstart', modal._touchBackdropHandler);
}

function closeModal() {
  const modal = document.getElementById('settingsModal');
  modal.style.display = 'none';
  // Удаляем backdrop listeners
  if (modal._mouseBackdropHandler) {
    modal.removeEventListener('mousedown', modal._mouseBackdropHandler);
    delete modal._mouseBackdropHandler;
  }
  if (modal._touchBackdropHandler) {
    modal.removeEventListener('touchstart', modal._touchBackdropHandler);
    delete modal._touchBackdropHandler;
  }
  generateClocks();
}

function getDefaultGridByDevice() {
  // Use User-Agent Client Hints API when available
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    if (navigator.userAgentData.mobile) {
      return { gridCols: 1, gridRows: 1 };
    }
  }
  // Fallback to screen width breakpoints
  const width = window.innerWidth;
  if (width <= 900) {
    // Small screens (mobile)
    return { gridCols: 1, gridRows: 1 };
  } else if (width <= 1200) {
    // Medium screens (tablet)
    return { gridCols: 2, gridRows: 2 };
  }
  // Large screens (desktop)
  return { gridCols: 3, gridRows: 4 };
}

function loadSettings() {
  const deviceGrid = getDefaultGridByDevice();
  const defaults = {
    start: '00:00',
    end: '23:59',
    step: '30',
    showDigital: false,
    showAnalog: true,
    twentyFourClock: false,
    ampmMode: false,
    showDayNightIcons: true,
    gridCols: deviceGrid.gridCols,
    gridRows: deviceGrid.gridRows,
  };
  const saved = JSON.parse(sessionStorage.getItem('clockSettings')) || defaults;
  document.getElementById('startTime').value = saved.start;
  document.getElementById('endTime').value = saved.end;
  document.getElementById('step').value = saved.step;
  document.getElementById('showDigital').checked = saved.showDigital;
  if (document.getElementById('showAnalog')) document.getElementById('showAnalog').checked = saved.showAnalog !== false;
  if (document.getElementById('twentyFourClock'))
    document.getElementById('twentyFourClock').checked = saved.twentyFourClock === true;
  if (document.getElementById('ampmMode')) document.getElementById('ampmMode').checked = saved.ampmMode === true;
  if (document.getElementById('showDayNightIcons'))
    document.getElementById('showDayNightIcons').checked = saved.showDayNightIcons !== false;
  if (document.getElementById('gridCols')) document.getElementById('gridCols').value = saved.gridCols || 3;
  if (document.getElementById('gridRows')) document.getElementById('gridRows').value = saved.gridRows || 4;
  return saved;
}

// Загрузка SVG-шаблона из файла и вставка в preload-div
function loadSvgTemplate(callback) {
  fetch('clock-template.svg')
    .then((r) => r.text())
    .then((svgText) => {
      document.getElementById('svg-template-preload').innerHTML = svgText;
      callback();
    });
}

function generateClocks() {
  const {
    start,
    end,
    step,
    showDigital,
    twentyFourClock,
    ampmMode,
    showDayNightIcons,
    gridCols = 3,
    gridRows = 4,
  } = loadSettings();
  const showAnalog = document.getElementById('showAnalog') ? document.getElementById('showAnalog').checked : true;
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const stepVal = step === 'random' ? 1 : parseInt(step); // 1 минута для random
  let times = [];
  const count = gridCols * gridRows;
  const maxAttempts = 1000;
  let attempts = 0;
  const uniqueTimes = new Set();

  // Helper to round down to nearest step
  function roundToStep(mins, step) {
    return mins - (mins % step);
  }

  // Generate all possible valid times in the interval, rounded to step
  let possibleTimes = [];
  if (step !== 'random') {
    for (let t = roundToStep(startMinutes, stepVal); t <= endMinutes; t += stepVal) {
      if (t >= startMinutes && t <= endMinutes) {
        possibleTimes.push(minutesToTime(t));
      }
    }
  }

  if (step === 'random') {
    // Randomly pick unique raw times (no rounding!) from the interval
    while (uniqueTimes.size < Math.min(count, endMinutes - startMinutes + 1) && attempts < maxAttempts) {
      const rnd = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes + 1));
      uniqueTimes.add(minutesToTime(rnd));
      attempts++;
    }
    times = Array.from(uniqueTimes);
    // If not enough, fill with more random (may repeat)
    while (times.length < count && attempts < maxAttempts) {
      const rnd = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes + 1));
      times.push(minutesToTime(rnd));
      attempts++;
    }
  } else {
    // For non-random, just shuffle possibleTimes and take up to count
    possibleTimes = possibleTimes.sort(() => Math.random() - 0.5);
    times = possibleTimes.slice(0, count);
    // If not enough, fill with more random (may repeat)
    while (times.length < count && attempts < maxAttempts) {
      const rnd = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes + 1));
      const rounded = roundToStep(rnd, stepVal);
      if (rounded >= startMinutes && rounded <= endMinutes) {
        times.push(minutesToTime(rounded));
      }
      attempts++;
    }
  }

  times = times.slice(0, count);
  const table = document.getElementById('clock-table');
  table.innerHTML = '';
  // Получаем SVG-шаблон из preload
  const svgTemplate = document.getElementById('svg-template-preload').firstElementChild;

  for (let i = 0; i < times.length; i += gridCols) {
    const row = document.createElement('tr');
    for (let j = 0; j < gridCols; j++) {
      const cell = document.createElement('td');

      // Определяем zoom для ячеек
      cell.style.zoom = getCellZoom(gridCols, gridRows);

      // Клонируем SVG из preload
      const svg = svgTemplate.cloneNode(true);

      // Управление стрелками через отдельную функцию
      if (showAnalog && times[i + j]) {
        const [h, m] = times[i + j].split(':').map(Number);
        setClockHands(svg, h, m, true);
      } else {
        setClockHands(svg, 0, 0, false);
      }

      // Скрытие/отображение 24ч цифр
      const tfGroup = svg.querySelector('.twentyfour-group');
      if (tfGroup) tfGroup.style.display = twentyFourClock ? '' : 'none';

      // --- Day/Night icons logic ---
      setDayNightIcons(svg, times[i + j], showDayNightIcons, ampmMode, showDigital);

      cell.appendChild(svg);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'time-label time-label-input';
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '[0-9: ]*');
      let placeholder = '___:___';
      if (showDigital && times[i + j]) {
        if (ampmMode) {
          // Форматировать как 12-часовой с AM/PM
          const [h, m] = times[i + j].split(':').map(Number);
          let hour = h % 12;
          if (hour === 0) hour = 12;
          const ampm = h < 12 ? 'AM' : 'PM';
          placeholder = `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
        } else {
          placeholder = times[i + j];
        }
        input.disabled = true; // disable input if digital time is shown
      } else {
        input.disabled = false; // enable input if digital time is hidden
      }
      input.placeholder = placeholder;

      // Маска времени и визуальная проверка
      input.addEventListener('input', function (e) {
        maskTimeInput(this, ampmMode);
        updateSvgCheck(input, svg, times, i, j);
      });

      input.addEventListener('keydown', function (e) {
        // Разрешаем только цифры, Backspace, Delete, стрелки, Tab
        if (
          !(
            (e.key >= '0' && e.key <= '9') ||
            e.key === 'Backspace' ||
            e.key === 'Delete' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            e.key === 'Tab' ||
            e.key === 'Home' ||
            e.key === 'End'
          )
        ) {
          e.preventDefault();
        }
      });
      cell.appendChild(input);
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
}

// Управление стрелками на SVG-часах
function setClockHands(svg, h, m, show) {
  const hourHand = svg.querySelector('#clock-hour-hand');
  const minHand = svg.querySelector('#clock-minute-hand');
  if (show) {
    // hour hand
    const hourAngle = ((h % 12) + m / 60) * 30;
    const hourX = 100 + 40 * Math.sin((Math.PI / 180) * hourAngle);
    const hourY = 100 - 40 * Math.cos((Math.PI / 180) * hourAngle);
    if (hourHand) {
      hourHand.setAttribute('x1', '100');
      hourHand.setAttribute('y1', '100');
      hourHand.setAttribute('x2', hourX.toString());
      hourHand.setAttribute('y2', hourY.toString());
      hourHand.style.display = '';
    }
    // minute hand
    const minAngle = m * 6;
    const minX = 100 + 70 * Math.sin((Math.PI / 180) * minAngle);
    const minY = 100 - 70 * Math.cos((Math.PI / 180) * minAngle);
    if (minHand) {
      minHand.setAttribute('x1', '100');
      minHand.setAttribute('y1', '100');
      minHand.setAttribute('x2', minX.toString());
      minHand.setAttribute('y2', minY.toString());
      minHand.style.display = '';
    }
  } else {
    if (hourHand) hourHand.style.display = 'none';
    if (minHand) minHand.style.display = 'none';
  }
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function saveSettings() {
  const settings = {
    start: document.getElementById('startTime').value || '00:00',
    end: document.getElementById('endTime').value || '23:59',
    step: document.getElementById('step').value,
    showDigital: document.getElementById('showDigital').checked,
    showAnalog: document.getElementById('showAnalog').checked,
    twentyFourClock: document.getElementById('twentyFourClock').checked,
    ampmMode: document.getElementById('ampmMode').checked,
    showDayNightIcons: document.getElementById('showDayNightIcons').checked,
    gridCols: parseInt(document.getElementById('gridCols').value) || 3,
    gridRows: parseInt(document.getElementById('gridRows').value) || 4,
  };
  sessionStorage.setItem('clockSettings', JSON.stringify(settings));
  generateClocks(); // не закрываем модалку
}

// LIVE MODE: применяем настройки сразу при изменении
function setupLiveSettings() {
  const ids = [
    'startTime',
    'endTime',
    'step',
    'showDigital',
    'showAnalog',
    'twentyFourClock',
    'ampmMode',
    'showDayNightIcons',
    'gridCols',
    'gridRows',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = el.onchange = function () {
        saveSettings();
      };
    }
  });
}

// Маска для поля времени: только цифры, авто-двоеточие, максимум 5 символов (или 8 с AM/PM)
function maskTimeInput(input, ampmMode) {
  let v = input.value.replace(/[^0-9]/g, '');
  if (v.length > 4) v = v.slice(0, 4);
  let out = '';
  if (v.length > 0) out += v.slice(0, 2);
  if (v.length > 2) out += ':' + v.slice(2, 4);
  else if (v.length > 2) out += ':';
  input.value = out;
  // Если AM/PM режим, разрешаем ввести пробел и AM/PM
  if (ampmMode && input.value.length === 5 && input._lastLength !== 6) {
    input.value += ' ';
  }
  // Ограничение длины
  if (ampmMode && input.value.length > 8) input.value = input.value.slice(0, 8);
  if (!ampmMode && input.value.length > 5) input.value = input.value.slice(0, 5);
  input._lastLength = input.value.length;
}

function updateReloadIcon(svg, isCorrect) {
  const { gridCols, gridRows } = loadSettings();
  const reloadIcon = svg.querySelector('#svg-reload');
  reloadIcon.style.display = 'none';
  svg.style.cursor = '';
  svg.onclick = null;
  if (isCorrect && gridCols === 1 && gridRows === 1) {
    reloadIcon.style.display = '';
    svg.style.cursor = 'pointer';
    svg.onclick = function () {
      generateClocks();
    };
  }
}

function updateCheckmark(svg, isCorrect, isFilled) {
  // Сброс фона
  if (svg.parentElement) {
    svg.parentElement.style.background = '';
    svg.parentElement.style.backgroundImage = '';
    svg.parentElement.style.backgroundSize = '';
    svg.parentElement.style.backgroundPosition = '';
    svg.parentElement.style.backgroundRepeat = '';
  }

  if (isFilled) {
    const rect = svg.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (svg.parentElement) {
      svg.parentElement.style.backgroundSize = w + 'px ' + h + 'px';
      svg.parentElement.style.backgroundPosition = 'top';
      svg.parentElement.style.backgroundRepeat = 'no-repeat';
    }
    if (isCorrect) {
      svg.parentElement.style.backgroundImage = "url('good_monkey.gif')";
    } else {
      svg.parentElement.style.backgroundImage = "url('bad_monkey.png')";
    }
  }
}

function updateSvgCheck(input, svg, times, i, j) {
  const { showDigital, ampmMode } = loadSettings();
  if (showDigital) return;
  let val = input.value.trim();
  let correct = times[i + j];
  if (ampmMode) {
    const [h, m] = correct.split(':').map(Number);
    let hour = h % 12;
    if (hour === 0) hour = 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    correct = `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    if (val.length === 8) val = val.replace(/\s+/g, ' ').toUpperCase();
    correct = correct.toUpperCase();
  }

  const isFilled = val.length === correct.length;
  const isCorrect = isFilled && val === correct;

  updateReloadIcon(svg, isCorrect);
  updateCheckmark(svg, isCorrect, isFilled);
}

// --- Day/Night icons logic ---
function setDayNightIcons(svg, time, showDayNightIcons, ampmMode, showDigital) {
  const svgSun = svg.querySelector('#svg-sun');
  const svgMoon = svg.querySelector('#svg-moon');
  if (svgSun) svgSun.style.display = 'none';
  if (svgMoon) svgMoon.style.display = 'none';
  if (showDayNightIcons && time && (ampmMode || !showDigital)) {
    const [h, m] = time.split(':').map(Number);
    if (h < 12) {
      if (svgSun) svgSun.style.display = '';
    } else {
      if (svgMoon) svgMoon.style.display = '';
    }
  }
}

function getCellZoom(gridCols, gridRows) {
  if (gridCols === 1 && gridRows === 1) return 3;
  if (gridCols === 2 && gridRows === 2) return 1.5;
  return 1;
}
