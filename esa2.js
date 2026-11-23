/* ESA Control 2.0 · Этап 1: клиенты и сотрудники.
   Подключается после основного скрипта index.html и дополняет его (функции go, save, logA, S, ME, ONL и т.д. — оттуда).
   Новые поля клиента хранятся в той же записи клиента (вид 'c'), сотрудника — в записи сотрудника (вид 'e'),
   корзина удалённых клиентов — в настройках фирмы (S.trash, вид 'g'). Сервер менять не нужно. */
(function () {
  'use strict';

  /* ---------- Справочники ---------- */
  const KNO = [["001","Октябрьский район"],["002","Ленинский район"],["003","Свердловский район"],["004","Первомайский район"],["005","Аламудунский район"],["007","Кеминский район"],["008","Иссык-Атинский район"],["009","Жайылский район"],["010","Московский район"],["011","Панфиловский район"],["012","Сокулукский район"],["013","Чуйский район"],["014","Иссык-Кульский район"],["015","Ак-Суйский район"],["016","Тонский район"],["017","Жети-Огузский район"],["018","Тюпский район"],["019","г. Каракол"],["020","г. Балыкчы"],["021","Алайский район"],["022","Чон-Алайский район"],["023","Араванский район"],["024","Баткенский район"],["025","Кара-Сууйский район"],["026","Лейлякский район"],["027","Ноокатский район"],["028","Кара-Кульджинский район"],["029","Узгенский район"],["030","Кадамжайский район"],["031","г. Кызыл-Кия"],["032","г. Ош"],["033","г. Сулюкта"],["034","Ак-Талинский район"],["035","Ат-Башинский район"],["036","Кочкорский район"],["037","Жумгальский район"],["038","Нарынский район"],["039","Сузакский район"],["040","Ноокенский район"],["041","Ала-Букинский район"],["042","Токтогулский район"],["043","Аксыйский район"],["044","Тогуз-Тороузский район"],["045","Базар-Коргонский район"],["047","Чаткалский район"],["048","г. Джалал-Абад"],["049","г. Таш-Кумыр"],["050","г. Майлы-Суу"],["052","г. Кара-Куль"],["053","Таласский район"],["054","Бакай-Атинский район"],["055","Кара-Буринский район"],["056","Манаский район"],["057","г. Талас"],["058","г. Чуй-Токмок"],["059","г. Нарын"],["060","г. Баткен"],["100","г. Бишкек"],["997","УККН Юг (крупные налогоплательщики, юг)"],["998","СЭЗ Бишкек"],["999","УККН (крупные налогоплательщики)"]];
  const OFORM = ['ОсОО', 'ИП', 'ЗАО', 'ОАО', 'ОсДО', 'КК', 'ОФ', 'Филиал/представительство'];
  const CSTAT = { a: 'Активен', p: 'Приостановлен', z: 'Завершён' };
  const DIR = ['Кассовый метод', 'Метод начисления'];
  const KAT = ['Малый субъект (до 8 млн)', 'Средний субъект (8–50 млн)', 'Крупный субъект (от 50 млн)'];
  const STYPE = ['Полное обслуживание', 'Частичное обслуживание', 'Только отчётность', 'Разовые услуги'];
  const ITSHOW = ['Локальная база', 'Облако (1С:Фреш)', 'Удалённый рабочий стол (RDP)'];
  const CTYPE = ['Телефон', 'WhatsApp', 'Telegram', 'Email', 'Другое'];
  const FLAGS = [['zero','Нулевой клиент'],['employees','Сотрудники'],['kkm','ККМ / Касса'],['marketplaces','Маркетплейсы'],['fixed_assets','ОС'],['fuel','Учёт ГСМ'],['loans','Кредиты / депозиты'],['import_eaeu','Импорт ЕАЭС'],['import_third','Импорт третьи страны'],['export','Экспорт'],['alcohol','Алкоголь'],['insurance_policy','ИП страховой полис'],['mbt','МБТ'],['crypto_exchange','Криптообменник'],['payment_aggregators','Платёжные агрегаторы'],['production','Производство'],['management_report','Управленческий отчёт'],['excise','Акциз / ЭТТН'],['nonresident_services','Нерезиденты ДИО / эл.услуги'],['property','Имущество / транспорт / земля'],['bank_client','Банк-клиент (платёжки)'],['separate_books','Раздельные базы УУ/ТК/НУ/УТ'],['nonstandard_contracts','Нестандартные договоры'],['foreign_trade','Внешнеторговая деятельность'],['vat_refund','Возмещение НДС'],['special_reporting','Спец. отчётность']];
  window.ESA2 = { KNO, OFORM, CSTAT, FLAGS };

  /* ---------- Мелкие помощники ---------- */
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const own = () => ME == null && S && S.role == 'admin';
  const kno = (c) => { const x = KNO.find((k) => k[0] == c); return x ? x[0] + ' — ' + x[1] : (c || ''); };
  const dRu = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '—');
  const cst = (c) => c.stt || (c.act ? 'a' : 'p');
  const val = (v) => (v == null || v === '' ? '—' : E(v));
  const opt = (arr, v, empty) => (empty != null ? `<option value=''>${E(empty)}</option>` : '') + arr.map((x) => { const k = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${E(k)}" ${String(k) == String(v == null ? '' : v) ? 'selected' : ''}>${E(t)}</option>`; }).join('');
  const isDate = (s) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
  const okUrl = (s) => !s || /^https?:\/\/\S+$/i.test(s);
  const digits = (s, a, b) => !s || new RegExp('^\\d{' + a + ',' + b + '}$').test(s);
  const chiefs = () => S.emps.filter((e) => e.r == 'chief' && !eFired(e));
  const accs = () => S.emps.filter((e) => e.r == 'acc' && !eFired(e));
  const eFired = (e) => !!(e && e.fd && e.fd <= TD());
  const EMODS = () => NAV.filter((n) => n[3].split(' ').includes('emp')).map((n) => [n[0], n[1]]);
  const fmtPh = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length == 12 && d.startsWith('996') ? '+996 (' + d.slice(3, 6) + ') ' + d.slice(6, 9) + '-' + d.slice(9) : p || ''; };

  /* ---------- Стили ---------- */
  const st = document.createElement('style');
  st.textContent = `
  #md .c.cc2{width:min(1040px,100%);max-height:calc(100vh - 32px);overflow:auto;display:block;padding:0}
  .cc2 .hd{position:sticky;top:0;z-index:2;background:var(--cd);padding:16px 18px 12px;border-bottom:1px solid var(--bd);display:flex;gap:10px;align-items:flex-start}
  .cc2 .hd h2{font-size:20px;margin:0}.cc2 .bd2{padding:14px 18px 18px;display:grid;gap:12px}
  .sec{border:1px solid var(--bd);border-radius:14px;overflow:hidden}
  .sec>.st{display:flex;align-items:center;gap:8px;padding:10px 14px;background:color-mix(in srgb,var(--ac) 5%,transparent);font-weight:600}
  .sec>.st .sp{margin-left:auto;display:flex;gap:6px}
  .sec>.sb{padding:12px 14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 18px}
  .kv span{display:block;font-size:12px;color:var(--mu)}.kv b{font-weight:500;word-break:break-word}
  .kv input,.kv select,.kv textarea{width:100%;margin-top:3px}
  .sec .err{grid-column:1/-1;color:var(--er);background:color-mix(in srgb,var(--er) 10%,transparent);border-radius:8px;padding:8px 10px}
  .flg{display:flex;flex-wrap:wrap;gap:6px;grid-column:1/-1}.flg .tg{font-weight:500}
  .flg label{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--bd);border-radius:10px;padding:6px 10px;cursor:pointer}
  .full{grid-column:1/-1}.sec table td,.sec table th{padding:6px}
  .th-s{cursor:pointer;user-select:none}.th-s:hover{color:var(--ac)}
  .sec .lst{grid-column:1/-1;display:grid;gap:6px}.sec .lst .row{margin:0}
  `;
  document.head.appendChild(st);

  /* ---------- Список клиентов: фильтры, сортировка, корзина ---------- */
  S && (S.cf = S.cf || {});
  const CF = () => (S.cf = S.cf || { st: '', reg: '', of: '', rp: '', sort: '', dir: 1 });
  const respOf = (c) => c.ex || c.ch || 0;
  function clFilt(L) {
    const f = CF();
    L = L.filter((c) => (!f.st || cst(c) == f.st) && (!f.reg || (f.reg == '—' ? !c.reg : c.reg == f.reg)) && (!f.of || (f.of == '—' ? !c.of : c.of == f.of)) && (!f.rp || (f.rp == '0' ? !respOf(c) : String(c.ex) == f.rp || String(c.ch) == f.rp)));
    if (f.sort) {
      const k = { n: (c) => String(c.n).toLowerCase(), no: (c) => c.no || 1e9, rp: (c) => en(respOf(c)).toLowerCase(), kno: (c) => c.kno || 'я' }[f.sort];
      L = L.slice().sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0) * f.dir);
    }
    return L;
  }
  window.clSort = (k) => { const f = CF(); if (f.sort == k) f.dir = -f.dir; else { f.sort = k; f.dir = 1; } go(); };
  window.clF = (k, v) => { CF()[k] = v; go(); };
  window.clFReset = () => { S.cf = { st: '', reg: '', of: '', rp: '', sort: '', dir: 1 }; S.q = ''; S.f = 'all'; go(); };

  const _cl = V.cl;
  V.cl = function () {
    const html = _cl.call(V), f = CF(), arrow = (k) => (f.sort == k ? (f.dir > 0 ? ' ↑' : ' ↓') : '');
    const emps = S.emps.filter((e) => S.clients.some((c) => c.ex == e.id || c.ch == e.id));
    const bar = `<div class="row" id="cl2f"><select onchange="clF('rp',this.value)" title="Ответственный"><option value="">Ответственный: все</option><option value="0" ${f.rp == '0' ? 'selected' : ''}>— не назначен —</option>${emps.map((e) => `<option value="${e.id}" ${f.rp == String(e.id) ? 'selected' : ''}>${E(e.n)}</option>`).join('')}</select>
      <select onchange="clF('st',this.value)"><option value="">Статус: все</option>${Object.entries(CSTAT).map(([k, t]) => `<option value="${k}" ${f.st == k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select onchange="clF('reg',this.value)"><option value="">СНО: все</option><option value="—" ${f.reg == '—' ? 'selected' : ''}>— не указан —</option>${S.ref.reg.map((r) => `<option ${f.reg == r ? 'selected' : ''}>${E(r)}</option>`).join('')}</select>
      <select onchange="clF('of',this.value)"><option value="">Форма: все</option><option value="—" ${f.of == '—' ? 'selected' : ''}>— не указана —</option>${OFORM.map((r) => `<option ${f.of == r ? 'selected' : ''}>${E(r)}</option>`).join('')}</select>
      <span style="color:var(--mu)">Сортировка:</span><button class="b s ${f.sort == 'n' ? 'p' : ''}" onclick="clSort('n')">Название${arrow('n')}</button><button class="b s ${f.sort == 'no' ? 'p' : ''}" onclick="clSort('no')">Номер${arrow('no')}</button><button class="b s ${f.sort == 'rp' ? 'p' : ''}" onclick="clSort('rp')">Ответственный${arrow('rp')}</button>
      ${f.st || f.reg || f.of || f.rp || f.sort || S.q ? `<button class="b s" onclick="clFReset()">Сбросить всё</button>` : ''}
      ${own() ? `<button class="b s" style="margin-left:auto" onclick="trOpen()">🗑 Удалённые (${(S.trash || []).length})</button>` : ''}</div>`;
    return html.replace('<div class="c tw" id="tbl">', bar + '<div class="c tw" id="tbl">');
  };
  const _tbl = V.tbl;
  V.tbl = function (L) {
    L = clFilt(L);
    let h = _tbl.call(V, L);
    // в таблицу: форма собственности перед названием, код НО под ИНН, статус из карточки
    L.forEach((c) => {
      const st = cst(c), lbl = CSTAT[st], cls = st == 'a' ? 'ok' : st == 'z' ? 'er' : 'wa';
      h = h.replace(`onclick="cc(${c.id})">${E(c.n)}</b>`, `onclick="cc(${c.id})">${E(c.n)}</b>${c.of ? `<br><span style="font-size:11px;color:var(--mu)">${E(c.of)}${c.kno ? ' · НО ' + E(c.kno) : ''}</span>` : c.kno ? `<br><span style="font-size:11px;color:var(--mu)">НО ${E(c.kno)}</span>` : ''}`);
      h = h.replace(new RegExp(`(onclick="tgl\\(${c.id}\\)">⏸</button>)`), `$1`);
    });
    // статус «Активен/Пауза» → три статуса
    h = h.replace(/<span class="tg (ok|wa)">(Активен|Пауза)<\/span><\/td><td><button class="b s" onclick="tgl\((\d+)\)">/g, (m, cls, t, id) => {
      const c = S.clients.find((x) => x.id == id), s = c ? cst(c) : 'a';
      return `<span class="tg ${s == 'a' ? 'ok' : s == 'z' ? 'er' : 'wa'}">${CSTAT[s]}</span></td><td><button class="b s" title="Открыть карточку" onclick="cc(${id})">${PEN}</button> <button class="b s" title="Пауза / продолжить" onclick="tgl(${id})">`;
    });
    return h;
  };
  // «Пауза» в таблице меняет и статус карточки
  const _tgl = window.tgl;
  window.tgl = function (id) { const c = S.clients.find((x) => x.id == id); if (c && cst(c) == 'z') { toast('Клиент завершён: измените статус в карточке'); return; } _tgl(id); const c2 = S.clients.find((x) => x.id == id); if (c2) { c2.stt = c2.act ? 'a' : 'p'; save(); } };

  /* Корзина: удаление клиента не стирает его навсегда */
  window.del = function (id) {
    if (!own()) { toast('Удалять клиентов может только руководитель'); return; }
    const c = S.clients.find((x) => x.id == id); if (!c) return;
    const T = S.tasks.filter((t) => t.cl == id), open = T.filter((t) => t.st != 'done').length;
    ask(`Переместить «${c.n}» в «Удалённые»? Задач: ${T.length} (открытых ${open}). Клиента можно будет вернуть вместе с задачами.`, () => {
      S.trash = (S.trash || []).filter((x) => x.c && x.c.id != id);
      const rec = { c: JSON.parse(JSON.stringify(c)), t: JSON.parse(JSON.stringify(T)), at: Date.now(), by: LG || CU || '' };
      if (JSON.stringify(rec).length > 120000) { rec.t = rec.t.filter((t) => t.st != 'done'); rec.cut = 1; }
      S.trash.unshift(rec); S.trash = S.trash.slice(0, 50);
      S.clients = S.clients.filter((x) => x.id != id); S.tasks = S.tasks.filter((t) => t.cl != id);
      logA('удалил клиента (в корзину): ' + c.n); toast('Клиент в «Удалённых». Вернуть: Клиенты → 🗑 Удалённые'); save(); go();
    });
  };
  window.trOpen = function () {
    const L = S.trash || [];
    $('#md').innerHTML = `<div class="c" style="width:min(720px,100%)"><h3>Удалённые клиенты (${L.length})</h3><p style="color:var(--mu);font-size:13px">Клиент вернётся вместе с задачами. Если за это время его ИНН или номер займёт другой клиент, система предупредит. Хранятся последние 50.</p>
      <div class="tw"><table><tr><th>Клиент</th><th>ИНН</th><th>Задач</th><th>Удалён</th><th></th></tr>${L.map((r, i) => `<tr><td><b>${E(r.c.n)}</b></td><td class="tm">${E(r.c.inn || '')}</td><td>${r.t.length}${r.cut ? ' (только открытые)' : ''}</td><td style="font-size:12px">${new Date(r.at).toLocaleString('ru-RU')}<br>${E(r.by)}</td><td><button class="b s g" onclick="trBack(${i})">↩ Вернуть</button> <button class="b s r" onclick="trKill(${i})">Удалить навсегда</button></td></tr>`).join('') || '<tr><td colspan=5>Удалённых клиентов нет</td></tr>'}</table></div>
      <div class="row" style="margin-top:10px"><button class="b" onclick="mx()">Закрыть</button></div></div>`;
    $('#md').className = 'on';
  };
  window.trBack = function (i) {
    const r = (S.trash || [])[i]; if (!r) return;
    const c = r.c, dup = S.clients.find((x) => (c.inn && x.inn == c.inn) || (c.no && x.no == c.no));
    if (dup) { toast('Не вернуть: ИНН или номер уже у клиента «' + dup.n + '»'); return; }
    S.clients.push(c); r.t.forEach((t) => { if (!S.tasks.some((x) => x.id == t.id)) S.tasks.push(t); });
    S.trash.splice(i, 1); logA('вернул клиента из корзины: ' + c.n); toast('Клиент возвращён вместе с задачами'); save(); trOpen(); go();
  };
  window.trKill = function (i) {
    const r = (S.trash || [])[i]; if (!r) return;
    mx(); ask('Удалить «' + r.c.n + '» навсегда? Вернуть будет нельзя.', () => { S.trash.splice(i, 1); logA('удалил клиента навсегда: ' + r.c.n); toast('Удалён навсегда'); save(); go(); });
  };

  /* ---------- Карточка клиента: 13 разделов ---------- */
  let CC = null, ED = null, SHOWPW = false, ERR = '';
  const SECS = [
    ['basic', 'ⓘ', 'Основная информация'], ['status', '◷', 'Статус и период обслуживания'], ['tax', '≡', 'Налоговые данные'],
    ['flags', '☰', 'Характеристики бизнеса и филиалы'], ['contract', '✎', 'Договор и обслуживание'], ['attorney', '§', 'Доверенность'],
    ['its', '⚙', 'ИТС (1С)'], ['eds', '🔑', 'ЭЦП и Тундук ЕСИ'], ['banks', '🏦', 'Интернет-банкинг'], ['contacts', '☎', 'Контакты и связанные лица'],
    ['extras', '📁', 'Папка и доступы'], ['notes', '✍', 'Примечания']];
  const PV = (v) => (window.VLT ? VLT.pv(v) : v), LOCKED = (v) => !!(window.VLT && VLT.isEnc(v) && PV(v) == null);
  const VSECS = ['its', 'eds', 'banks', 'extras'];
  const secret = (k, v) => !v ? '—' : !own() ? '•••• (видит только руководитель)' : LOCKED(v) ? '🔒 в сейфе' : SHOWPW ? `<span class="tm">${E(PV(v))}</span> <button class="b s" onclick="ccCopy('${k}')">Копировать</button>` : `•••••••• <button class="b s" onclick="ccCopy('${k}')">Копировать</button>`;
  const kv = (t, v, cls) => `<div class="kv ${cls || ''}"><span>${t}</span><b>${v}</b></div>`;
  const inp = (t, id, v, typ, extra) => `<div class="kv ${extra || ''}"><span>${t}</span><input id="cf_${id}" type="${typ || 'text'}" value="${E(v == null ? '' : v)}"></div>`;
  const sel = (t, id, arr, v, empty, extra) => `<div class="kv ${extra || ''}"><span>${t}</span><select id="cf_${id}">${opt(arr, v, empty)}</select></div>`;
  const area = (t, id, v) => `<div class="kv full"><span>${t}</span><textarea id="cf_${id}" rows="3">${E(v || '')}</textarea></div>`;
  const g = (id) => { const e = document.getElementById('cf_' + id); return e ? (e.type == 'checkbox' ? e.checked : String(e.value).trim()) : undefined; };
  const empArr = (L) => L.map((e) => [e.id, e.n]);

  function view(c, k) {
    const f = c.fl || {}, its = c.its || {}, eds = c.eds || {};
    switch (k) {
      case 'basic': return kv('Форма собственности', val(c.of)) + kv('Название', E(c.n)) + kv('ИНН', `<span class="tm">${val(c.inn)}</span>`) + kv('Номер компании', val(c.no)) + kv('ИНН руководителя', `<span class="tm">${val(c.dinn)}</span>`) + kv('Код налогового органа', val(kno(c.kno))) + kv('Основной вид деятельности', val(c.av)) + kv('ИНН для ЭТТН', `<span class="tm">${val(c.ettn)}</span>`);
      case 'status': { const s = cst(c); return kv('Статус', `<span class="tg ${s == 'a' ? 'ok' : s == 'z' ? 'er' : 'wa'}">${CSTAT[s]}</span>`) + kv('Начало обслуживания', dRu(c.sd)) + kv('Окончание', c.ed ? dRu(c.ed) : 'Бессрочно'); }
      case 'tax': return kv('Система налогообложения', val(c.reg)) + kv('Метод учёта доходов и расходов', val(c.dir)) + kv('Категория налогоплательщика', val(c.kat)) + kv('Тариф', val(c.tar)) + kv('Налоги клиента', val(typeof nalT == 'function' ? nalT(c) : ''));
      case 'flags': { const on = FLAGS.filter((x) => f[x[0]]); return `<div class="flg">${on.map((x) => `<span class="tg ok">${E(x[1])}</span>`).join('') || '<span style="color:var(--mu)">Особенностей не отмечено</span>'}</div>` + kv('Филиалы (отчёты по филиалам в разные НО)', (c.br || []).map((b) => E(kno(b))).join('<br>') || '—', 'full'); }
      case 'contract': return kv('Тип обслуживания', val(c.stype)) + kv('С кем составлен договор', val(c.cwho)) + kv('Главбух', val(en(c.ch) == '—' ? '' : en(c.ch))) + kv('Исполнитель (ответственный)', val(c.ex ? en(c.ex) : '')) + kv('Договор', c.curl ? `<a href="${E(c.curl)}" target="_blank" rel="noopener">открыть ↗</a>` : '—') + kv('Реквизиты', c.rurl ? `<a href="${E(c.rurl)}" target="_blank" rel="noopener">открыть ↗</a>` : '—');
      case 'attorney': { const soon = c.atto && c.atto < iso(30); return kv('Доверенность на имя', val(c.att ? en(c.att) : '')) + kv('Срок действия', c.atto ? `${dRu(c.atto)}${c.atto < TD() ? ' <span class="tg er">истекла</span>' : soon ? ' <span class="tg wa">скоро истекает</span>' : ''}` : '—'); }
      case 'its': return kv('Обслуживание ИТС', its.on ? 'Подключено' : 'Нет') + kv('Способ подключения', val(its.how)) + kv('Контактное лицо', val(its.who)) + kv('Путь к базе', `<span class="tm">${val(its.path)}</span>`) + kv('Логин ИТС', own() ? val(its.login) : (its.login ? '••••' : '—')) + kv('Пароль ИТС', secret('its', its.pass));
      case 'eds': { const soon = eds.to && eds.to < iso(30); return kv('Пароль ЭЦП', secret('eds', eds.pass)) + kv('Срок действия ЭЦП', eds.to ? `${dRu(eds.to)}${eds.to < TD() ? ' <span class="tg er">истекла</span>' : soon ? ' <span class="tg wa">скоро истекает</span>' : ''}` : '—') + kv('Тундук ЕСИ: логин', own() ? val(eds.esi) : (eds.esi ? '••••' : '—')) + kv('Тундук ЕСИ: пароль', secret('esi', eds.esip)); }
      case 'banks': return `<div class="lst">${(c.banks || []).map((b, i) => `<div class="row"><b style="min-width:160px">${E(b.b || 'Банк')}</b><span>логин: ${own() ? E(b.l || '—') : '••••'}</span><span>пароль: ${secret('bank' + i, b.p)}</span></div>`).join('') || '<span style="color:var(--mu)">Не указаны</span>'}</div>`;
      case 'contacts': return `<div class="lst"><b>Телефоны / Email / Чат</b>${(c.cts || []).map((x) => `<div>${E(x.t)}: ${E(x.v)}</div>`).join('') || '<span style="color:var(--mu)">Не указаны</span>'}<b style="margin-top:6px">Связанные лица</b>${(c.rel || []).map((x) => `<div>${E(x.n)}${x.r ? ' — ' + E(x.r) : ''}${x.p ? ' · ' + E(x.p) : ''}</div>`).join('') || '<span style="color:var(--mu)">Не указаны</span>'}</div>`;
      case 'extras': return kv('Папка клиента', c.folder ? `<a href="${E(c.folder)}" target="_blank" rel="noopener">открыть ↗</a>` : '—') + kv('Доступы / инструкции', own() ? (c.acc ? (LOCKED(c.acc) ? '🔒 в сейфе' : `<span style="white-space:pre-wrap">${E(PV(c.acc))}</span>`) : '—') : (c.acc ? '•••• (видит руководитель)' : '—'), 'full');
      case 'notes': return kv('Примечания', c.note ? `<span style="white-space:pre-wrap">${E(c.note)}</span>` : 'Нет примечаний', 'full');
    }
    return '';
  }

  function edit(c, k) {
    const f = c.fl || {}, its = c.its || {}, eds = c.eds || {};
    switch (k) {
      case 'basic': return sel('Форма собственности', 'of', OFORM, c.of, 'Не указана') + inp('Название *', 'n', c.n) + inp('ИНН (14 цифр)', 'inn', c.inn) + inp('Номер компании', 'no', c.no, 'number') + inp('ИНН руководителя (14 цифр)', 'dinn', c.dinn) + sel('Код налогового органа', 'kno', KNO.map((x) => [x[0], x[0] + ' — ' + x[1]]), c.kno, 'Не указан') + sel('Основной вид деятельности', 'av', S.ref.act || [], c.av, 'Не указан') + inp('ИНН для ЭТТН', 'ettn', c.ettn);
      case 'status': return sel('Статус клиента', 'stt', Object.entries(CSTAT), cst(c)) + inp('Дата начала обслуживания', 'sd', c.sd, 'date') + inp('Дата окончания (пусто — бессрочно)', 'ed', c.ed, 'date');
      case 'tax': return sel('Система налогообложения', 'reg', S.ref.reg, c.reg, 'Не указана') + sel('Метод учёта доходов и расходов', 'dir', DIR, c.dir, 'Не указан') + sel('Категория налогоплательщика', 'kat', KAT, c.kat, 'Не указана') + sel('Тариф', 'tar', S.ref.tar, c.tar, 'Не указан');
      case 'flags': return `<div class="flg">${FLAGS.map((x) => `<label><input type="checkbox" id="cf_fl_${x[0]}" ${f[x[0]] ? 'checked' : ''}> ${E(x[1])}</label>`).join('')}</div><div class="kv full"><span>Филиалы — отметьте налоговые органы, куда сдаются отчёты «по филиалам» (НсП, Форма 161)</span><select id="cf_br" multiple size="6">${KNO.map((x) => `<option value="${x[0]}" ${(c.br || []).includes(x[0]) ? 'selected' : ''}>${x[0]} — ${E(x[1])}</option>`).join('')}</select><span>Ctrl + щелчок — выбрать несколько</span></div>`;
      case 'contract': return sel('Тип обслуживания', 'stype', STYPE, c.stype, 'Не указан') + inp('С кем составлен договор', 'cwho', c.cwho) + sel('Главбух', 'ch', empArr(chiefs().concat(S.emps.filter((e) => e.id == c.ch && !chiefs().includes(e)))), c.ch, 'Не назначен') + sel('Исполнитель (ответственный)', 'ex', empArr(S.emps.filter((e) => !eFired(e) || e.id == c.ex)), c.ex, 'Не назначен') + inp('Ссылка на договор', 'curl', c.curl, 'url') + inp('Ссылка на реквизиты', 'rurl', c.rurl, 'url');
      case 'attorney': return sel('Доверенность на имя', 'att', empArr(S.emps), c.att, 'Не указано') + inp('Срок действия', 'atto', c.atto, 'date');
      case 'its': return `<div class="kv"><span>Обслуживание ИТС</span><label><input type="checkbox" id="cf_its_on" ${its.on ? 'checked' : ''}> Подключено</label></div>` + sel('Способ подключения', 'its_how', ITSHOW, its.how, 'Не указан') + inp('Контактное лицо', 'its_who', its.who) + inp('Путь к базе', 'its_path', its.path) + inp('Логин ИТС', 'its_login', its.login) + inp('Пароль ИТС', 'its_pass', PV(its.pass), 'password');
      case 'eds': return inp('Пароль ЭЦП', 'eds_pass', PV(eds.pass), 'password') + inp('Срок действия ЭЦП', 'eds_to', eds.to, 'date') + inp('Тундук ЕСИ: логин', 'eds_esi', eds.esi) + inp('Тундук ЕСИ: пароль', 'eds_esip', PV(eds.esip), 'password');
      case 'banks': return `<div class="lst" id="cf_banks">${(c.banks && c.banks.length ? c.banks : [{}]).map((b) => bankRow(b)).join('')}</div><div class="full"><button class="b s" onclick="ccAddRow('banks')">+ Ещё банк</button></div>`;
      case 'contacts': return `<div class="lst full"><b>Телефоны / Email / Чат</b><div id="cf_cts">${(c.cts && c.cts.length ? c.cts : [{}]).map(ctRow).join('')}</div><button class="b s" onclick="ccAddRow('cts')">+ Контакт</button><b style="margin-top:8px">Связанные лица</b><div id="cf_rel">${(c.rel && c.rel.length ? c.rel : [{}]).map(relRow).join('')}</div><button class="b s" onclick="ccAddRow('rel')">+ Лицо</button></div>`;
      case 'extras': return inp('Папка клиента (ссылка)', 'folder', c.folder, 'url', 'full') + area('Доступы / инструкции', 'acc', PV(c.acc));
      case 'notes': return area('Примечания', 'note', c.note);
    }
    return '';
  }
  const bankRow = (b) => `<div class="row" data-r="banks"><input data-k="b" placeholder="Банк" value="${E(b.b || '')}" style="flex:1"><input data-k="l" placeholder="Логин" value="${E(b.l || '')}" style="flex:1"><input data-k="p" type="password" placeholder="Пароль" value="${E(PV(b.p) || '')}" style="flex:1"><button class="b s r" onclick="this.parentElement.remove()" aria-label="Убрать">✕</button></div>`;
  const ctRow = (x) => `<div class="row" data-r="cts"><select data-k="t">${opt(CTYPE, x.t || 'Телефон')}</select><input data-k="v" placeholder="Номер, адрес или ник" value="${E(x.v || '')}" style="flex:1"><button class="b s r" onclick="this.parentElement.remove()" aria-label="Убрать">✕</button></div>`;
  const relRow = (x) => `<div class="row" data-r="rel"><input data-k="n" placeholder="ФИО" value="${E(x.n || '')}" style="flex:1"><input data-k="r" placeholder="Кем приходится (директор, учредитель…)" value="${E(x.r || '')}" style="flex:1"><input data-k="p" placeholder="Телефон" value="${E(x.p || '')}" style="width:160px"><button class="b s r" onclick="this.parentElement.remove()" aria-label="Убрать">✕</button></div>`;
  window.ccAddRow = (k) => { const box = document.getElementById('cf_' + k); if (box) box.insertAdjacentHTML('beforeend', k == 'banks' ? bankRow({}) : k == 'cts' ? ctRow({}) : relRow({})); };
  const rows = (k) => [...document.querySelectorAll(`[data-r="${k}"]`)].map((r) => { const o = {}; r.querySelectorAll('[data-k]').forEach((e) => { o[e.dataset.k] = String(e.value).trim().slice(0, 200); }); return o; }).filter((o) => Object.values(o).some((v) => v && v != 'Телефон'));

  function render() {
    const c = S.clients.find((x) => x.id == CC); if (!c) { mx(); return; }
    const s = cst(c), T = S.tasks.filter((t) => t.cl == c.id), done = T.filter((t) => t.st == 'done').sort((a, b) => (b.dd || b.due) > (a.dd || a.due) ? 1 : -1), open = T.filter((t) => t.st != 'done');
    const sec = ([k, ic, t]) => `<div class="sec" id="sec_${k}"><div class="st"><span>${ic}</span>${t}<div class="sp">${ED == k ? `<button class="b s p" onclick="ccSave('${k}')">✓ Сохранить</button><button class="b s" onclick="ccEd(null)">Отмена</button>` : own() ? `<button class="b s" onclick="ccEd('${k}')" title="Изменить">${PEN}</button>` : ''}</div></div><div class="sb">${ED == k ? (ERR ? `<div class="err">${E(ERR)}</div>` : '') + edit(c, k) : view(c, k)}</div></div>`;
    const hasPw = c.its && c.its.pass || c.eds && (c.eds.pass || c.eds.esip) || (c.banks || []).some((b) => b.p);
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><div style="flex:1;min-width:0"><h2>${E(c.n)} <span class="tg ${s == 'a' ? 'ok' : s == 'z' ? 'er' : 'wa'}">${CSTAT[s]}</span></h2><div style="color:var(--mu);font-size:13px">${c.of ? E(c.of) + ' · ' : ''}ИНН ${val(c.inn)}${c.reg ? ' · ' + E(c.reg) : ''} · задач открыто ${open.length}, выполнено ${done.length}</div></div>${window.smOpen ? `<button class="b s p" onclick="if(ED){toast('Сначала сохраните или отмените правку раздела');return}smOpen(${c.id})">Смета</button>` : ''}${own() && window.VLT && VLT.on() && !VLT.open() ? `<button class="b s" onclick="VLT.ask(()=>ccRender())">🔒 Открыть сейф</button>` : ''}${own() && hasPw ? `<button class="b s" onclick="ccPw()">${SHOWPW ? 'Скрыть пароли' : 'Показать пароли'}</button>` : ''}${own() ? `<button class="b s r" onclick="mx();del(${c.id})">Удалить</button>` : ''}<button class="b" onclick="ccClose()" aria-label="Закрыть">✕</button></div>
      <div class="bd2">${SECS.map(sec).join('')}
      <div class="sec"><div class="st">✓ История задач</div><div class="sb"><div class="full tw"><table><tr><th>Задача</th><th>Срок</th><th>Исполнитель</th><th>Статус</th><th>Документы</th></tr>${open.concat(done).slice(0, 40).map((t) => `<tr><td>${E(t.t)}</td><td>${dRu(t.due)}</td><td>${E(en(t.emp))}</td><td>${t.st == 'done' ? '<span class="tg ok">выполнена ' + dRu(t.dd) + '</span>' : t.st == 'rev' ? '<span class="tg wa">на проверке</span>' : od(t) ? '<span class="tg er">просрочена</span>' : t.st == 'work' ? 'в работе' : 'не начата'}</td><td>${typeof dList == 'function' ? dList(t.id).length || '' : ''}</td></tr>`).join('') || '<tr><td colspan=5>Задач нет</td></tr>'}</table></div></div></div></div></div>`;
    $('#md').className = 'on';
  }
  window.cc = function (id) { CC = id; ED = null; SHOWPW = false; ERR = ''; render(); };
  window.ccClose = function () { if (ED) { ask('Есть несохранённые изменения в карточке. Закрыть без сохранения?', () => { ED = null; CC = null; mx(); }); return; } CC = null; mx(); };
  window.ccRender = function () { if (CC != null && S.clients.some((x) => x.id == CC) && $('#md').className == 'on' && document.querySelector('#md .cc2')) render(); };
  window.ccEd = function (k) { if (k && VSECS.includes(k) && window.VLT && VLT.on() && !VLT.open()) { VLT.ask(() => ccEd(k)); return; } ED = k; ERR = ''; render(); const el = document.getElementById('sec_' + (k || '')); if (el) el.scrollIntoView({ block: 'nearest' }); };
  window.ccPw = function () { SHOWPW = !SHOWPW; render(); };
  window.ccCopy = function (k) { const c = S.clients.find((x) => x.id == CC); if (!c || !own()) return; const v = PV(k == 'its' ? (c.its || {}).pass : k == 'eds' ? (c.eds || {}).pass : k == 'esi' ? (c.eds || {}).esip : k.startsWith('bank') ? ((c.banks || [])[+k.slice(4)] || {}).p : ''); try { navigator.clipboard.writeText(v || ''); } catch (e) { } toast('Скопировано'); };

  window.ccSave = async function (k) {
    const c = S.clients.find((x) => x.id == CC); if (!c || !own()) return;
    const fail = (m) => { const sb = document.querySelector('#sec_' + k + ' .sb'); if (!sb) { ERR = m; render(); return; } let e = sb.querySelector('.err'); if (!e) { sb.insertAdjacentHTML('afterbegin', '<div class="err" role="alert"></div>'); e = sb.querySelector('.err'); } e.textContent = m; };
    const n = { ...c };
    if (k == 'basic') {
      n.of = g('of'); n.n = g('n'); n.inn = (g('inn') || '').replace(/\s/g, ''); n.no = g('no') ? +g('no') : undefined; n.dinn = (g('dinn') || '').replace(/\s/g, ''); n.kno = g('kno'); n.av = g('av'); n.ettn = (g('ettn') || '').replace(/\s/g, '');
      if (!n.n) return fail('Укажите название клиента.');
      if (n.n.length > 200) return fail('Название длиннее 200 знаков.');
      if (!digits(n.inn, 14, 14)) return fail('ИНН — это 14 цифр.');
      if (!digits(n.dinn, 14, 14)) return fail('ИНН руководителя — это 14 цифр.');
      if (!digits(n.ettn, 10, 14)) return fail('ИНН для ЭТТН — от 10 до 14 цифр.');
      if (n.no != null && (!Number.isInteger(n.no) || n.no < 1)) return fail('Номер компании — целое число больше нуля.');
      const di = n.inn && S.clients.find((x) => x.id != c.id && x.inn == n.inn); if (di) return fail('Клиент с таким ИНН уже есть: «' + di.n + '».');
      const dn = n.no && S.clients.find((x) => x.id != c.id && x.no == n.no); if (dn) return fail('Номер ' + n.no + ' уже у клиента «' + dn.n + '».');
    } else if (k == 'status') {
      n.stt = g('stt'); n.sd = g('sd'); n.ed = g('ed');
      if (!isDate(n.sd) || !isDate(n.ed)) return fail('Даты указаны неверно.');
      if (n.sd && n.ed && n.ed < n.sd) return fail('Дата окончания раньше даты начала.');
      if (n.sd && n.sd > iso(366)) return fail('Дата начала больше чем через год — проверьте год.');
      if (n.stt == 'z' && !n.ed) return fail('Для статуса «Завершён» укажите дату окончания обслуживания.');
      if (n.stt != 'z' && n.ed && n.ed < TD()) return fail('Дата окончания уже прошла — поставьте статус «Завершён» или уберите дату.');
      n.act = n.stt == 'a' ? 1 : 0;
    } else if (k == 'tax') {
      n.reg = g('reg'); n.dir = g('dir'); n.kat = g('kat'); n.tar = g('tar');
    } else if (k == 'flags') {
      n.fl = {}; FLAGS.forEach((x) => { if (g('fl_' + x[0])) n.fl[x[0]] = 1; });
      if (n.fl.zero && Object.keys(n.fl).length > 1) return fail('«Нулевой клиент» нельзя совмещать с другими характеристиками.');
      n.br = [...document.getElementById('cf_br').selectedOptions].map((o) => o.value).slice(0, 30);
    } else if (k == 'contract') {
      n.stype = g('stype'); n.cwho = g('cwho'); n.ch = g('ch') ? +g('ch') : 0; n.ex = g('ex') ? +g('ex') : 0; n.curl = g('curl'); n.rurl = g('rurl');
      if (!okUrl(n.curl) || !okUrl(n.rurl)) return fail('Ссылка должна начинаться с http:// или https://');
      if (!n.ch) return fail('Назначьте главбуха: без него клиент не попадёт в задачи и отчёты.');
    } else if (k == 'attorney') {
      n.att = g('att') ? +g('att') : 0; n.atto = g('atto');
      if (!isDate(n.atto)) return fail('Дата указана неверно.');
      if (n.atto && !n.att) return fail('Укажите, на кого выдана доверенность.');
    } else if (k == 'its') {
      n.its = { on: g('its_on') ? 1 : 0, how: g('its_how'), who: g('its_who'), path: g('its_path'), login: g('its_login'), pass: g('its_pass') };
    } else if (k == 'eds') {
      n.eds = { pass: g('eds_pass'), to: g('eds_to'), esi: g('eds_esi'), esip: g('eds_esip') };
      if (!isDate(n.eds.to)) return fail('Дата указана неверно.');
    } else if (k == 'banks') {
      n.banks = rows('banks').slice(0, 10);
    } else if (k == 'contacts') {
      n.cts = rows('cts').filter((x) => x.v).slice(0, 20); n.rel = rows('rel').filter((x) => x.n).slice(0, 20);
      const badEm = n.cts.find((x) => x.t == 'Email' && !/^\S+@\S+\.\S+$/.test(x.v)); if (badEm) return fail('Email указан неверно: ' + badEm.v);
    } else if (k == 'extras') {
      n.folder = g('folder'); n.acc = g('acc');
      if (!okUrl(n.folder)) return fail('Ссылка на папку должна начинаться с http:// или https://');
    } else if (k == 'notes') { n.note = g('note'); }
    Object.keys(n).forEach((x) => { if (n[x] === '' || n[x] === undefined) delete n[x]; });
    if (VSECS.includes(k) && window.VLT && VLT.on()) { if (!VLT.open()) return fail('Сейф закрыт: откройте сейф и сохраните ещё раз.'); try { await VLT.encClient(n); } catch (e) { return fail('Не удалось зашифровать пароли: ' + e.message); } }
    if (JSON.stringify(n).length > 28000) return fail('Карточка слишком большая: сократите примечания или доступы.');
    const exChanged = k == 'contract' && (n.ex || 0) != (c.ex || 0);
    const apply = (moveTasks) => {
      Object.keys(c).forEach((x) => { if (!(x in n)) delete c[x]; }); Object.assign(c, n);
      let moved = 0;
      if (moveTasks) S.tasks.forEach((t) => { if (t.cl == c.id && t.st != 'done' && t.st != 'rev' && t.au == null && (t.emp == moveTasks.from || !moveTasks.from)) { t.emp = c.ex; t.ut = Date.now(); moved++; } });
      logA('изменил карточку клиента «' + c.n + '»: ' + SECS.find((s) => s[0] == k)[2] + (moved ? ' (передано задач: ' + moved + ')' : ''));
      ED = null; ERR = ''; save(); toast(moved ? 'Сохранено. Задач передано новому исполнителю: ' + moved : 'Сохранено'); render(); go();
    };
    if (exChanged && n.ex) {
      const from = c.ex || 0, cnt = S.tasks.filter((t) => t.cl == c.id && t.st != 'done' && t.st != 'rev' && t.au == null && (!from || t.emp == from)).length;
      if (cnt) {
        $('#md').insertAdjacentHTML('beforeend', '');
        const keep = $('#md').innerHTML;
        $('#md').innerHTML = `<div class="c"><h3>Сменить исполнителя?</h3><p>${E(en(from) == '—' ? 'Не назначен' : en(from))} → <b>${E(en(n.ex))}</b></p><p>Незакрытых задач по клиенту${from ? ' у прежнего исполнителя' : ''}: <b>${cnt}</b>. Выполненные остаются в истории за теми, кто их сделал.</p><div class="row"><button class="b p" id="ccT1">Передать задачи и сохранить</button><button class="b" id="ccT2">Сохранить без передачи</button><button class="b" id="ccT3">Отмена</button></div></div>`;
        document.getElementById('ccT1').onclick = () => apply({ from });
        document.getElementById('ccT2').onclick = () => apply(null);
        document.getElementById('ccT3').onclick = () => { $('#md').innerHTML = keep; };
        return;
      }
    }
    apply(null);
  };

  /* ---------- Сотрудники 2.0 ---------- */
  const _st = V.st;
  V.st = function () {
    let h = _st.call(V);
    const q = (S.eq || '').toLowerCase();
    const search = `<div class="row" style="margin-bottom:10px"><input placeholder="🔎 Поиск по ФИО, телефону, email" value="${E(S.eq || '')}" oninput="S.eq=this.value;clearTimeout(window.__eqT);window.__eqT=setTimeout(()=>{go();const x=document.getElementById('eq_in');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},250)" id="eq_in" style="flex:1"><span style="color:var(--mu)">Работают: ${S.emps.filter((e) => !eFired(e)).length} · уволены: ${S.emps.filter(eFired).length}</span></div>`;
    h = h.replace('<div class="gr g2">', search + '<div class="gr g2">');
    S.emps.forEach((e) => {
      const hay = (e.n + ' ' + (e.ph || '') + ' ' + String(e.ph || '').replace(/\D/g, '') + ' ' + (e.em || '') + ' ' + (e.lg || '')).toLowerCase();
      const head = `<div class="c"><h3>${E(e.n)} <span class="tg">${ROLES[e.r]}</span>`;
      const i = h.indexOf(head);
      if (i < 0) return;
      if (q && !hay.includes(q)) { const j = h.indexOf('</div></div></div>', i); /* карточку скрываем через стиль */ h = h.slice(0, i) + head.replace('<div class="c">', '<div class="c" style="display:none">') + h.slice(i + head.length); return; }
      const info = `<div style="font-size:13px;color:var(--mu);margin:-4px 0 8px">${e.no ? '№ ' + E(e.no) + ' · ' : ''}${e.ph ? '☎ ' + E(fmtPh(e.ph)) + ' · ' : ''}${e.em ? '✉ ' + E(e.em) + ' · ' : ''}${e.hd ? 'принят ' + dRu(e.hd) : ''}${eFired(e) ? ' · <span class="tg er">уволен ' + dRu(e.fd) + '</span>' : e.fd ? ' · <span class="tg wa">увольнение ' + dRu(e.fd) + '</span>' : ''}</div>`;
      const btns = ME == null ? ` <button class="b s" onclick="emCard(${e.id})">Карточка</button>${!eFired(e) ? ` <button class="b s r" onclick="emFire(${e.id})">Уволить и передать работу</button>` : ''}` : '';
      const endH3 = h.indexOf('</h3>', i);
      h = h.slice(0, endH3) + btns + '</h3>' + info + h.slice(endH3 + 5);
    });
    return h;
  };

  window.emCard = function (id) {
    const e = S.emps.find((x) => x.id == id); if (!e || ME != null) return;
    modal(`<h3>Карточка сотрудника</h3><p style="margin:0 0 6px"><b>${E(e.n)}</b> · ${ROLES[e.r]}</p><div id="em_err"></div>
      <div class="kv"><span>Номер сотрудника</span><input id="em_no" value="${E(e.no || '')}"></div>
      <div class="kv"><span>Телефон</span><input id="em_ph" value="${E(e.ph || '')}" placeholder="+996 700 000 000"></div>
      <div class="kv"><span>Email</span><input id="em_em" value="${E(e.em || '')}" placeholder="name@mail.kg"></div>
      <div class="kv"><span>Дата рождения</span><input id="em_bd" type="date" value="${E(e.bd || '')}"></div>
      <div class="kv"><span>Дата принятия на работу</span><input id="em_hd" type="date" value="${E(e.hd || '')}"></div>
      <div class="kv"><span>Дата увольнения (если уже уволен — лучше кнопкой «Уволить и передать работу»)</span><input id="em_fd" type="date" value="${E(e.fd || '')}"></div>
      <div class="kv"><span>Роль</span>${e.lg ? `<b>${E(ROLES[e.r] || e.r)}</b><span style="font-size:12px">Вход уже создан с этой ролью. Чтобы сменить роль, удалите вход, поменяйте роль и создайте вход заново.</span>` : `<select id="em_r">${EROLE.map((r) => `<option value="${r}" ${e.r == r ? 'selected' : ''}>${E(ROLES[r])}</option>`).join('')}</select>`}<span style="font-size:12px;color:var(--mu)">Проверяющий видит всех клиентов и все задачи, но менять может только свои задачи. Юрисконсульт работает с правами бухгалтера.</span></div>
      <div class="kv"><span>Доступ к разделам (что сотрудник видит после входа)</span><div class="flg">${EMODS().map((m) => `<label><input type="checkbox" class="em_m" value="${m[0]}" ${!Array.isArray(e.mods) || !e.mods.length || e.mods.includes(m[0]) ? 'checked' : ''}> ${E(m[1])}</label>`).join('')}</div><span style="font-size:12px;color:var(--mu)">Скрывает разделы в меню сотрудника. Какие клиенты и задачи ему видны, решает сервер по роли.</span></div>
      <div class="row"><button class="b p" onclick="emSave(${id})">Сохранить</button><button class="b" onclick="mx()">Отмена</button></div>`);
  };
  window.emSave = function (id) {
    const e = S.emps.find((x) => x.id == id); if (!e) return;
    const v = (k) => String(document.getElementById('em_' + k).value || '').trim(), err = (m) => { document.getElementById('em_err').innerHTML = `<div class="tg er" style="display:block;white-space:normal;padding:8px">${E(m)}</div>`; };
    const n = { no: v('no'), ph: v('ph'), em: v('em'), bd: v('bd'), hd: v('hd'), fd: v('fd') };
    const phd = n.ph.replace(/\D/g, '');
    if (n.ph && !(phd.length == 12 && phd.startsWith('996')) && !(phd.length == 9)) return err('Телефон: 9 цифр (700 000 000) или полностью с кодом +996.');
    if (n.ph && phd.length == 9) n.ph = '+996' + phd;
    if (n.em && !/^\S+@\S+\.\S+$/.test(n.em)) return err('Email указан неверно.');
    if (n.bd && n.bd > iso(-14 * 365)) return err('Дата рождения: сотруднику должно быть не меньше 14 лет.');
    if (n.hd && n.bd && n.hd < n.bd) return err('Дата приёма раньше даты рождения.');
    if (n.fd && n.hd && n.fd < n.hd) return err('Дата увольнения раньше даты приёма.');
    if (n.fd && n.fd <= TD() && !e.off) return err('Сотрудник ещё работает и имеет доступ. Чтобы уволить сегодня или задним числом, нажмите «Уволить и передать работу».');
    if (n.no && S.emps.some((x) => x.id != id && x.no == n.no)) return err('Такой номер уже у другого сотрудника.');
    const rEl = document.getElementById('em_r'), nr = rEl ? rEl.value : e.r;
    if (!EROLE.includes(nr)) return err('Выберите роль.');
    if (e.r == 'chief' && nr != 'chief') { const k = S.clients.filter((c) => c.ch == id).length; if (k) return err('Сотрудник — главбух у клиентов: ' + k + '. Сначала назначьте им другого главбуха.'); }
    const all = EMODS().map((m) => m[0]), mods = [...document.querySelectorAll('.em_m')].filter((x) => x.checked).map((x) => x.value);
    if (!mods.length) return err('Оставьте сотруднику хотя бы один раздел.');
    if (nr != e.r) { logA('сменил роль ' + e.n + ': ' + (ROLES[e.r] || e.r) + ' → ' + ROLES[nr]); e.r = nr; }
    if (mods.length == all.length) delete e.mods; else e.mods = mods;
    ['no', 'ph', 'em', 'bd', 'hd', 'fd'].forEach((k) => { if (n[k]) e[k] = n[k]; else delete e[k]; });
    logA('изменил карточку сотрудника: ' + e.n); save(); mx(); toast('Сохранено'); go();
  };

  window.emFire = function (id) {
    const e = S.emps.find((x) => x.id == id); if (!e || ME != null) return;
    const openT = S.tasks.filter((t) => t.emp == id && t.st != 'done'), cls = S.clients.filter((c) => c.ex == id || c.ch == id);
    const to = S.emps.filter((x) => x.id != id && !eFired(x) && !x.off);
    modal(`<h3>Уволить и передать работу</h3><p><b>${E(e.n)}</b>: незакрытых задач <b>${openT.length}</b>, клиентов (главбух или исполнитель) <b>${cls.length}</b>.</p>
      <div class="kv"><span>Кому передать всю работу</span><select id="fi_to">${to.map((x) => `<option value="${x.id}">${E(x.n)} — ${ROLES[x.r]}</option>`).join('')}</select></div>
      <div class="kv"><span>Дата увольнения</span><input id="fi_d" type="date" value="${TD()}"></div>
      <p style="color:var(--mu);font-size:12px">Выполненные задачи остаются в истории за тем, кто их сделал. ${e.lg ? 'Вход в систему будет отключён.' : ''}</p>
      <div class="row"><button class="b r" onclick="emFireGo(${id})" ${to.length ? '' : 'disabled'}>Уволить и передать</button><button class="b" onclick="mx()">Отмена</button></div>${to.length ? '' : '<p class="tg er">Нет других работающих сотрудников, кому передать работу.</p>'}`);
  };
  window.emFireGo = async function (id) {
    const e = S.emps.find((x) => x.id == id), to = +document.getElementById('fi_to').value, d = document.getElementById('fi_d').value;
    if (!e || !to) return;
    if (!isDate(d) || !d) { toast('Укажите дату увольнения'); return; }
    if (e.hd && d < e.hd) { toast('Дата увольнения раньше даты приёма'); return; }
    // сначала отключаем вход (если не получится — ничего не меняем)
    if (e.lg && !e.off) {
      if (ONL) { if (!SYNC.tok || !(await syncNow())) { toast('Нет связи с сервером: ничего не изменено, попробуйте ещё раз'); return; } if (!(await memAct(() => rpc('member_set', { tok: SYNC.tok, p_emp: id, p_active: false })))) return; }
      else { const u = U(), q = u.find((x) => x.ws == CU && x.emp == id); if (q) { q.on = 0; saveU(u); } }
    }
    let nt = 0, nc = 0;
    S.tasks.forEach((t) => { if (t.emp == id && t.st != 'done') { t.emp = to; t.ut = Date.now(); if (t.run) { t.sp += (Date.now() - t.run) / 1000; t.run = 0; } nt++; } });
    S.clients.forEach((c) => { let ch = 0; if (c.ex == id) { c.ex = to; ch = 1; } if (c.ch == id) { const r = S.emps.find((x) => x.id == to); if (r && r.r == 'chief') c.ch = to; else c.ch = (chiefs().find((x) => x.id != id) || { id: to }).id; ch = 1; } nc += ch; });
    e.fd = d;
    e.off = true;
    logA('уволил ' + e.n + ' с ' + dRu(d) + ' и передал работу ' + en(to) + ': задач ' + nt + ', клиентов ' + nc);
    mx(); save(); toast('Готово: передано задач ' + nt + ', клиентов ' + nc); go();
  };

  if (typeof S !== 'undefined' && S) { try { go(); } catch (e) { } }
})();
