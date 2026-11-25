const DEMO_DEBTS = [
  { name: 'Kreditkort', balance: 18400, rate: 19.9, minimum: 800 },
  { name: 'Privatlån', balance: 86500, rate: 10.9, minimum: 1900 },
  { name: 'Billån', balance: 142000, rate: 6.9, minimum: 1300 }
];

const METHOD_INFO = {
  snowball: { name: 'Snöboll', short: 'Snöboll', number: '01', color: '#527aa9', description: 'Extraamorteringen går till skulden med lägst saldo. När den är borta går betalningen vidare till nästa.' },
  avalanche: { name: 'Lavin', short: 'Lavin', number: '02', color: '#173f73', description: 'Extraamorteringen går till skulden med högst ränta. När den är borta går betalningen vidare till nästa.' },
  minimum: { name: 'Minimibelopp', short: 'Minimibelopp', number: '03', color: '#9aa6b5', description: 'Du betalar det angivna minimibeloppet på varje skuld och inget extra.' },
  freedom: { name: 'Frihetsandelen', short: 'Frihetsandelen', number: '04', color: '#32846b', description: 'Följ lavinordningen. Välj en andel av varje frigjort minimibelopp att använda själv; resten förs vidare.' }
};

const MAX_MONTHS = 1200;
const numberFormat = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
let selectedMethod = 'avalanche';
let nextDebtId = 0;
let freedomPercent = 0;
let finalDebtIds = new Set();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function money(value) {
  if (!Number.isFinite(value)) return '—';
  return numberFormat.format(Math.round(value)) + ' kr';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function createDebtCard(debt = {}) {
  const id = 'debt-' + (++nextDebtId);
  const name = debt.name || 'Ny skuld';
  const balance = debt.balance ?? '';
  const rate = debt.rate ?? '';
  const minimum = debt.minimum ?? '';
  const card = document.createElement('article');
  card.className = 'debt-card';
  card.dataset.debtId = id;
  card.innerHTML = '<div class="debt-card-top">' +
    '<span class="debt-number" aria-hidden="true">' + String($$('.debt-card').length + 1).padStart(2, '0') + '</span>' +
    '<input class="debt-name" type="text" maxlength="40" aria-label="Skuldens namn" value="' + escapeHtml(name) + '" />' +
    '<button class="remove-debt" type="button" aria-label="Ta bort ' + escapeHtml(name) + '">×</button>' +
    '</div><div class="debt-fields">' +
    '<div class="debt-field"><label for="' + id + '-balance">Saldo</label><div class="field-box"><input id="' + id + '-balance" data-field="balance" type="number" min="0" step="100" inputmode="decimal" aria-label="Saldo i kronor" value="' + balance + '" /><span class="suffix">kr</span></div></div>' +
    '<div class="debt-field"><label for="' + id + '-rate">Årsränta</label><div class="field-box"><input id="' + id + '-rate" data-field="rate" type="number" min="0" max="1000" step="0.1" inputmode="decimal" aria-label="Årsränta i procent" value="' + rate + '" /><span class="suffix">%</span></div></div>' +
    '<div class="debt-field"><label for="' + id + '-minimum">Min / mån</label><div class="field-box"><input id="' + id + '-minimum" data-field="minimum" type="number" min="0" step="50" inputmode="decimal" aria-label="Minimibelopp per månad i kronor" value="' + minimum + '" /><span class="suffix">kr</span></div></div>' +
    '</div>';
  return card;
}

function renderDebts(debts) {
  const list = $('#debt-list');
  list.replaceChildren(...debts.map(createDebtCard));
  updateDebtNumbers();
}

function updateDebtNumbers() {
  $$('.debt-card').forEach((card, index) => {
    $('.debt-number', card).textContent = String(index + 1).padStart(2, '0');
  });
}

function numericValue(input, fallback = 0) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function readInputs() {
  const debts = $$('.debt-card').map((card) => ({
      id: card.dataset.debtId,
      name: $('.debt-name', card).value.trim() || 'Skuld',
      balance: numericValue($('[data-field="balance"]', card)),
      rate: Math.min(1000, numericValue($('[data-field="rate"]', card))),
      minimum: numericValue($('[data-field="minimum"]', card))
    })).filter((debt) => debt.balance > 0);
  return {
    debts,
    monthlyExtra: numericValue($('#monthly-extra')),
    freedomPercent
  };
}

function orderDebts(debts, method) {
  const sorted = debts.slice();
  if (method === 'snowball') sorted.sort((a, b) => a.balance - b.balance || b.rate - a.rate || a.index - b.index);
  else sorted.sort((a, b) => b.rate - a.rate || a.balance - b.balance || a.index - b.index);
  return sorted;
}

function simulate(debtsInput, method, monthlyExtra, freedomPercent = 0) {
  const debts = debtsInput.map((debt, index) => ({ ...debt, index, balance: debt.balance }));
  const minimumBudget = debts.reduce((sum, debt) => sum + debt.minimum, 0);
  const fixedBudget = minimumBudget + monthlyExtra;
  const freedomOrder = orderDebts(debts, 'avalanche');
  const freedomPolicy = new Map();
  freedomOrder.forEach((debt) => {
    const cashOut = debt.minimum * (freedomPercent / 100);
    freedomPolicy.set(debt.id, { cashOut, carryForward: debt.minimum - cashOut });
  });
  const freedomTargetId = freedomOrder[0]?.id;
  let totalInterest = 0;
  let totalFun = 0;
  let firstPayoffMonth = null;
  const history = [debts.reduce((sum, debt) => sum + debt.balance, 0)];
  const months = [];

  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    const active = debts.filter((debt) => debt.balance > 0.005);
    if (!active.length) return { completed: true, month: month - 1, totalInterest, totalFun, history, months, firstPayoffMonth, finalMonthDebtIds: [] };
    const activeMinimums = active.reduce((sum, debt) => sum + debt.minimum, 0);
    const paidBeforeMonth = debts.filter((debt) => debt.balance <= 0.005);
    const freedomCashOut = method === 'freedom' ? paidBeforeMonth.reduce((sum, debt) => sum + (freedomPolicy.get(debt.id)?.cashOut || 0), 0) : 0;
    const freedomCarry = method === 'freedom' ? paidBeforeMonth.reduce((sum, debt) => sum + (freedomPolicy.get(debt.id)?.carryForward || 0), 0) : 0;
    const budget = method === 'minimum'
      ? activeMinimums
      : method === 'freedom'
        ? activeMinimums + monthlyExtra + freedomCarry
        : fixedBudget;

    let monthlyInterest = 0;
    for (const debt of active) {
      const interest = debt.balance * (debt.rate / 1200);
      debt.balance += interest;
      monthlyInterest += interest;
    }
    totalInterest += monthlyInterest;

    let remaining = budget;
    let totalPaid = 0;
    const monthClosedIds = new Set();
    for (const debt of active) {
      const payment = Math.min(debt.balance, debt.minimum, remaining);
      debt.balance -= payment;
      remaining -= payment;
      totalPaid += payment;
      if (debt.balance <= 0.005) {
        debt.balance = 0;
        monthClosedIds.add(debt.id);
      }
    }

    const activeAfterMinimums = debts.filter((debt) => debt.balance > 0.005);
    const order = orderDebts(activeAfterMinimums, method === 'snowball' ? 'snowball' : 'avalanche');
    let extraRemaining = method === 'minimum' ? 0 : remaining;
    for (const debt of order) {
      if (extraRemaining <= 0.005) break;
      const payment = Math.min(debt.balance, extraRemaining);
      debt.balance -= payment;
      extraRemaining -= payment;
      remaining -= payment;
      totalPaid += payment;
      if (debt.balance <= 0.005) {
        debt.balance = 0;
        monthClosedIds.add(debt.id);
      }
    }

    const freedomTarget = debts.find((debt) => debt.id === freedomTargetId);
    if (method === 'freedom' && firstPayoffMonth === null && freedomTarget && freedomTarget.balance <= 0.005) firstPayoffMonth = month;

    const currentBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
    const funThisMonth = method === 'freedom' ? freedomCashOut : 0;
    totalFun += funThisMonth;
    history.push(currentBalance);
    months.push({ month, paid: totalPaid, interest: monthlyInterest, balance: currentBalance, fun: funThisMonth });
    if (currentBalance <= 0.005) return { completed: true, month, totalInterest, totalFun, history, months, firstPayoffMonth, finalMonthDebtIds: Array.from(monthClosedIds) };
  }

  return { completed: false, month: MAX_MONTHS, totalInterest, totalFun, history, months, firstPayoffMonth, finalMonthDebtIds: [] };
}

