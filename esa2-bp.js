/* ESA Control 2.0 · Этап 2: каталог бизнес-процессов и Смета 2.0.
   Каталог фирмы — S.bp (настройки фирмы, вид 'g'). Смета клиента — c.sm (в записи клиента, вид 'c').
   Задачи из сметы — обычные задачи ESA с полями bp (процесс), sub (подпункты), doc/rev (правила закрытия). */
(function () {
  'use strict';
  const BILL = { inc: 'Входит в абонентку', qty: 'Считается по количеству', add: 'Доп. услуга', none: 'Не тарифицируется' };
  const billK = (s) => ({ 'Входит в абонентку': 'inc', 'Считается по количеству': 'qty', 'Доп.услуга': 'add', 'Доп. услуга': 'add', 'Не тарифицируется': 'none' })[s] || (BILL[s] ? s : 'inc');
  const TAXK = { usn: 'УСН ЕН', osn: 'ОСН', pki: 'ПКИ', pvt: 'ПВТ', pat: 'Патент', sez: 'СЭЗ' };
  const regCode = (r) => { r = String(r || '').toUpperCase(); return /УСН|ЕДИН/.test(r) ? 'usn' : /ОСН|ОБЩ/.test(r) ? 'osn' : /ПКИ/.test(r) ? 'pki' : /ПВТ/.test(r) ? 'pvt' : /ПАТЕНТ/.test(r) ? 'pat' : /СЭЗ/.test(r) ? 'sez' : ''; };
  const PERS = ['Ежемесячно', 'Ежеквартально', 'Раз в полгода', 'Ежегодно', 'Разово', 'По событию', 'По запросу'];
  const AUTO = new Set(['Ежемесячно', 'Ежеквартально', 'Раз в полгода', 'Ежегодно']);
  const CATS = ['Обязательная', 'Рекомендованная контрольная', 'Условная по профилю', 'Разовая/заявка', 'Индивидуальная'];
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const FL = () => (window.ESA2 ? window.ESA2.FLAGS : []);
  const flLbl = (k) => (FL().find((x) => x[0] == k) || [k, k])[1];
  const own = () => ME == null && S && S.role == 'admin';
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const money0 = (n) => Math.round(+n || 0).toLocaleString('ru-RU') + ' сом';
  const opt = (arr, v, empty) => (empty != null ? `<option value=''>${E(empty)}</option>` : '') + arr.map((x) => { const k = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${E(k)}" ${String(k) == String(v == null ? '' : v) ? 'selected' : ''}>${E(t)}</option>`; }).join('');
  const bpId = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const bps = () => (S.bp = S.bp || []);
  const defMonths = (b) => (b.sm && b.sm.length ? b.sm : b.per == 'Ежеквартально' ? [3, 6, 9, 12] : b.per == 'Раз в полгода' ? [6, 12] : b.per == 'Ежегодно' ? [12] : []);
  const schedTxt = (b, day) => { const d = day || b.sd; if (!AUTO.has(b.per)) return b.per || 'без периода'; if (!d) return b.per + ' · срок не задан'; return b.per == 'Ежемесячно' ? `ежемесячно, ${d} числа` : `${b.per.toLowerCase()}: ${defMonths(b).map((m) => p2(d) + '.' + p2(m)).join(', ')}`; };

  /* ---------- Стандартный каталог ---------- */
  function fromFile(x) { return { id: bpId(), n: x.n, d: x.d || '', sp: x.sp || '', gr: x.gr || '', cat: x.cat || '', per: x.per || '', sm: x.sm || [], sd: (x.sd || [])[0] || null, min: +x.min || 0, doc: x.doc ? 1 : 0, rev: x.rev ? 1 : 0, bill: billK(x.bill), price: 0, tax: x.tax || [], fl: x.fl || [], qty: x.qty ? 1 : 0, br: x.br ? 1 : 0, ch: x.ch || [] }; }
  window.bpLoadStd = async function () {
    if (!own()) return;
    let L; try { L = await fetch('data/bp-catalog.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw Error(r.status); return r.json(); }); } catch (e) { toast('Не удалось загрузить стандартный каталог'); return; }
    const have = new Set(bps().map((b) => b.n.toLowerCase().trim())); let n = 0;
    L.forEach((x) => { if (!have.has(x.n.toLowerCase().trim())) { bps().push(fromFile(x)); n++; } });
    logA('загрузил стандартный каталог бизнес-процессов: +' + n); save(); toast(n ? 'Добавлено процессов: ' + n : 'Все процессы стандартного каталога уже есть'); bpList();
  };

  /* ---------- Каталог в настройках ---------- */
  let BQ = '', BSP = '';
  window.bpList = function () {
    const L = bps().filter((b) => (!BSP || b.sp == BSP) && (!BQ || (b.n + ' ' + b.sp + ' ' + b.gr + ' ' + b.d).toLowerCase().includes(BQ.toLowerCase())));
    const sps = [...new Set(bps().map((b) => b.sp).filter(Boolean))].sort();
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><div style="flex:1"><h2>Бизнес-процессы (${bps().length})</h2><div style="color:var(--mu);font-size:13px">Перечень услуг фирмы. Из него собирается смета клиента: по режиму налогообложения и характеристикам бизнеса.</div></div>${own() ? `<button class="b s p" onclick="bpForm()">+ Добавить процесс</button><button class="b s" onclick="bpLoadStd()">Загрузить стандартный каталог</button>` : ''}<button class="b" onclick="mx()" aria-label="Закрыть">✕</button></div>
      <div class="bd2"><div class="row"><input id="bp_q" placeholder="🔎 Поиск по названию, сфере, описанию" value="${E(BQ)}" oninput="BQs(this.value)" style="flex:1"><select onchange="BSPs(this.value)"><option value="">Все сферы</option>${sps.map((s) => `<option ${s == BSP ? 'selected' : ''}>${E(s)}</option>`).join('')}</select><span style="color:var(--mu)">${L.length} шт.</span></div>
      <div class="tw"><table><tr><th>Процесс</th><th>Сфера / группа</th><th>Периодичность и срок</th><th>План</th><th>Закрытие</th><th>Биллинг</th><th>Цена</th><th>Для кого</th><th></th></tr>${L.map((b) => `<tr><td><b>${E(b.n)}</b>${b.ch.length ? `<br><span style="font-size:11px;color:var(--mu)">${b.ch.length} подп.</span>` : ''}</td><td style="font-size:12px">${E(b.sp)}<br><span style="color:var(--mu)">${E(b.gr)}</span></td><td style="font-size:12px">${E(schedTxt(b))}</td><td class="tm">${b.min ? b.min + ' мин' : '—'}</td><td style="font-size:12px">${b.doc ? 'с документом' : 'без документа'}${b.rev ? '<br>с проверкой' : ''}</td><td style="font-size:12px">${E(BILL[b.bill] || '')}</td><td class="tm">${b.price ? money0(b.price) : '—'}</td><td style="font-size:11px">${b.tax.map((t) => `<span class="tg">${E(TAXK[t] || t)}</span>`).join(' ')}${b.fl.map((f) => `<span class="tg ok">${E(flLbl(f))}</span>`).join(' ')}${!b.tax.length && !b.fl.length ? '<span style="color:var(--mu)">все</span>' : ''}${b.cat ? `<br><span style="color:var(--mu)">${E(b.cat)}</span>` : ''}</td><td>${own() ? `<button class="b s" onclick="bpForm('${b.id}')" aria-label="Изменить">${PEN}</button> <button class="b s r" onclick="bpDel('${b.id}')" aria-label="Удалить">✕</button>` : ''}</td></tr>`).join('') || `<tr><td colspan=9>${bps().length ? 'Ничего не найдено' : 'Каталог пуст. Нажмите «Загрузить стандартный каталог» — 92 готовых процесса для бухгалтерской фирмы в Кыргызстане.'}</td></tr>`}</table></div></div></div>`;
    $('#md').className = 'on';
  };
  let bqT = null;
  window.BQs = (v) => { BQ = v; clearTimeout(bqT); bqT = setTimeout(() => { bpList(); const e = document.getElementById('bp_q'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 250); };
  window.BSPs = (v) => { BSP = v; bpList(); };

  window.bpForm = function (id) {
    if (!own()) return;
    const b = id ? bps().find((x) => x.id == id) : { n: '', d: '', sp: '', gr: '', cat: '', per: 'Ежемесячно', sm: [], sd: null, min: 0, doc: 0, rev: 0, bill: 'inc', price: 0, tax: [], fl: [], qty: 0, br: 0, ch: [] };
    if (!b) return;
    const sps = [...new Set(bps().map((x) => x.sp).filter(Boolean))], grs = [...new Set(bps().map((x) => x.gr).filter(Boolean))];
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><h2 style="flex:1">${id ? 'Изменить процесс' : 'Новый бизнес-процесс'}</h2><button class="b" onclick="bpList()" aria-label="Назад">✕</button></div><div class="bd2"><div id="bp_err"></div><div class="sec"><div class="sb">
      <div class="kv full"><span>Название *</span><input id="bf_n" value="${E(b.n)}" maxlength="200"></div>
      <div class="kv full"><span>Описание («что сделать» и «готово, когда»)</span><textarea id="bf_d" rows="3">${E(b.d)}</textarea></div>
      <div class="kv"><span>Сфера</span><input id="bf_sp" list="bf_spl" value="${E(b.sp)}"><datalist id="bf_spl">${sps.map((s) => `<option value="${E(s)}">`).join('')}</datalist></div>
      <div class="kv"><span>Группа</span><input id="bf_gr" list="bf_grl" value="${E(b.gr)}"><datalist id="bf_grl">${grs.map((s) => `<option value="${E(s)}">`).join('')}</datalist></div>
      <div class="kv"><span>Категория</span><select id="bf_cat">${opt(CATS, b.cat, 'Не указана')}</select></div>
      <div class="kv"><span>Периодичность</span><select id="bf_per" onchange="bpMonVis()">${opt(PERS, b.per, 'Не указана')}</select></div>
      <div class="kv"><span>Срок: число месяца (1–31)</span><input id="bf_sd" type="number" min="1" max="31" value="${E(b.sd || '')}"></div>
      <div class="kv" id="bf_monw"><span>Месяцы сдачи (для квартальных, полугодовых, годовых)</span><div class="flg">${MON.map((m, i) => `<label><input type="checkbox" id="bf_m${i + 1}" ${(b.sm || []).includes(i + 1) ? 'checked' : ''}> ${m}</label>`).join('')}</div></div>
      <div class="kv"><span>План выполнения, минут</span><input id="bf_min" type="number" min="0" max="10000" value="${E(b.min || 0)}"></div>
      <div class="kv"><span>Правила закрытия</span><label><input type="checkbox" id="bf_doc" ${b.doc ? 'checked' : ''}> Документ обязателен</label><label><input type="checkbox" id="bf_rev" ${b.rev ? 'checked' : ''}> Отправлять на проверку</label></div>
      <div class="kv"><span>Биллинг</span><select id="bf_bill">${opt(Object.entries(BILL), b.bill)}</select></div>
      <div class="kv"><span>Цена, сом (для «по количеству» — за единицу)</span><input id="bf_price" type="number" min="0" step="1" value="${E(b.price || 0)}"></div>
      <div class="kv"><span>Дополнительно</span><label><input type="checkbox" id="bf_qty" ${b.qty ? 'checked' : ''}> Можно указывать количество</label><label><input type="checkbox" id="bf_br" ${b.br ? 'checked' : ''}> Дублируется по филиалам</label></div>
      <div class="kv full"><span>Режим налогообложения (ничего не отмечено — для всех)</span><div class="flg">${Object.entries(TAXK).map(([k, t]) => `<label><input type="checkbox" id="bf_t_${k}" ${b.tax.includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
      <div class="kv full"><span>Только для клиентов с характеристикой (ничего не отмечено — для всех)</span><div class="flg">${FL().filter((x) => x[0] != 'zero').map((x) => `<label><input type="checkbox" id="bf_f_${x[0]}" ${b.fl.includes(x[0]) ? 'checked' : ''}> ${E(x[1])}</label>`).join('')}</div></div>
      <div class="kv full"><span>Подпункты — каждый с новой строки</span><textarea id="bf_ch" rows="4">${E(b.ch.join('\n'))}</textarea></div>
      </div></div><div class="row"><button class="b p" onclick="bpSave('${id || ''}')">${id ? 'Сохранить' : 'Создать'}</button><button class="b" onclick="bpList()">Отмена</button></div></div></div>`;
    $('#md').className = 'on'; bpMonVis();
  };
  window.bpMonVis = () => { const p = (document.getElementById('bf_per') || {}).value, w = document.getElementById('bf_monw'); if (w) w.style.display = ['Ежеквартально', 'Раз в полгода', 'Ежегодно'].includes(p) ? '' : 'none'; };
  window.bpSave = function (id) {
    const v = (k) => { const e = document.getElementById('bf_' + k); return e ? (e.type == 'checkbox' ? e.checked : String(e.value).trim()) : ''; };
    const err = (m) => { document.getElementById('bp_err').innerHTML = `<div class="tg er" role="alert" style="display:block;white-space:normal;padding:8px">${E(m)}</div>`; document.querySelector('#md .c').scrollTop = 0; };
    const n = { n: v('n'), d: v('d').slice(0, 1500), sp: v('sp').slice(0, 80), gr: v('gr').slice(0, 80), cat: v('cat'), per: v('per'), sd: v('sd') ? +v('sd') : null, sm: MON.map((_, i) => i + 1).filter((m) => v('m' + m)), min: +v('min') || 0, doc: v('doc') ? 1 : 0, rev: v('rev') ? 1 : 0, bill: v('bill'), price: +v('price') || 0, qty: v('qty') ? 1 : 0, br: v('br') ? 1 : 0, tax: Object.keys(TAXK).filter((k) => v('t_' + k)), fl: FL().map((x) => x[0]).filter((k) => v('f_' + k)), ch: v('ch').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 15) };
    if (!n.n) return err('Укажите название процесса.');
    if (bps().some((x) => x.id != id && x.n.toLowerCase().trim() == n.n.toLowerCase())) return err('Процесс с таким названием уже есть.');
    if (n.sd != null && (!Number.isInteger(n.sd) || n.sd < 1 || n.sd > 31)) return err('Срок — число месяца от 1 до 31.');
    if (n.min < 0 || n.min > 10000) return err('План выполнения — от 0 до 10 000 минут.');
    if (n.price < 0) return err('Цена не может быть отрицательной.');
    if (['Ежеквартально', 'Раз в полгода', 'Ежегодно'].includes(n.per) && !n.sm.length) return err('Для периодичности «' + n.per + '» отметьте месяцы сдачи.');
    if (n.per != 'Ежеквартально' && n.per != 'Раз в полгода' && n.per != 'Ежегодно') n.sm = [];
    if (n.bill == 'qty' && !n.qty) n.qty = 1;
    if (id) { const b = bps().find((x) => x.id == id); Object.assign(b, n); logA('изменил бизнес-процесс: ' + n.n); }
    else { bps().push({ id: bpId(), ...n }); logA('добавил бизнес-процесс: ' + n.n); }
    if (JSON.stringify(bps()).length > 250000) { toast('Каталог слишком большой: сократите описания'); }
    save(); toast('Сохранено'); bpList();
  };
  window.bpDel = function (id) {
    const b = bps().find((x) => x.id == id); if (!b) return;
    const used = S.clients.filter((c) => c.sm && c.sm.it && c.sm.it[id] && c.sm.it[id].on).length;
    ask(`Удалить процесс «${b.n}»?${used ? ' Он включён в сметы клиентов: ' + used + '. Из смет он уберётся, уже созданные задачи останутся.' : ''}`, () => {
      S.bp = bps().filter((x) => x.id != id);
      S.clients.forEach((c) => { if (c.sm && c.sm.it && c.sm.it[id]) delete c.sm.it[id]; });
      logA('удалил бизнес-процесс: ' + b.n); save(); toast('Удалено'); bpList();
    });
  };

  /* ---------- Подбор процессов клиенту ---------- */
  function fit(b, c) {
    if (!AUTO.has(b.per) && b.per !== '') { /* разовые/событийные — только вручную */ }
    if (['Разовая/заявка', 'Индивидуальная'].includes(b.cat) || ['Разово', 'По событию', 'По запросу'].includes(b.per)) return { ok: false, man: true };
    const rc = regCode(c.reg), fl = c.fl || {};
    if (b.tax.length && !b.tax.includes(rc)) return { ok: false, why: 'другой режим' };
    if (fl.zero && !/налог|отч[её]т|контрол/i.test(b.sp + ' ' + b.gr)) return { ok: false, why: 'нулевой клиент' };
    if (b.fl.length) { const hit = b.fl.filter((f) => fl[f]); return hit.length ? { ok: true, cond: hit } : { ok: false, why: 'нет характеристики' }; }
    return { ok: true };
  }
  const empOf = (c) => c.ex || c.ch || 0;
  function smItem(c, b) { const it = (c.sm && c.sm.it && c.sm.it[b.id]) || null; const f = fit(b, c); return it ? { ...it, fit: f } : { on: f.ok ? 1 : 0, q: 1, emp: empOf(c), day: null, off: [], fit: f, auto: 1 }; }
  function price(b, it) { if (!it.on) return 0; if (b.bill == 'qty' || b.bill == 'add') return (+b.price || 0) * (b.qty ? Math.max(1, +it.q || 1) : 1); return 0; }
  window.smTotal = function (c) {
    const tar = (S.price && S.price[c.tar]) || 0, ym = TD().slice(0, 7);
    let extra = 0; bps().forEach((b) => { extra += price(b, smItem(c, b)); });
    ((c.sm && c.sm.ex) || []).forEach((x) => { if (!x.ym || x.ym == ym) extra += (+x.price || 0) * Math.max(1, +x.q || 1); });
    return { tar, extra, total: tar + extra, n: bps().filter((b) => smItem(c, b).on).length + ((c.sm && c.sm.ex) || []).filter((x) => !x.ym || x.ym == ym).length };
  };

  /* ---------- Редактор сметы ---------- */
  let SC = null, DIRTY = false;
  window.smOpen = function (id) { SC = id; DIRTY = false; smRender(); };
  function smRender() {
    const c = S.clients.find((x) => x.id == SC); if (!c) { mx(); return; }
    if (!bps().length) { $('#md').innerHTML = `<div class="c"><h3>Смета: ${E(c.n)}</h3><p>Каталог бизнес-процессов пуст. Сначала загрузите стандартный каталог (92 процесса) или добавьте свои.</p><div class="row">${own() ? `<button class="b p" onclick="bpLoadStd().then(()=>smOpen(${c.id}))">Загрузить стандартный каталог</button>` : ''}<button class="b" onclick="mx()">Закрыть</button></div></div>`; $('#md').className = 'on'; return; }
    const ro = !own(), ym = TD().slice(0, 7), T = smTotal(c);
    const groups = {}; bps().forEach((b) => { const it = smItem(c, b); if (!it.on && !it.fit.ok && !(c.sm && c.sm.it && c.sm.it[b.id])) return; (groups[b.sp || 'Без сферы'] = groups[b.sp || 'Без сферы'] || []).push([b, it]); });
    const empSel = (b, it) => `<select data-k="emp" ${ro ? 'disabled' : ''}>${opt([[0, 'Исполнитель клиента']].concat(S.emps.filter((e) => !e.off).map((e) => [e.id, e.n])), it.emp && it.emp != empOf(c) ? it.emp : 0)}</select>`;
    const row = ([b, it]) => `<div class="sec smr" data-bp="${b.id}" style="border-radius:10px"><div class="st" style="font-weight:500;flex-wrap:wrap"><label style="display:flex;gap:8px;align-items:center;flex:1;min-width:240px"><input type="checkbox" data-k="on" ${it.on ? 'checked' : ''} ${ro ? 'disabled' : ''}> <span><b>${E(b.n)}</b><br><span style="font-size:12px;color:var(--mu)">${E(schedTxt(b, it.day))}${b.min ? ' · ' + b.min + ' мин' : ''}${b.doc ? ' · нужен документ' : ''}${b.rev ? ' · с проверкой' : ''}</span></span></label>
      ${it.fit.cond ? `<span class="tg ok" title="Подобрано по характеристике клиента">по условию: ${E(it.fit.cond.map(flLbl).join(', '))}</span>` : ''}${!it.fit.ok && it.on ? `<span class="tg wa" title="Обычно этому клиенту не нужен">${E(it.fit.why || 'вручную')}</span>` : ''}<span class="tg">${E(BILL[b.bill])}</span>
      <div class="sp" style="align-items:center">${AUTO.has(b.per) ? `<label style="font-size:12px">срок <input data-k="day" type="number" min="1" max="31" placeholder="${b.sd || '—'}" value="${it.day || ''}" style="width:58px" ${ro ? 'disabled' : ''}></label>` : ''}${b.qty ? `<label style="font-size:12px">кол-во <input data-k="q" type="number" min="1" max="999" value="${it.q || 1}" style="width:62px" ${ro ? 'disabled' : ''}></label>` : ''}${empSel(b, it)}<b class="tm" style="min-width:90px;text-align:right">${price(b, it) ? money0(price(b, it)) : ''}</b></div></div>
      ${b.ch.length ? `<details style="padding:6px 14px 10px"><summary style="cursor:pointer;color:var(--mu);font-size:13px">Подпункты: ${b.ch.length - (it.off || []).length} из ${b.ch.length}</summary>${b.ch.map((s, i) => `<label style="display:flex;gap:8px;padding:3px 0;font-size:13px"><input type="checkbox" data-sub="${i}" ${(it.off || []).includes(i) ? '' : 'checked'} ${ro ? 'disabled' : ''}> ${E(s)}</label>`).join('')}</details>` : ''}</div>`;
    const ex = (c.sm && c.sm.ex) || [];
    const manual = bps().filter((b) => !fit(b, c).ok);
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><div style="flex:1;min-width:0"><h2>Смета: ${E(c.n)}</h2><div style="color:var(--mu);font-size:13px">${c.reg ? E(c.reg) + ' · ' : 'режим не указан · '}тариф ${E(c.tar || '—')} · исполнитель ${E(en(empOf(c)))}${c.sm && c.sm.at ? ' · сохранена ' + new Date(c.sm.at).toLocaleString('ru-RU') : ' · ещё не сохранялась'}</div></div>
      <div style="text-align:right"><span style="font-size:12px;color:var(--mu)">ИТОГО в месяц</span><br><b id="sm_tot" style="font-size:20px">${money0(T.total)}</b><br><span style="font-size:11px;color:var(--mu)">тариф ${money0(T.tar)} + доп. ${money0(T.extra)}</span></div>
      ${ro ? '' : `<button class="b p" onclick="smSave()">Сохранить</button>`}<button class="b" onclick="smPdf()">PDF</button><button class="b" onclick="smClose()" aria-label="Закрыть">✕</button></div>
      <div class="bd2" oninput="smDirty()" onchange="smDirty()">${!c.reg ? '<div class="tg wa" style="display:block;white-space:normal;padding:8px">У клиента не указан режим налогообложения — налоговые процессы не подобраны. Укажите режим в карточке клиента.</div>' : ''}
      ${Object.entries(groups).map(([sp, L]) => `<div><h3 style="font-size:13px;color:var(--mu);text-transform:uppercase;margin:6px 0">${E(sp)}</h3><div style="display:grid;gap:6px">${L.map(row).join('')}</div></div>`).join('')}
      <div class="sec"><div class="st">Дополнительные услуги${ro ? '' : `<div class="sp"><button class="b s" onclick="smExAdd()">+ Добавить</button></div>`}</div><div class="sb"><div class="lst" id="sm_ex">${ex.map((x, i) => `<div class="row" data-ex="${i}"><b style="flex:1">${E(x.n)}</b><span class="tg ${x.ym ? 'wa' : ''}">${x.ym ? 'только ' + E(ymTxt(x.ym)) : 'постоянная'}</span><span class="tm">${money0((+x.price || 0) * Math.max(1, +x.q || 1))}</span>${ro ? '' : `<button class="b s r" onclick="smExDel(${i})" aria-label="Убрать">✕</button>`}</div>`).join('') || '<span style="color:var(--mu)">Нет дополнительных услуг</span>'}</div></div></div>
      ${ro ? '' : `<div class="row"><button class="b p" onclick="smSave()">Сохранить смету</button><button class="b" onclick="smSave(1)">Сохранить и создать задачи</button><span style="color:var(--mu);font-size:12px">Задачи создаются на ${PLH()} мес. вперёд по срокам процессов; уже созданные не дублируются.</span></div>`}</div></div>`;
    $('#md').className = 'on';
    $('#md')._manual = manual;
  }
  window.smDirty = () => { DIRTY = true; const c = S.clients.find((x) => x.id == SC); if (!c) return; const t = smTotal({ ...c, sm: collect(c) }); const e = document.getElementById('sm_tot'); if (e) e.textContent = money0(t.total); };
  window.smClose = () => { if (DIRTY) { ask('Смета изменена и не сохранена. Закрыть без сохранения?', () => { DIRTY = false; SC = null; mx(); }); return; } SC = null; mx(); };
  function collect(c) {
    const it = {};
    document.querySelectorAll('#md .smr').forEach((r) => {
      const id = r.dataset.bp, g = (k) => r.querySelector(`[data-k="${k}"]`);
      const day = g('day') && g('day').value ? Math.min(31, Math.max(1, Math.round(+g('day').value))) : null;
      it[id] = { on: g('on').checked ? 1 : 0, q: g('q') ? Math.min(999, Math.max(1, Math.round(+g('q').value || 1))) : 1, emp: +g('emp').value || 0, day, off: [...r.querySelectorAll('[data-sub]')].filter((x) => !x.checked).map((x) => +x.dataset.sub) };
    });
    return { it, ex: ((c.sm && c.sm.ex) || []).slice(), at: (c.sm && c.sm.at) || 0 };
  }
  window.smExAdd = function () {
    const c = S.clients.find((x) => x.id == SC); if (!c) return;
    const keep = $('#md').innerHTML, manual = bps().filter((b) => !fit(b, c).ok);
    $('#md').innerHTML = `<div class="c" style="width:min(560px,100%)"><h3>Добавить услугу в смету</h3>
      <div class="kv"><span>Из каталога (разовые, индивидуальные и не подобранные автоматически)</span><select id="sx_bp" onchange="smExPick()"><option value="">— своя услуга —</option>${manual.map((b) => `<option value="${b.id}">${E(b.n)}${b.price ? ' · ' + money0(b.price) : ''}</option>`).join('')}</select></div>
      <div class="kv"><span>Название *</span><input id="sx_n"></div><div class="row"><div class="kv" style="flex:1"><span>Цена, сом</span><input id="sx_p" type="number" min="0" value="0"></div><div class="kv" style="width:110px"><span>Кол-во</span><input id="sx_q" type="number" min="1" value="1"></div></div>
      <div class="kv"><span>Срок действия</span><label><input type="radio" name="sx_t" value="m" checked> Только этот месяц (${E(ymTxt(TD().slice(0, 7)))})</label><label><input type="radio" name="sx_t" value="p"> Постоянная — каждый месяц</label></div>
      <div id="sx_err"></div><div class="row"><button class="b p" id="sx_ok">Добавить</button><button class="b" id="sx_no">Отмена</button></div></div>`;
    const back = () => { $('#md').innerHTML = keep; };
    document.getElementById('sx_no').onclick = back;
    document.getElementById('sx_ok').onclick = () => {
      const n = document.getElementById('sx_n').value.trim(), p = +document.getElementById('sx_p').value, q = Math.round(+document.getElementById('sx_q').value || 1), bp = document.getElementById('sx_bp').value, per = document.querySelector('[name=sx_t]:checked').value;
      const er = (m) => { document.getElementById('sx_err').innerHTML = `<div class="tg er" style="display:block;padding:8px">${E(m)}</div>`; };
      if (!n) return er('Укажите название услуги.'); if (!(p >= 0)) return er('Цена не может быть отрицательной.'); if (q < 1 || q > 999) return er('Количество — от 1 до 999.');
      c.sm = c.sm || { it: {}, ex: [], at: 0 }; c.sm.ex = c.sm.ex || [];
      c.sm.ex.push({ id: bpId(), n: n.slice(0, 200), price: p, q, bp: bp || null, ym: per == 'm' ? TD().slice(0, 7) : null });
      DIRTY = true; smRender(); smDirty();
    };
  };
  window.smExPick = () => { const b = bps().find((x) => x.id == document.getElementById('sx_bp').value); if (b) { document.getElementById('sx_n').value = b.n; document.getElementById('sx_p').value = b.price || 0; } };
  window.smExDel = (i) => { const c = S.clients.find((x) => x.id == SC); if (!c || !c.sm) return; c.sm.ex.splice(i, 1); DIRTY = true; smRender(); smDirty(); };

  window.smSave = function (mkTasks) {
    const c = S.clients.find((x) => x.id == SC); if (!c || !own()) return;
    const old = c.sm || { it: {} }, sm = collect(c);
    const offNow = Object.keys(sm.it).filter((id) => !sm.it[id].on && (old.it[id] ? old.it[id].on : smItem(c, bps().find((b) => b.id == id) || { tax: [], fl: [], cat: '', per: '' }).on));
    const fut = S.tasks.filter((t) => t.cl == c.id && t.bp && offNow.includes(t.bp) && t.st == 'new' && !t.sp && t.due >= TD());
    const done = (delFut) => {
      sm.at = Date.now(); c.sm = sm;
      if (JSON.stringify(c).length > 29000) { toast('Смета слишком большая для одной записи: уберите часть доп. услуг'); return; }
      let rm = 0; if (delFut) { const ids = new Set(fut.map((t) => t.id)); S.tasks = S.tasks.filter((t) => !ids.has(t.id)); rm = ids.size; }
      const n = mkTasks ? smGen(c) : 0;
      logA('сохранил смету клиента «' + c.n + '»' + (n ? ', создано задач: ' + n : '') + (rm ? ', убрано будущих задач: ' + rm : ''));
      DIRTY = false; save(); toast('Смета сохранена' + (mkTasks ? '. Задач создано: ' + n : '') + (rm ? '. Убрано будущих: ' + rm : '')); smRender(); go();
    };
    if (fut.length) { $('#md').innerHTML = `<div class="c"><h3>Убрать будущие задачи?</h3><p>Вы выключили процессы, по которым уже созданы будущие задачи (ещё не начатые): <b>${fut.length}</b>.</p><div class="row"><button class="b r" id="smY">Убрать их</button><button class="b" id="smN">Оставить задачи</button></div></div>`; document.getElementById('smY').onclick = () => done(1); document.getElementById('smN').onclick = () => done(0); return; }
    done(0);
  };

  /* ---------- Задачи из сметы ---------- */
  const lastDay = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  function smGen(c, h) {
    h = h || PLH(); const cur = TD().slice(0, 7), today = TD(); let n = 0;
    bps().forEach((b) => {
      const it = smItem(c, b); if (!it.on || !AUTO.has(b.per)) return;
      const day = it.day || b.sd; if (!day) return;
      const months = b.per == 'Ежемесячно' ? null : defMonths(b);
      for (let i = 0; i <= h; i++) {
        const ym = ymAdd(cur, i); if (months && !months.includes(+ym.slice(5, 7))) continue;
        const due = ym + '-' + p2(Math.min(day, lastDay(ym))); if (due < today) continue;
        if (S.tasks.some((t) => t.cl == c.id && (t.bp == b.id || (!t.bp && t.t == b.n)) && t.due.slice(0, 7) == ym)) continue;
        const subs = b.ch.filter((_, k) => !(it.off || []).includes(k));
        S.tasks.push({ id: nid(S), cl: c.id, t: b.n.slice(0, 300), per: b.per, emp: it.emp || empOf(c), due, st: 'new', sp: 0, run: 0, h: b.min ? Math.round(b.min / 6) / 10 : null, by: null, cr: TD(), bp: b.id, q: b.qty ? it.q || 1 : undefined, sub: subs.length ? subs.map((s) => ({ n: s.slice(0, 200), ok: 0 })) : undefined, doc: b.doc ? 1 : undefined, rev: b.rev ? 1 : undefined });
        n++;
      }
    });
    ((c.sm && c.sm.ex) || []).forEach((x) => { const b = x.bp && bps().find((y) => y.id == x.bp); if (!b || !x.ym) return; if (S.tasks.some((t) => t.cl == c.id && t.bp == b.id && t.due.slice(0, 7) == x.ym)) return; const due = x.ym == cur ? (iso(7) > x.ym + '-' + p2(lastDay(x.ym)) ? x.ym + '-' + p2(lastDay(x.ym)) : iso(7)) : x.ym + '-' + p2(Math.min(b.sd || 15, lastDay(x.ym))); S.tasks.push({ id: nid(S), cl: c.id, t: b.n.slice(0, 300), per: 'Разово', emp: empOf(c), due, st: 'new', sp: 0, run: 0, h: b.min ? Math.round(b.min / 6) / 10 : null, by: null, cr: TD(), bp: b.id, doc: b.doc ? 1 : undefined, rev: b.rev ? 1 : undefined }); n++; });
    S.tasks.forEach((t) => { Object.keys(t).forEach((k) => { if (t[k] === undefined) delete t[k]; }); });
    return n;
  }
  window.smGenAll = function () {
    if (!own()) return; let n = 0, k = 0;
    S.clients.filter((c) => c.act && c.sm && c.sm.at).forEach((c) => { const x = smGen(c); if (x) { n += x; k++; } });
    logA('создал задачи по сметам: ' + n + ' (клиентов ' + k + ')'); save(); toast(n ? 'Создано задач: ' + n + ' по ' + k + ' клиентам' : 'Все задачи по сметам уже созданы'); go();
  };

  /* ---------- PDF сметы ---------- */
  window.smPdf = function () {
    const c = S.clients.find((x) => x.id == SC); if (!c) return;
    const sm = DIRTY ? collect(c) : c.sm, cc2 = { ...c, sm }, T = smTotal(cc2), ym = TD().slice(0, 7);
    const L = bps().map((b) => [b, smItem(cc2, b)]).filter(([, it]) => it.on);
    const ex = ((sm && sm.ex) || []).filter((x) => !x.ym || x.ym == ym);
    const F = (window.ESA2 && window.ESA2.firm) ? window.ESA2.firm() : { name: (SYNC && SYNC.firm && SYNC.firm.name) || 'ESA Control' };
    const firm = F.name + (F.inn ? ' · ИНН ' + F.inn : '') + (F.addr ? ' · ' + F.addr : '') + (F.phone ? ' · ' + F.phone : '');
    const bankLine = F.bank ? `<p class="mu">Реквизиты для оплаты: ${E(F.bank)}${F.acc ? ', р/с ' + E(F.acc) : ''}${F.bik ? ', БИК ' + E(F.bik) : ''}</p>` : '';
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Смета — ${E(c.n)}</title><style>body{font:12px/1.4 Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #bbb;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eef5f3}.r{text-align:right}.mu{color:#666}</style></head><body>
      <h1>Смета бухгалтерского обслуживания</h1><div class="mu">${E(firm)} · ${new Date().toLocaleDateString('ru-RU')}</div>
      <p><b>Клиент:</b> ${E(c.of ? c.of + ' ' : '')}${E(c.n)}${c.inn ? ' · ИНН ' + E(c.inn) : ''}<br><b>Режим:</b> ${E(c.reg || '—')} · <b>Тариф:</b> ${E(c.tar || '—')} · <b>Исполнитель:</b> ${E(en(empOf(c)))}</p>
      <table><tr><th>№</th><th>Услуга</th><th>Периодичность и срок</th><th>Кол-во</th><th>Биллинг</th><th class="r">Сумма, сом</th></tr>${L.map(([b, it], i) => `<tr><td>${i + 1}</td><td>${E(b.n)}</td><td>${E(schedTxt(b, it.day))}</td><td>${b.qty ? it.q || 1 : ''}</td><td>${E(BILL[b.bill])}</td><td class="r">${price(b, it) ? Math.round(price(b, it)).toLocaleString('ru-RU') : '—'}</td></tr>`).join('')}
      ${ex.map((x, i) => `<tr><td>${L.length + i + 1}</td><td>${E(x.n)}</td><td>${x.ym ? 'разово, ' + E(ymTxt(x.ym)) : 'ежемесячно'}</td><td>${x.q || 1}</td><td>Доп. услуга</td><td class="r">${Math.round((+x.price || 0) * Math.max(1, +x.q || 1)).toLocaleString('ru-RU')}</td></tr>`).join('')}
      <tr><td colspan="5">Абонентская плата по тарифу «${E(c.tar || '—')}»</td><td class="r">${Math.round(T.tar).toLocaleString('ru-RU')}</td></tr><tr><th colspan="5">ИТОГО в месяц</th><th class="r">${Math.round(T.total).toLocaleString('ru-RU')}</th></tr></table>
      ${bankLine}<p class="mu" style="margin-top:24px">Исполнитель: ____________________ ${F.dir ? E(F.dir) : ''} &nbsp;&nbsp;&nbsp; Заказчик: ____________________</p></body></html>`;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Не удалось открыть печать'); } setTimeout(() => f.remove(), 60000); }, 300);
  };

  /* ---------- БухСмета: список смет клиентов ---------- */
  const _sm = V.sm;
  V.sm = function () {
    const base = _sm.call(V), L = CL().filter((c) => c.act);
    const rows = L.map((c) => { const T = smTotal(c); return `<tr><td><b style="cursor:pointer" onclick="smOpen(${c.id})">${E(c.n)}</b></td><td>${E(c.reg || '—')}</td><td>${E(en(empOf(c)))}</td><td>${T.n}</td><td class="tm">${money0(T.total)}</td><td style="font-size:12px">${c.sm && c.sm.at ? new Date(c.sm.at).toLocaleDateString('ru-RU') : '<span class="tg wa">не составлена</span>'}</td><td><button class="b s p" onclick="smOpen(${c.id})">Смета</button></td></tr>`; }).join('');
    const top = `<div class="c tw" style="margin-bottom:14px"><div class="row"><h3 style="margin:0;flex:1">Сметы клиентов (по каталогу бизнес-процессов)</h3>${own() ? `<button class="b s" onclick="bpList()">Каталог процессов (${bps().length})</button><button class="b s p" onclick="smGenAll()">Создать задачи по всем сметам</button>` : ''}</div>
      <table><tr><th>Клиент</th><th>Режим</th><th>Исполнитель</th><th>Услуг</th><th>Итого в месяц</th><th>Смета</th><th></th></tr>${rows || '<tr><td colspan=7>Нет активных клиентов</td></tr>'}</table></div>`;
    return top + base;
  };

  /* ---------- Настройки: вход в каталог ---------- */
  const _set = V.set;
  V.set = function () {
    const h = _set.call(V);
    const card = `<div class="c"><h3>Бизнес-процессы</h3><p style="color:var(--mu);margin-bottom:8px">Каталог услуг фирмы: периодичность, сроки, правила закрытия, биллинг и цены. Из него собираются сметы и задачи клиентов.</p><div class="row"><b>${bps().length}</b><span>процессов</span><button class="b p" onclick="bpList()">Открыть каталог</button></div></div>`;
    return h.replace('<div class="gr g2">', '<div class="gr g2">' + card);
  };

  /* ---------- Задачник: подпункты и правила из сметы видны в задаче ---------- */
  window.ESA2 = window.ESA2 || {}; Object.assign(window.ESA2, { BILL, smGen, fit, regCode });
  if (typeof S !== 'undefined' && S) { try { go(); } catch (e) { } }
})();
