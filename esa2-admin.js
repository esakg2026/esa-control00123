/* ESA Control 2.0 · Этап 5: Руководитель 2.0, профиль компании, справочники, помощь в шапке.
   S.prof — профиль фирмы (реквизиты для смет и актов), S.rates — справочник ставок. Оба в настройках фирмы (вид 'g'). */
(function () {
  'use strict';
  const own = () => ME == null && S && S.role == 'admin';
  const h1 = (n) => Math.round(n / 360) / 10;   // секунды → часы с 1 знаком
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');

  /* ---------- Руководитель 2.0: по сотрудникам и по компаниям ---------- */
  let OPEN = {};
  window.dsTog = (id) => { OPEN[id] = !OPEN[id]; go(); };
  function agg(L) {
    const done = L.filter((t) => t.st == 'done'), ok = done.filter((t) => t.ok).length;
    return { n: L.length, done: done.length, ok, late: done.length - ok, rev: L.filter((t) => t.st == 'rev').length, od: L.filter(od).length, sec: L.reduce((a, t) => a + spent(t), 0), plan: L.reduce((a, t) => a + (+t.h || 0), 0) };
  }
  const row = (name, a, extra, pad) => `<tr ${extra || ''}><td style="padding-left:${pad || 8}px">${name}</td><td class="tm">${a.n}</td><td class="tm">${a.done} <span style="color:var(--mu)">(${pct(a.done, a.n)})</span></td><td class="tm" style="color:${a.done && a.ok / a.done < 0.7 ? 'var(--er)' : 'var(--ok)'}">${pct(a.ok, a.done)}</td><td>${a.od ? `<span class="tg er">${a.od}</span>` : '0'}</td><td>${a.rev ? `<span class="tg wa">${a.rev}</span>` : '0'}</td><td class="tm">${h1(a.sec)} ч${a.plan ? ` <span style="color:var(--mu)">/ план ${Math.round(a.plan * 10) / 10}</span>` : ''}</td></tr>`;
  const head = (first) => `<tr><th>${first}</th><th>Задач</th><th>Выполнено</th><th>Вовремя</th><th>Просрочено сейчас</th><th>На проверке</th><th>Время</th></tr>`;
  const _dash = V.dash;
  V.dash = function () {
    const base = _dash.call(V);
    if (!S.tasks.length) return base;
    const m = DM(), Tm = S.tasks.filter((t) => t.due && t.due.slice(0, 7) == m), cur = TD().slice(0, 7);
    const odAll = (L) => L.filter(od).length;
    // по сотрудникам (просрочено — сейчас, вне периода)
    const emps = S.emps.filter((e) => Tm.some((t) => t.emp == e.id) || S.tasks.some((t) => t.emp == e.id && od(t)));
    const byEmp = emps.map((e) => {
      const L = Tm.filter((t) => t.emp == e.id), a = agg(L); a.od = odAll(S.tasks.filter((t) => t.emp == e.id));
      const cls = [...new Set(L.map((t) => t.cl))].map((cl) => { const LL = L.filter((t) => t.cl == cl), b = agg(LL); b.od = odAll(S.tasks.filter((t) => t.emp == e.id && t.cl == cl)); return [cl, b]; }).sort((x, y) => y[1].od - x[1].od || y[1].n - x[1].n);
      return [e, a, cls];
    }).sort((x, y) => y[1].od - x[1].od || y[1].n - x[1].n);
    const empH = byEmp.map(([e, a, cls]) => row(`<b style="cursor:pointer" onclick="dsTog(${e.id})">${OPEN[e.id] ? '▾' : '▸'} ${E(e.n)}</b> <span class="tg">${ROLES[e.r]}</span>${e.off ? ' <span class="tg er">доступ отключён</span>' : ''}`, a) + (OPEN[e.id] ? cls.map(([cl, b]) => row(E(cn(cl)), b, 'style="background:var(--soft)"', 30)).join('') || `<tr><td colspan=7 style="padding-left:30px;color:var(--mu)">В этом месяце задач нет</td></tr>` : '')).join('');
    // по компаниям
    const byCl = CL().map((c) => { const L = Tm.filter((t) => t.cl == c.id), a = agg(L); a.od = odAll(S.tasks.filter((t) => t.cl == c.id)); return [c, a]; }).filter(([, a]) => a.n || a.od).sort((x, y) => y[1].od - x[1].od || y[1].n - x[1].n);
    const clH = byCl.map(([c, a]) => row(`<b style="cursor:pointer" onclick="cc(${c.id})">${E(c.n)}</b> <span style="color:var(--mu);font-size:12px">${E(en(c.ex || c.ch))}</span>`, a)).join('');
    const noTasks = CL().filter((c) => c.act && !S.tasks.some((t) => t.cl == c.id && t.due && t.due.slice(0, 7) >= cur)).length;
    const add = `<div class="c tw" style="margin-bottom:14px"><h3>По сотрудникам <span style="font-weight:400;color:var(--mu);font-size:12px">${E(moN(m))} · «Просрочено сейчас» — по всем месяцам · строка раскрывает компании</span></h3><table>${head('Сотрудник')}${empH || '<tr><td colspan=7>В этом месяце задач нет</td></tr>'}</table></div>
      <div class="c tw" style="margin-bottom:14px"><h3>По компаниям <span style="font-weight:400;color:var(--mu);font-size:12px">${E(moN(m))}${noTasks ? ` · <span class="tg wa">без задач на будущее: ${noTasks}</span>` : ''}</span></h3><table>${head('Компания')}${clH || '<tr><td colspan=7>Нет данных за выбранный месяц</td></tr>'}</table></div>`;
    return base + add;
  };

  /* ---------- Профиль компании ---------- */
  const P = () => (S.prof = S.prof || {});
  window.prForm = function () {
    if (!own()) return; const p = P();
    const f = (k, t, ph, typ) => `<div class="kv"><span>${t}</span><input id="pf_${k}" type="${typ || 'text'}" value="${E(p[k] || '')}" placeholder="${E(ph || '')}"></div>`;
    modal(`<h3>Профиль компании</h3><p style="color:var(--mu);font-size:13px;margin:0">Реквизиты попадают в шапку смет и актов как данные исполнителя, банковские — в подвал для оплаты.</p><div id="pf_e"></div>
      ${f('name', 'Название в системе *', 'ESA')}${f('legal', 'Полное юридическое название', 'ОсОО «Название» (если пусто — название в системе)')}${f('inn', 'ИНН (14 цифр)', '')}${f('phone', 'Телефон', '+996 700 000 000')}${f('email', 'Электронная почта', 'info@firma.kg')}${f('addr', 'Адрес', 'г. Ош, ул. …')}${f('dir', 'Руководитель (подписывает акты)', 'Фамилия И.О.')}
      <b style="margin-top:6px">Банковские реквизиты</b>${f('bank', 'Банк', '')}${f('acc', 'Расчётный счёт (16 цифр)', '')}${f('bik', 'БИК (6 цифр)', '')}
      <div class="row"><button class="b p" onclick="prSave()">Сохранить</button><button class="b" onclick="mx()">Отмена</button></div>`);
  };
  window.prSave = function () {
    const v = (k) => document.getElementById('pf_' + k).value.trim(), err = (m) => { document.getElementById('pf_e').innerHTML = `<div class="tg er" role="alert" style="display:block;white-space:normal;padding:8px">${E(m)}</div>`; };
    const n = { name: v('name'), legal: v('legal'), inn: v('inn').replace(/\s/g, ''), phone: v('phone'), email: v('email'), addr: v('addr'), dir: v('dir'), bank: v('bank'), acc: v('acc').replace(/\s/g, ''), bik: v('bik').replace(/\s/g, '') };
    if (!n.name) return err('Укажите название в системе.');
    if (n.inn && !/^\d{14}$/.test(n.inn)) return err('ИНН — это 14 цифр.');
    if (n.email && !/^\S+@\S+\.\S+$/.test(n.email)) return err('Электронная почта указана неверно.');
    if (n.phone && n.phone.replace(/\D/g, '').length < 9) return err('Телефон: не меньше 9 цифр.');
    if (n.acc && !/^\d{16}$/.test(n.acc)) return err('Расчётный счёт — 16 цифр.');
    if (n.bik && !/^\d{6}$/.test(n.bik)) return err('БИК — 6 цифр.');
    if ((n.acc || n.bik) && !n.bank) return err('Укажите банк для расчётного счёта.');
    Object.keys(n).forEach((k) => { if (!n[k]) delete n[k]; n[k] && (n[k] = String(n[k]).slice(0, 200)); });
    S.prof = n; logA('изменил профиль компании'); save(); mx(); toast('Сохранено'); go();
  };
  window.ESA2 = window.ESA2 || {};
  window.ESA2.firm = () => { const p = S.prof || {}; return { name: p.legal || p.name || (SYNC && SYNC.firm && SYNC.firm.name) || 'ESA Control', inn: p.inn, addr: p.addr, phone: p.phone, email: p.email, dir: p.dir, bank: p.bank, acc: p.acc, bik: p.bik }; };

  /* ---------- Справочник ставок ---------- */
  const R = () => (S.rates = S.rates || []);
  window.rtForm = function (id) {
    if (!own()) return; const r = id ? R().find((x) => x.id == id) : { n: '', unit: '', price: 0, cond: '' }; if (!r) return;
    modal(`<h3>${id ? 'Изменить ставку' : 'Новая ставка'}</h3><div id="rt_e"></div><div class="kv"><span>Название *</span><input id="rt_n" value="${E(r.n)}" maxlength="120" placeholder="Например: Обработка одного документа"></div><div class="row"><div class="kv" style="flex:1"><span>Единица *</span><input id="rt_u" value="${E(r.unit)}" placeholder="час, документ, сотрудник"></div><div class="kv" style="flex:1"><span>Цена, сом *</span><input id="rt_p" type="number" min="0" value="${E(r.price)}"></div></div><div class="kv"><span>Условия применения</span><textarea id="rt_c" rows="2">${E(r.cond || '')}</textarea></div><div class="row"><button class="b p" onclick="rtSave('${id || ''}')">${id ? 'Сохранить' : 'Создать'}</button><button class="b" onclick="mx()">Отмена</button></div>`);
  };
  window.rtSave = function (id) {
    const n = document.getElementById('rt_n').value.trim(), u = document.getElementById('rt_u').value.trim(), p = document.getElementById('rt_p').value, c = document.getElementById('rt_c').value.trim();
    const err = (m) => { document.getElementById('rt_e').innerHTML = `<div class="tg er" role="alert" style="display:block;padding:8px">${E(m)}</div>`; };
    if (!n) return err('Укажите название ставки.'); if (!u) return err('Укажите единицу (час, документ…).');
    if (p === '' || !(+p >= 0)) return err('Цена — число не меньше нуля.');
    if (R().some((x) => x.id != id && x.n.toLowerCase() == n.toLowerCase())) return err('Ставка с таким названием уже есть.');
    if (id) Object.assign(R().find((x) => x.id == id), { n, unit: u.slice(0, 40), price: +p, cond: c.slice(0, 500) });
    else R().push({ id: 'r' + Date.now().toString(36), n: n.slice(0, 120), unit: u.slice(0, 40), price: +p, cond: c.slice(0, 500) });
    logA((id ? 'изменил' : 'добавил') + ' ставку: ' + n); save(); mx(); toast('Сохранено'); go();
  };
  window.rtDel = function (id) { const r = R().find((x) => x.id == id); if (!r) return; ask('Удалить ставку «' + r.n + '»?', () => { S.rates = R().filter((x) => x.id != id); logA('удалил ставку: ' + r.n); save(); toast('Удалено'); go(); }); };

  /* ---------- Сферы и группы (по каталогу процессов): переименование везде ---------- */
  window.sgRen = function (k, old) {
    if (!own()) return;
    modal(`<h3>Переименовать ${k == 'sp' ? 'сферу' : 'группу'}</h3><p style="color:var(--mu);font-size:13px">Название поменяется во всех бизнес-процессах.</p><input id="sg_n" value="${E(old)}" maxlength="80"><div id="sg_e"></div><div class="row"><button class="b p" id="sg_ok">Сохранить</button><button class="b" onclick="mx()">Отмена</button></div>`);
    document.getElementById('sg_ok').onclick = () => { const v = document.getElementById('sg_n').value.trim(); if (!v) { document.getElementById('sg_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Название не может быть пустым.</div>'; return; } let n = 0; (S.bp || []).forEach((b) => { if (b[k] == old) { b[k] = v; n++; } }); logA('переименовал ' + (k == 'sp' ? 'сферу' : 'группу') + ' «' + old + '» → «' + v + '» (' + n + ' процессов)'); save(); mx(); toast('Переименовано в процессах: ' + n); go(); };
  };
  window.knoList = function () {
    const K = (window.ESA2 && window.ESA2.KNO) || [];
    modal(`<h3>Коды налоговых органов (${K.length})</h3><p style="color:var(--mu);font-size:13px;margin:0">Общий справочник ГНС КР. Используется в карточке клиента (код НО и филиалы). Изменяется только с обновлением программы — чтобы в нём не появлялся мусор.</p><input placeholder="🔎 Поиск по коду или району" oninput="[...document.querySelectorAll('#kno_t tr')].forEach(r=>r.style.display=r.innerText.toLowerCase().includes(this.value.toLowerCase())?'':'none')"><div class="tw" style="max-height:360px;overflow:auto"><table id="kno_t">${K.map((k) => `<tr><td class="tm">${k[0]}</td><td>${E(k[1])}</td></tr>`).join('')}</table></div><div class="row"><button class="b" onclick="mx()">Закрыть</button></div>`);
  };

  /* ---------- Настройки: новые карточки ---------- */
  const _set = V.set;
  V.set = function () {
    const h = _set.call(V), p = S.prof || {}, bp = S.bp || [];
    const sps = [...new Set(bp.map((b) => b.sp).filter(Boolean))].sort(), grs = [...new Set(bp.map((b) => b.gr).filter(Boolean))].sort();
    const cnt = (k, v) => bp.filter((b) => b[k] == v).length;
    const prof = `<div class="c"><h3>Профиль компании</h3>${p.name ? `<p><b>${E(p.legal || p.name)}</b>${p.inn ? '<br>ИНН ' + E(p.inn) : ''}${p.addr ? '<br>' + E(p.addr) : ''}${p.dir ? '<br>Руководитель: ' + E(p.dir) : ''}${p.bank ? '<br>' + E(p.bank) + (p.acc ? ', р/с ' + E(p.acc) : '') + (p.bik ? ', БИК ' + E(p.bik) : '') : ''}</p>` : '<p style="color:var(--mu)">Реквизиты не заполнены — сметы печатаются без них.</p>'}<div class="row" style="margin-top:8px"><button class="b p" onclick="prForm()">Изменить</button></div></div>`;
    const rates = `<div class="c"><h3>Справочник ставок</h3><p style="color:var(--mu);font-size:13px">Базовые ставки с единицами и условиями — для расчёта доп. услуг и счетов.</p><div class="tw"><table><tr><th>Название</th><th>Единица</th><th>Цена</th><th></th></tr>${R().map((r) => `<tr><td>${E(r.n)}${r.cond ? `<br><span style="font-size:12px;color:var(--mu)">${E(r.cond)}</span>` : ''}</td><td>${E(r.unit)}</td><td class="tm">${Math.round(r.price).toLocaleString('ru-RU')} сом</td><td><button class="b s" onclick="rtForm('${r.id}')" aria-label="Изменить">${PEN}</button> <button class="b s r" onclick="rtDel('${r.id}')" aria-label="Удалить">✕</button></td></tr>`).join('') || '<tr><td colspan=4>Ставок пока нет</td></tr>'}</table></div><div class="row" style="margin-top:8px"><button class="b p" onclick="rtForm()">+ Ставка</button></div></div>`;
    const sg = `<div class="c"><h3>Сферы и группы процессов</h3><p style="color:var(--mu);font-size:13px">Берутся из каталога бизнес-процессов. Нажмите ✎, чтобы переименовать во всех процессах сразу.</p><b>Сферы (${sps.length})</b><div>${sps.map((s) => `<span class="chip">${E(s)} <span style="color:var(--mu)">${cnt('sp', s)}</span><button onclick="sgRen('sp','${E(s).replace(/'/g, '&#39;')}')" style="color:var(--ac)">✎</button></span>`).join('') || '<span style="color:var(--mu)">— загрузите каталог процессов —</span>'}</div><b style="display:block;margin-top:8px">Группы (${grs.length})</b><div>${grs.map((s) => `<span class="chip">${E(s)} <span style="color:var(--mu)">${cnt('gr', s)}</span><button onclick="sgRen('gr','${E(s).replace(/'/g, '&#39;')}')" style="color:var(--ac)">✎</button></span>`).join('')}</div></div>`;
    const misc = `<div class="c"><h3>Биллинг и коды НО</h3><p style="font-size:13px"><b>Биллинг</b> — 4 типа: «Входит в абонентку» (0 сверх тарифа), «Считается по количеству» (цена × кол-во), «Доп. услуга» (цена), «Не тарифицируется». Задаётся у каждого процесса в каталоге.</p><div class="row"><button class="b" onclick="knoList()">Коды налоговых органов (${((window.ESA2 && window.ESA2.KNO) || []).length})</button></div></div>`;
    return own() ? h.replace('<div class="gr g2">', '<div class="gr g2">' + prof + rates + sg + misc) : h;
  };

  /* ---------- Шапка: помощь и меню профиля ---------- */
  const HELP = {
    dash: 'Сводка за месяц: задачи, выполнение, «вовремя», просрочки сейчас, проверка, время. Ниже — по сотрудникам (щёлкните строку, чтобы раскрыть компании) и по компаниям.',
    cl: 'Клиенты: фильтры по ответственному, статусу, СНО и форме, сортировка. ✎ — карточка клиента из 12 разделов. Удалённые клиенты — в «🗑 Удалённые», их можно вернуть.',
    sm: 'Сметы: процессы подбираются по режиму налогообложения и характеристикам клиента. Цена = тариф + доп. услуги. «Сохранить и создать задачи» создаёт задачи на «План вперёд».',
    tk: 'Задачник: ☰ или двойной щелчок — карточка задачи. Задачу с подпунктами нельзя закрыть, пока они не отмечены; с обязательным документом — без файла. «Я поручил» — ваши поручения, их можно отозвать.',
    st: 'Сотрудники: поиск по ФИО и телефону, карточка с датами, «Уволить и передать работу» — работа уходит выбранному сотруднику, вход отключается.',
    qa: 'Аудит качества: вердикт по каждой закрытой задаче периода и чек-лист. Замечания передаются исполнителю задачей и закрываются, когда задача выполнена.',
    au: 'Автоаудит: программа сама читает принятые Excel-отчёты (НДС, НсП, Форма 161, ОСВ, косвенные налоги, налог на прибыль) и сверяет суммы.',
    set: 'Настройки: профиль компании, бизнес-процессы, ставки, сферы и группы, тарифы, справочники.'
  };
  window.hpOpen = function () {
    const v = S && S.view, t = HELP[v] || 'Выберите раздел слева. В каждом разделе есть подсказки и проверки ввода.';
    modal(`<h3>Нужна помощь?</h3><p><b>${E(TITLE[v] || '')}</b><br>${E(t)}</p><p style="color:var(--mu);font-size:13px">Горячие клавиши: Esc — закрыть окно.</p><div class="row"><button class="b p" onclick="mx();sup()">✉ Написать в техподдержку</button><button class="b" onclick="mx()">Понятно</button></div>`);
  };
  window.pmOpen = function () {
    const nm = ME != null ? en(ME) : (LG || CU || ''), role = ME != null ? ROLES[S.role] : 'Руководитель';
    modal(`<h3>${E(nm)}</h3><p style="color:var(--mu);margin:0">${E(role)}${S.prof && S.prof.name ? ' · ' + E(S.prof.name) : ''}</p><div class="row" style="margin-top:10px">${ONL ? `<button class="b" onclick="mx();pwForm()">Сменить пароль</button>` : ''}${own() ? `<button class="b" onclick="mx();S.view='set';go()">Настройки</button>` : ''}<button class="b r" onclick="mx();out()">Выйти</button></div>`);
  };
  const _go = window.go;
  window.go = function () {
    _go.apply(this, arguments);
    try {
      const tb = $('#tb'); if (!tb || !S || document.getElementById('hp_b')) return;
      const last = tb.lastElementChild;
      tb.insertAdjacentHTML('beforeend', `<button class="b" id="hp_b" onclick="hpOpen()" aria-label="Нужна помощь?" title="Нужна помощь?">?</button><button class="b" id="pm_b" onclick="pmOpen()" title="Профиль">${E(((ME != null ? en(ME) : LG || CU || '?') + '').trim().charAt(0).toUpperCase())}</button>`);
    } catch (e) { }
  };

  if (typeof S !== 'undefined' && S) { try { go(); } catch (e) { } }
})();