function formatDuration(months) {
  if (!Number.isFinite(months)) return '—';
  if (months === 0) return 'Redan skuldfri';
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (years === 0) return months + (months === 1 ? ' månad' : ' månader');
  if (remainder === 0) return years + (years === 1 ? ' år' : ' år');
  return years + (years === 1 ? ' år ' : ' år ') + remainder + (remainder === 1 ? ' mån' : ' mån');
}

function renderStrategyCards(results) {
  const grid = $('#strategy-grid');
  grid.innerHTML = Object.entries(METHOD_INFO).map(([key, info]) => {
    const result = results[key];
    const timeText = result.completed ? formatDuration(result.month) : 'Över 100 år';
    const interestText = result.completed ? money(result.totalInterest) : '—';
    return '<button class="strategy-card strategy-' + key + '" type="button" role="tab" aria-selected="' + (key === selectedMethod) + '" aria-controls="result-detail" data-method="' + key + '">' +
      '<span class="card-number">' + info.number + ' / 04</span><span class="card-interest">' + interestText + '</span>' +
      '<span class="card-name">' + info.short + '</span><span class="card-time">' + timeText + '</span></button>';
  }).join('');
}

function createChart(results, activeMethod) {
  const svg = $('#balance-chart');
  const plot = { left: 42, top: 12, width: 700, height: 205 };
  const allResults = Object.values(results);
  const totalMonths = Math.max(1, ...allResults.map((result) => result.history.length - 1));
  const maxBalance = Math.max(1, ...allResults.map((result) => result.history[0] || 0));
  const ticks = [0, .25, .5, .75, 1];
  let markup = '<title>Skuldens uppskattade saldo över tid</title><desc>Fyra linjer jämför snöboll, lavin, minimibelopp och Frihetsandelen.</desc>';

  ticks.forEach((fraction) => {
    const y = plot.top + plot.height * fraction;
    const amount = maxBalance * (1 - fraction);
    markup += '<line class="chart-grid-line" x1="' + plot.left + '" y1="' + y + '" x2="' + (plot.left + plot.width) + '" y2="' + y + '" />';
    markup += '<text class="chart-axis-label" x="' + (plot.left - 7) + '" y="' + (y + 3) + '" text-anchor="end">' + compactMoney(amount) + '</text>';
  });

  const xTicks = Math.min(4, totalMonths);
  for (let i = 0; i <= xTicks; i += 1) {
    const month = Math.round(totalMonths * (i / xTicks));
    const x = plot.left + plot.width * (month / totalMonths);
    markup += '<text class="chart-axis-label" x="' + x + '" y="' + (plot.top + plot.height + 24) + '" text-anchor="middle">' + (month === 0 ? '0' : monthLabel(month)) + '</text>';
  }

  Object.entries(METHOD_INFO).forEach(([key, info]) => {
    const history = results[key].history;
    const path = history.map((balance, index) => {
      const month = Math.min(index, totalMonths);
      const x = plot.left + plot.width * (month / totalMonths);
      const y = plot.top + plot.height * (1 - balance / maxBalance);
      return (index === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
    }).join(' ');
    markup += '<path class="chart-path' + (key === activeMethod ? ' is-selected' : '') + '" d="' + path + '" stroke="' + info.color + '" />';
  });
  svg.innerHTML = markup;
  $('#chart-legend').innerHTML = Object.entries(METHOD_INFO).map(([key, info]) => '<span class="legend-item"><span class="legend-swatch" style="background:' + info.color + '"></span>' + escapeHtml(info.short) + '</span>').join('');
}

function compactMoney(value) {
  if (value >= 1000000) return (value / 1000000).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' m';
  if (value >= 1000) return Math.round(value / 1000) + ' t';
  return Math.round(value).toString();
}

function monthLabel(month) {
  const years = Math.floor(month / 12);
  const remainder = month % 12;
  if (years === 0) return month + ' mån';
  return years + ' år' + (remainder ? ' ' + remainder + ' mån' : '');
}

function renderFreedomPercentPreview(debts, terminalIds = finalDebtIds) {
  const ordered = orderDebts(debts, 'avalanche');
  $('#freedom-percent-value').textContent = freedomPercent + ' %';
  $('#freedom-percent-preview').innerHTML = ordered.map((debt, index) => {
    const isFinal = terminalIds.has(debt.id);
    const cashOut = isFinal ? 0 : debt.minimum * (freedomPercent / 100);
    const forward = debt.minimum - cashOut;
    return '<div class="freedom-preview-row' + (isFinal ? ' is-final' : '') + '"><span class="preview-order">' + String(index + 1).padStart(2, '0') + '</span><span class="preview-name">' + escapeHtml(debt.name) + '<small>Min ' + money(debt.minimum) + '</small></span><strong>' + money(cashOut) + '<small>till dig</small></strong><span class="preview-forward">' + money(forward) + ' vidare</span>' + (isFinal ? '<em>Sista månaden</em>' : '') + '</div>';
  }).join('');
}

function updateFreedomUseExamples(total) {
  const hasWithdrawals = total > 0.5;
  $('#freedom-use-empty').hidden = hasWithdrawals;
  $('#freedom-use-examples').hidden = !hasWithdrawals;
  $('#use-buffer').textContent = money(total);
  $('#use-downpayment').textContent = money(total);
  const contribution = 500;
  const count = Math.floor(total / contribution);
  $('#use-invest-count').textContent = count ? count + ' × 500 kr' : 'Under 500 kr';
  $('#use-invest-note').textContent = count
    ? money(count * contribution) + ' av summan som extra insättningar. Ingen avkastning inräknad.'
    : 'Mindre än en insättning à 500 kr. Ingen avkastning inräknad.';
}

function renderSchedule(result, method) {
  const body = $('#schedule-body');
  const showFun = method === 'freedom';
  $('#fun-column-heading').hidden = !showFun;
  const data = result.months.slice(0, 120);
  body.innerHTML = data.map((row) => '<tr><td>' + row.month + '</td><td>' + money(row.paid) + '</td><td>' + money(row.interest) + '</td><td>' + money(row.balance) + '</td>' + (showFun ? '<td>' + money(row.fun) + '</td>' : '') + '</tr>').join('');
  if (result.months.length > 120) body.insertAdjacentHTML('beforeend', '<tr><td colspan="' + (showFun ? 5 : 4) + '">Visar de första 120 månaderna av ' + numberFormat.format(result.months.length) + '.</td></tr>');
}

function payoffDate(months) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const label = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function renderComparison(result, baseline, method) {
  const banner = $('#comparison-banner');
  banner.classList.remove('is-positive', 'is-neutral', 'is-caution');
  const timeValue = $('#comparison-time');
  const timeLabel = $('#comparison-time-label');
  const interestValue = $('#comparison-interest');
  const interestLabel = $('#comparison-interest-label');

  if (method === 'minimum') {
    banner.classList.add('is-neutral');
    $('#comparison-kicker').textContent = 'DIN JÄMFÖRELSEPUNKT';
    $('#comparison-title').textContent = baseline.completed ? 'Skuldfri i ' + payoffDate(baseline.month) : 'Minimibeloppen når inte noll';
    $('#comparison-copy').textContent = baseline.completed
      ? 'Det här är din baslinje. Välj en annan metod för att se hur du kan flytta datumet och räntan.'
      : 'Med de här beloppen minskar skulderna inte till noll inom 100 år.';
    timeValue.textContent = 'Utgångspunkt';
    timeLabel.textContent = 'jämför metoderna mot detta';
    interestValue.textContent = baseline.completed ? money(baseline.totalInterest) : '—';
    interestLabel.textContent = 'ränta med minimibelopp';
    return;
  }

  if (!result.completed) {
    banner.classList.add('is-caution');
    $('#comparison-kicker').textContent = 'NÄSTA STEG';
    $('#comparison-title').textContent = 'Låt oss hitta ett datum.';
    $('#comparison-copy').textContent = 'Öka extraamorteringen för att se när planen kan få dig till noll.';
    timeValue.textContent = '100+ år';
    timeLabel.textContent = 'med nuvarande belopp';
    interestValue.textContent = '—';
    interestLabel.textContent = 'planen når inte noll';
    return;
  }

  banner.classList.add('is-positive');
    $('#comparison-kicker').textContent = 'BERÄKNAD SKULDFRI DAG';
  $('#comparison-title').textContent = 'Skuldfri i ' + payoffDate(result.month);
  timeValue.textContent = formatDuration(Math.abs(baseline.month - result.month));
  const interestDifference = baseline.completed ? baseline.totalInterest - result.totalInterest : null;
  const timeDifference = baseline.completed ? baseline.month - result.month : null;

  if (!baseline.completed) {
    $('#comparison-copy').textContent = 'Minimibeloppen räcker inte till en skuldfri plan inom 100 år. Med ' + method.name.toLowerCase() + ' når du målet.';
    timeValue.textContent = '100+ år';
    timeLabel.textContent = 'minimibelopp når inte noll';
    interestValue.textContent = money(result.totalInterest);
    interestLabel.textContent = 'beräknad total ränta';
    return;
  }

  if (timeDifference > 0) {
    timeLabel.textContent = 'tidigare än minimibelopp';
  } else if (timeDifference < 0) {
    timeValue.textContent = formatDuration(Math.abs(timeDifference));
    timeLabel.textContent = 'senare än minimibelopp';
    banner.classList.replace('is-positive', 'is-caution');
  } else {
    timeValue.textContent = 'Samma tid';
    timeLabel.textContent = 'som minimibelopp';
  }

  if (interestDifference > 0.5) {
    interestValue.textContent = money(interestDifference);
    interestLabel.textContent = 'mindre ränta än minimibelopp';
  } else if (interestDifference < -0.5) {
    interestValue.textContent = money(Math.abs(interestDifference));
    interestLabel.textContent = 'mer ränta än minimibelopp';
    banner.classList.replace('is-positive', 'is-caution');
  } else {
    interestValue.textContent = 'Samma';
    interestLabel.textContent = 'räntekostnad som minimibelopp';
  }

  const statements = [];
  if (timeDifference > 0) statements.push('Du når skuldfri-dagen ' + formatDuration(timeDifference) + ' tidigare än med enbart minimibelopp.');
  else if (timeDifference < 0) statements.push('Du når skuldfri-dagen ' + formatDuration(Math.abs(timeDifference)) + ' senare än med enbart minimibelopp.');
  else statements.push('Du når skuldfri-dagen lika snabbt som med enbart minimibelopp.');
  if (interestDifference > 0.5) statements.push('Det motsvarar cirka ' + money(interestDifference) + ' mindre i ränta.');
  else if (interestDifference < -0.5) statements.push('Räntekostnaden blir cirka ' + money(Math.abs(interestDifference)) + ' högre.');
  if (result.totalFun > 0.5) statements.push('Du får dessutom ' + money(result.totalFun) + ' att använda enligt dina prioriteringar.');
  $('#comparison-copy').textContent = statements.join(' ');
}

function renderDetail(results, input) {
  const info = METHOD_INFO[selectedMethod];
  const result = results[selectedMethod];
  $('#selected-kicker').textContent = 'VALD METOD · ' + info.number;
  $('#selected-title').textContent = info.name;
  $('#selected-description').textContent = info.description;
  $('#metric-time').textContent = result.completed ? formatDuration(result.month) : 'Över 100 år';
  $('#metric-interest').textContent = result.completed ? money(result.totalInterest) : '—';
  renderComparison(result, results.minimum, info);
  $('.metric-row').classList.toggle('has-freedom', selectedMethod === 'freedom');
  $('#freedom-metric').hidden = selectedMethod !== 'freedom';
  $('#metric-fun').textContent = money(result.totalFun);
  $('#freedom-uses').hidden = selectedMethod !== 'freedom';
  if (selectedMethod === 'freedom') updateFreedomUseExamples(result.totalFun);
  renderSchedule(result, selectedMethod);

  const minimum = results.minimum;
  let insight = '';
  if (selectedMethod === 'freedom') {
    insight = result.totalFun <= 0.5
      ? 'Vid 0 % går hela det frigjorda minimibeloppet vidare. Då följer Frihetsandelen lavinens betalningsplan.'
      : 'Andelen du tar ut räknas på varje skuld när den är helt betald. Resten av minimibeloppet förs vidare till nästa skuld.';
  } else if (selectedMethod === 'minimum') {
    insight = 'Minimibelopp är din jämförelsegrund. Prova en annan metod eller ändra extraamorteringen för att se vad som händer med datum och ränta.';
  } else if (result.completed && minimum.completed) {
    insight = selectedMethod === 'snowball'
      ? 'Snöbollen prioriterar lägsta saldo för att ge en tidig avbetalning och en tydlig delseger.'
      : 'Lavinen prioriterar högsta räntan först för att pressa ned räntekostnaden.';
  } else {
    insight = 'Öka extraamorteringen eller kontrollera minimibeloppen. Med de här uppgifterna blir skulden inte avbetald inom 100 år.';
  }
  $('#insight-text').textContent = insight;
  createChart(results, selectedMethod);
}

function refresh() {
  const input = readInputs();
  const minimumTotal = input.debts.reduce((sum, debt) => sum + debt.minimum, 0);
  const monthlyBudget = minimumTotal + input.monthlyExtra;
  $('#minimum-total').textContent = money(minimumTotal);
  $('#debt-total').textContent = money(monthlyBudget);
  const error = $('#input-error');
  const invalid = $('#invalid-state');
  const detail = $('#result-detail');
  let message = '';
  if (!input.debts.length) message = 'Lägg till minst en skuld med ett saldo större än noll.';
  else if (input.debts.some((debt) => debt.rate > 100)) message = 'Kontrollera årsräntan. För den här kalkylen behöver den vara högst 100 %.';

  if (message) {
    finalDebtIds = new Set();
    renderFreedomPercentPreview(input.debts, finalDebtIds);
    error.textContent = message;
    error.hidden = false;
    detail.hidden = true;
    invalid.hidden = false;
    $('#invalid-copy').textContent = message;
    return;
  }
  error.hidden = true;
  detail.hidden = false;
  invalid.hidden = true;
  const results = {
    snowball: simulate(input.debts, 'snowball', input.monthlyExtra),
    avalanche: simulate(input.debts, 'avalanche', input.monthlyExtra),
    minimum: simulate(input.debts, 'minimum', input.monthlyExtra),
    freedom: simulate(input.debts, 'freedom', input.monthlyExtra, input.freedomPercent)
  };
  const currentFinalDebtIds = new Set(results.freedom.completed ? results.freedom.finalMonthDebtIds : []);
  finalDebtIds = currentFinalDebtIds;
  renderFreedomPercentPreview(input.debts, finalDebtIds);
  renderStrategyCards(results);
  renderDetail(results, input);
}

function resetDemo() {
  renderDebts(DEMO_DEBTS);
  $('#monthly-extra').value = '2500';
  freedomPercent = 0;
  $('#freedom-percent').value = '0';
  refresh();
}

$('#debt-list').addEventListener('input', refresh);
$('#debt-list').addEventListener('change', refresh);
$('#debt-list').addEventListener('click', (event) => {
  const button = event.target.closest('.remove-debt');
  if (!button) return;
  button.closest('.debt-card').remove();
  updateDebtNumbers();
  refresh();
});
$('#add-debt').addEventListener('click', () => {
  $('#debt-list').append(createDebtCard());
  updateDebtNumbers();
  $('.debt-name', $('#debt-list').lastElementChild).focus();
  refresh();
});
$('#monthly-extra').addEventListener('input', refresh);
$('#freedom-percent').addEventListener('input', (event) => {
  freedomPercent = numericValue(event.target);
  refresh();
});
$('.method-intros').addEventListener('click', (event) => {
  const card = event.target.closest('.method-card');
  if (!card) return;
  const shouldOpen = !card.classList.contains('is-open');
  $$('.method-card').forEach((item) => {
    item.classList.remove('is-open');
    item.setAttribute('aria-expanded', 'false');
  });
  if (shouldOpen) {
    card.classList.add('is-open');
    card.setAttribute('aria-expanded', 'true');
  }
});
$('.method-intros').addEventListener('keydown', (event) => {
  const card = event.target.closest('.method-card');
  if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  card.click();
});
$('#reset-demo').addEventListener('click', resetDemo);
$('#print-results').addEventListener('click', () => window.print());
$('#strategy-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-method]');
  if (!button) return;
  selectedMethod = button.dataset.method;
  refresh();
});

renderDebts(DEMO_DEBTS);
refresh();
