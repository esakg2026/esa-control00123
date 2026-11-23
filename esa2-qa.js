/* ESA Control 2.0 · Этап 4: аудит качества.
   S.qa — аудиты фирмы (настройки фирмы, вид 'g'), S.qstd — стандарт чек-листа.
   Аудит: {id, cl, from, to, by, st:'w'|'d', at, up, dn, ver:{[taskId]:{v:'ok'|'f', sev, note, task}}, ck:[{id, sec, n, v, sev, note, task}]}.
   Замечание = вердикт «Замечание» по задаче или пункт чек-листа с ошибкой. Передача исполнителю создаёт задачу-исправление (поля qa, qf). */
(function () {
  'use strict';
  const own = () => ME == null && S && S.role == 'admin';
  const SEV = { crit: ['Критично', 'er', 2], sig: ['Существенно', 'wa', 5], min: ['Незначительно', '', 10] };
  const qid = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const dRu = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '—');
  const QA = () => (S.qa = S.qa || []);
  const DEF_STD = [
    ['Банк и касса', 'Остаток по банку в 1С совпадает с выпиской на конец периода'], ['Банк и касса', 'Остаток кассы не отрицательный, кассовая книга сведена'],
    ['Первичка', 'Все поступления и реализации подтверждены документами (ЭСФ, акты, накладные)'], ['Первичка', 'Реестр недостающих документов ведётся'],
    ['Расчёты', 'Нет необоснованных авансов и «висящей» дебиторки/кредиторки'], ['Расчёты', 'Акты сверки с ключевыми контрагентами есть'],
    ['Налоги', 'Отчёты за период сданы с отметкой «Принят»'], ['Налоги', 'Суммы налогов в отчётах = начисления в учёте'], ['Налоги', 'Налоги оплачены в срок, подтверждения приложены'],
    ['Зарплата', 'Начисления ЗП = Форма 161, взносы рассчитаны верно'],
    ['Закрытие', 'Месяц закрыт, ОСВ сформирована, отрицательных остатков нет'], ['Закрытие', 'Копия базы 1С выгружена в папку клиента']];
  const std = () => (S.qstd && S.qstd.length ? S.qstd : DEF_STD.map(([sec, n]) => ({ sec, n })));

  /* ---------- Меню ---------- */
  if (!NAV.some((n) => n[0] == 'qa')) { const i = NAV.findIndex((n) => n[0] == 'au'); NAV.splice(i + 1, 0, ['qa', 'Аудит качества', '◎', 'admin']); }
  TITLE.qa = 'Аудит качества';
  IC.qa = `<path d='M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z'/><path d='M9 12h6M12 9v6'/>`;

  /* ---------- Задачи периода и замечания ---------- */
  const inPer = (t, a) => { const d = (t.dd || t.due || '').slice(0, 10); return d >= a.from && d <= a.to; };
  const pTasks = (a) => S.tasks.filter((t) => t.cl == a.cl && t.st == 'done' && t.au == null && !t.qa && inPer(t, a)).sort((x, y) => (x.t > y.t ? 1 : -1));
  function findings(a) {
    const F = [];
    Object.entries(a.ver || {}).forEach(([tid, v]) => { if (v.v == 'f') { const t = S.tasks.find((x) => x.id == tid); F.push({ a, key: 't' + tid, src: t ? t.t : 'задача удалена', note: v.note, sev: v.sev, task: v.task, ref: v }); } });
    (a.ck || []).forEach((r) => { if (r.v == 'f') F.push({ a, key: 'c' + r.id, src: 'Чек-лист: ' + r.n, note: r.note, sev: r.sev, task: r.task, ref: r }); });
    return F;
  }
  function fState(f) {
    const t = f.task && S.tasks.find((x) => x.id == f.task);
    if (!t) return f.task ? 'fixed' : 'new';     // задачу-исправление закрыли и удалили — считаем устранённым
    if (t.st == 'done') return 'fixed';
    if (t.st == 'rev') return 'review';
    return od(t) ? 'late' : 'active';
  }
  const FST = { new: ['Не передано', 'wa'], active: ['У исполнителя', ''], review: ['На проверке', 'wa'], late: ['Просрочено', 'er'], fixed: ['Устранено', 'ok'] };

  /* ---------- Список аудитов ---------- */
  let NEWF = false, QF = 'open';
  V.qa = function () {
    if (!own()) return '<div class="c">Аудит качества ведёт руководитель.</div>';
    const L = QA().slice().sort((a, b) => (b.up || b.at) - (a.up || a.at));
    const allF = L.flatMap(findings), cnt = (s) => allF.filter((f) => (s == 'open' ? fState(f) != 'fixed' : fState(f) == s)).length;
    const pr = (k) => { const d = new Date(), y = d.getFullYear(), q = Math.floor(d.getMonth() / 3); const Q = (yy, qq) => [yy + '-' + p2(qq * 3 + 1) + '-01', yy + '-' + p2(qq * 3 + 3) + '-' + new Date(yy, qq * 3 + 3, 0).getDate()]; return k == 'q' ? Q(y, q) : k == 'pq' ? (q ? Q(y, q - 1) : Q(y - 1, 3)) : k == 'h' ? [y + '-01-01', y + '-06-30'] : k == 'y' ? [y + '-01-01', y + '-12-31'] : k == 'py' ? [(y - 1) + '-01-01', (y - 1) + '-12-31'] : [iso(-30), TD()]; };
    window.__qaPr = pr;
    const form = NEWF ? `<div class="c" style="margin-bottom:14px"><h3>Новый аудит</h3><div class="row"><select id="qn_cl" style="flex:1;min-width:220px"><option value="">— выберите клиента —</option>${S.clients.filter((c) => c.act).map((c) => `<option value="${c.id}">${E(c.n)}</option>`).join('')}</select>
      <select id="qn_p" onchange="qaPer(this.value)"><option value="pq">Прошлый квартал</option><option value="q">Текущий квартал</option><option value="h">Первое полугодие</option><option value="y">Текущий год</option><option value="py">Прошлый год</option><option value="c">Произвольный</option></select>
      <input id="qn_f" type="date" value="${pr('pq')[0]}"><input id="qn_t" type="date" value="${pr('pq')[1]}"></div>
      <p style="color:var(--mu);font-size:13px;margin:6px 0">В аудит попадут закрытые задачи клиента с датой выполнения в периоде. Чек-лист копируется из стандарта фирмы (${std().length} пунктов, его можно изменить в «Стандарт чек-листа»).</p><div id="qn_e"></div>
      <div class="row"><button class="b p" onclick="qaNew()">Создать и начать</button><button class="b" onclick="qaNewT(0)">Отмена</button></div></div>` : '';
    const st = (a) => { const T = pTasks(a), vd = T.filter((t) => a.ver && a.ver[t.id]).length, F = findings(a), ck = (a.ck || []).filter((r) => r.v).length; return { T, vd, F, ck }; };
    return `<div class="c" style="margin-bottom:14px"><div class="row"><div style="flex:1"><b style="font-size:18px">Аудиты</b><br><span style="color:var(--mu)">Проверка качества работы по клиенту за период: вердикт по каждой закрытой задаче и чек-лист. Замечания передаются исполнителю задачей и отслеживаются до устранения.</span></div>
      <button class="b" onclick="qaFind()">Замечания <span class="tg ${cnt('open') ? 'er' : ''}">${cnt('open')}</span></button><button class="b" onclick="qaStd()">Стандарт чек-листа</button><button class="b p" onclick="qaNewT(1)">+ Новый аудит</button></div></div>${form}
      <div class="c tw"><table><tr><th>Клиент</th><th>Период</th><th>Аудитор</th><th>Статус</th><th>Проверено задач</th><th>Замечания</th><th>Чек-лист</th><th>Обновлён</th><th></th></tr>${L.map((a) => { const s = st(a), by = (k) => s.F.filter((f) => f.sev == k).length; return `<tr><td><b style="cursor:pointer" onclick="qaOpen('${a.id}')">${E(cn(a.cl))}</b></td><td>${dRu(a.from)} – ${dRu(a.to)}</td><td>${E(a.by)}</td><td>${a.st == 'd' ? '<span class="tg ok">Завершён ' + dRu(a.dn) + '</span>' : '<span class="tg">В работе</span>'}</td><td>${s.vd} / ${s.T.length}</td><td>${s.F.length ? `<span class="tg er">${by('crit')}</span> <span class="tg wa">${by('sig')}</span> <span class="tg">${by('min')}</span>` : '—'}</td><td>${s.ck} / ${(a.ck || []).length}</td><td style="font-size:12px">${new Date(a.up || a.at).toLocaleDateString('ru-RU')}</td><td><button class="b s" onclick="qaOpen('${a.id}')">Открыть</button> <button class="b s r" onclick="qaDel('${a.id}')" aria-label="Удалить">✕</button></td></tr>`; }).join('') || '<tr><td colspan=9>Аудитов пока нет. Нажмите «Новый аудит», выберите клиента и период.</td></tr>'}</table></div>`;
  };
  window.qaNewT = (v) => { NEWF = !!v; go(); };
  window.qaPer = (k) => { if (k == 'c') return; const p = window.__qaPr(k); document.getElementById('qn_f').value = p[0]; document.getElementById('qn_t').value = p[1]; };
  window.qaNew = function () {
    const cl = +document.getElementById('qn_cl').value, f = document.getElementById('qn_f').value, t = document.getElementById('qn_t').value;
    const err = (m) => { document.getElementById('qn_e').innerHTML = `<div class="tg er" role="alert" style="display:block;padding:8px;margin-bottom:8px">${E(m)}</div>`; };
    if (!cl) return err('Выберите клиента.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return err('Укажите период.');
    if (t < f) return err('Конец периода раньше начала.');
    if (f > TD()) return err('Период ещё не начался.');
    const dup = QA().find((a) => a.cl == cl && a.from == f && a.to == t); if (dup) { err('Аудит этого клиента за этот период уже есть — открываю его.'); setTimeout(() => qaOpen(dup.id), 700); return; }
    if (QA().length >= 80) return err('Аудитов слишком много (80). Удалите старые завершённые.');
    const a = { id: qid(), cl, from: f, to: t, by: LG || CU || 'руководитель', st: 'w', at: Date.now(), up: Date.now(), ver: {}, ck: std().map((r, i) => ({ id: 'r' + i, sec: r.sec, n: r.n, v: null })) };
    QA().push(a); NEWF = false; logA('начал аудит: ' + cn(cl) + ' за ' + dRu(f) + '–' + dRu(t)); save(); go(); qaOpen(a.id);
    if (!pTasks(a).length) toast('За этот период у клиента нет закрытых задач — проверьте границы периода');
  };
  window.qaDel = function (id) {
    const a = QA().find((x) => x.id == id); if (!a) return;
    const fx = S.tasks.filter((t) => t.qa == id && t.st != 'done');
    ask(`Удалить аудит «${cn(a.cl)}» за ${dRu(a.from)}–${dRu(a.to)}?${fx.length ? ' Незакрытых задач-исправлений: ' + fx.length + ' — они тоже будут удалены.' : ''} Отменить нельзя.`, () => {
      S.qa = QA().filter((x) => x.id != id); const ids = new Set(fx.map((t) => t.id)); S.tasks = S.tasks.filter((t) => !ids.has(t.id));
      logA('удалил аудит: ' + cn(a.cl) + ' за ' + dRu(a.from) + '–' + dRu(a.to)); save(); toast('Аудит удалён'); go();
    });
  };

  /* ---------- Страница аудита ---------- */
  let QO = null, QTAB = 't';
  window.qaOpen = function (id, tab) { QO = id; if (tab) QTAB = tab; qaRender(); };
  function qaRender() {
    const a = QA().find((x) => x.id == QO); if (!a) { mx(); return; }
    const T = pTasks(a), F = findings(a), ro = a.st == 'd', vd = T.filter((t) => a.ver[t.id]).length, ckd = a.ck.filter((r) => r.v).length;
    const by = (k) => F.filter((f) => f.sev == k).length;
    const vBtns = (key, v, kind) => ro ? '' : `<button class="b s ${v && v.v == 'ok' ? 'g' : ''}" onclick="qaV('${kind}','${key}','ok')">Норма</button> <button class="b s ${v && v.v == 'f' ? 'r' : ''}" onclick="qaV('${kind}','${key}','f')">Замечание</button>${v && v.v ? ` <button class="b s" onclick="qaV('${kind}','${key}',null)" title="Снять вердикт">↺</button>` : ''}`;
    const vTxt = (v) => !v || !v.v ? '<span class="tg">не проверено</span>' : v.v == 'ok' ? '<span class="tg ok">норма</span>' : `<span class="tg ${SEV[v.sev][1]}">${SEV[v.sev][0]}</span> ${E(v.note || '')}`;
    const groups = {}; T.forEach((t) => { const b = t.bp && (S.bp || []).find((x) => x.id == t.bp), g = (b && b.sp) || t.per || 'Прочее'; (groups[g] = groups[g] || []).push(t); });
    const tasksHtml = Object.keys(groups).length ? Object.entries(groups).map(([g, L]) => `<h3 style="font-size:13px;color:var(--mu);text-transform:uppercase;margin:8px 0 4px">${E(g)}</h3><div class="tw"><table>${L.map((t) => `<tr><td><b style="cursor:pointer" onclick="tkCard&&tkCard(${t.id})">${E(t.t)}</b><br><span style="font-size:12px;color:var(--mu)">срок ${dRu(t.due)} · выполнена ${dRu(t.dd)}${t.ok === false ? ' с опозданием' : ''} · ${E(en(t.emp))}${t.fx ? ' · закрыта принудительно: ' + E(t.fx) : ''}${typeof dList == 'function' ? ' · документов ' + dList(t.id).length : ''}</span></td><td>${vTxt(a.ver[t.id])}</td><td style="white-space:nowrap">${vBtns(t.id, a.ver[t.id], 't')}</td></tr>`).join('')}</table></div>`).join('') : '<p style="color:var(--mu);padding:12px">За этот период у клиента нет закрытых задач. Задачи попадают в аудит по дате выполнения.</p>';
    const secs = [...new Set(a.ck.map((r) => r.sec))];
    const ckHtml = secs.map((s) => `<h3 style="font-size:13px;color:var(--mu);text-transform:uppercase;margin:8px 0 4px">${E(s)}${ro ? '' : ` <button class="b s" onclick="qaSecRen('${E(s)}')" title="Переименовать раздел">${PEN}</button> <button class="b s r" onclick="qaSecDel('${E(s)}')" title="Удалить раздел">✕</button>`}</h3><div class="tw"><table>${a.ck.filter((r) => r.sec == s).map((r) => `<tr><td>${E(r.n)}</td><td>${vTxt(r)}</td><td style="white-space:nowrap">${vBtns(r.id, r, 'c')}</td></tr>`).join('')}</table></div>`).join('') + (ro ? '' : `<div class="row" style="margin-top:8px"><input id="qa_cs" placeholder="Раздел" list="qa_secs" style="width:200px"><datalist id="qa_secs">${secs.map((s) => `<option value="${E(s)}">`).join('')}</datalist><input id="qa_cn" placeholder="Новый пункт чек-листа" style="flex:1"><button class="b s" onclick="qaCkAdd()">+ Пункт</button></div>`);
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><div style="flex:1;min-width:0"><h2>Аудит: ${E(cn(a.cl))}</h2><div style="color:var(--mu);font-size:13px">${dRu(a.from)} – ${dRu(a.to)} · аудитор ${E(a.by)} · ${ro ? 'завершён ' + dRu(a.dn) : 'в работе · всё сохраняется сразу'}</div></div>${ro ? `<button class="b" onclick="qaDone(0)">Вернуть в работу</button>` : `<button class="b p" onclick="qaDone(1)">Завершить аудит</button>`}<button class="b" onclick="mx();go()" aria-label="Закрыть">✕</button></div><div class="bd2">
      <div class="gr k5" style="margin:0"><div class="c kp"><span>Проверено задач</span><b>${vd} / ${T.length}</b><span>осталось ${T.length - vd}</span></div><div class="c kp"><span>Замечания</span><b>${F.length}</b><span><span class="tg er">${by('crit')} критич.</span> <span class="tg wa">${by('sig')} сущ.</span> <span class="tg">${by('min')} незнач.</span></span></div><div class="c kp"><span>Чек-лист</span><b>${ckd} / ${a.ck.length}</b><span>ошибок ${a.ck.filter((r) => r.v == 'f').length}</span></div><div class="c kp"><span>Не передано исполнителю</span><b>${F.filter((f) => fState(f) == 'new').length}</b><span><button class="b s" onclick="qaFind('${a.id}')">Открыть замечания</button></span></div></div>
      <div class="row"><button class="b s ${QTAB == 't' ? 'p' : ''}" onclick="qaOpen('${a.id}','t')">Задачи периода (${vd}/${T.length})</button><button class="b s ${QTAB == 'c' ? 'p' : ''}" onclick="qaOpen('${a.id}','c')">Чек-лист (${ckd}/${a.ck.length})</button></div>
      <div>${QTAB == 't' ? tasksHtml : ckHtml}</div></div></div>`;
    $('#md').className = 'on';
  }
  const touch = (a) => { a.up = Date.now(); save(); };
  window.qaV = function (kind, key, v) {
    const a = QA().find((x) => x.id == QO); if (!a || a.st == 'd') return;
    const obj = kind == 't' ? (a.ver[key] = a.ver[key] || {}) : a.ck.find((r) => r.id == key);
    if (!obj) return;
    if (obj.task && S.tasks.some((t) => t.id == obj.task && t.st != 'done') && v != 'f') { toast('По этому замечанию уже есть задача-исправление — сначала закройте или удалите её'); return; }
    if (v == 'f') {
      const keep = $('#md').innerHTML;
      $('#md').innerHTML = `<div class="c"><h3>Замечание</h3><div class="row">${Object.entries(SEV).map(([k, s]) => `<label><input type="radio" name="qv_s" value="${k}" ${(obj.sev || 'sig') == k ? 'checked' : ''}> ${s[0]}</label>`).join('')}</div><textarea id="qv_n" rows="3" placeholder="Что не так и что исправить">${E(obj.note || '')}</textarea><div id="qv_e"></div><div class="row"><button class="b r" id="qv_ok">Сохранить вердикт</button><button class="b" id="qv_no">Отмена</button></div></div>`;
      document.getElementById('qv_no').onclick = () => { if (kind == 't' && !a.ver[key].v) delete a.ver[key]; $('#md').innerHTML = keep; };
      document.getElementById('qv_ok').onclick = () => {
        const n = document.getElementById('qv_n').value.trim(); if (n.length < 3) { document.getElementById('qv_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Опишите замечание (хотя бы несколько слов).</div>'; return; }
        obj.v = 'f'; obj.sev = document.querySelector('[name=qv_s]:checked').value; obj.note = n.slice(0, 500); touch(a); logA('аудит ' + cn(a.cl) + ': замечание (' + SEV[obj.sev][0].toLowerCase() + ') — ' + obj.note); qaRender();
      };
      return;
    }
    if (v == null) { if (kind == 't') delete a.ver[key]; else { obj.v = null; delete obj.sev; delete obj.note; } }
    else { obj.v = 'ok'; delete obj.sev; delete obj.note; }
    touch(a); qaRender();
  };
  window.qaCkAdd = function () { const a = QA().find((x) => x.id == QO); const s = document.getElementById('qa_cs').value.trim() || 'Дополнительно', n = document.getElementById('qa_cn').value.trim(); if (!n) { toast('Введите текст пункта'); return; } a.ck.push({ id: 'r' + Date.now().toString(36), sec: s.slice(0, 80), n: n.slice(0, 300), v: null }); touch(a); qaRender(); };
  window.qaSecRen = function (s) {
    const a = QA().find((x) => x.id == QO); if (!a) return; const keep = $('#md').innerHTML;
    $('#md').innerHTML = `<div class="c"><h3>Переименовать раздел</h3><input id="qr_n" value="${E(s)}" maxlength="80"><div id="qr_e"></div><div class="row"><button class="b p" id="qr_ok">Сохранить</button><button class="b" id="qr_no">Отмена</button></div></div>`;
    document.getElementById('qr_no').onclick = () => { $('#md').innerHTML = keep; };
    document.getElementById('qr_ok').onclick = () => { const v = document.getElementById('qr_n').value.trim(); if (!v) { document.getElementById('qr_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Название не может быть пустым.</div>'; return; } a.ck.forEach((r) => { if (r.sec == s) r.sec = v; }); touch(a); qaRender(); };
  };
  window.qaSecDel = function (s) { const a = QA().find((x) => x.id == QO); const L = a.ck.filter((r) => r.sec == s); if (L.some((r) => r.task && S.tasks.some((t) => t.id == r.task && t.st != 'done'))) { toast('В разделе есть замечания с открытыми задачами-исправлениями'); return; } const keep = $('#md').innerHTML; ask('Удалить раздел «' + s + '» (' + L.length + ' пунктов) из этого аудита?', () => { a.ck = a.ck.filter((r) => r.sec != s); touch(a); qaRender(); }); };
  window.qaDone = function (v) {
    const a = QA().find((x) => x.id == QO); if (!a) return;
    if (v) { const T = pTasks(a), left = T.filter((t) => !a.ver[t.id]).length, lc = a.ck.filter((r) => !r.v).length, nf = findings(a).filter((f) => fState(f) == 'new').length;
      const go2 = () => { a.st = 'd'; a.dn = TD(); touch(a); logA('завершил аудит: ' + cn(a.cl) + ' за ' + dRu(a.from) + '–' + dRu(a.to)); toast('Аудит завершён'); qaRender(); };
      if (left || lc || nf) { ask(`Не проверено задач: ${left}, пунктов чек-листа: ${lc}, замечаний не передано исполнителю: ${nf}. Всё равно завершить?`, () => { go2(); }); return; }
      go2();
    } else { a.st = 'w'; delete a.dn; touch(a); logA('вернул аудит в работу: ' + cn(a.cl)); qaRender(); }
  };

  /* ---------- Замечания ---------- */
  let FA = null;
  window.qaFind = function (aid) {
    FA = aid === undefined ? FA : aid || null;
    const L = (FA ? QA().filter((a) => a.id == FA) : QA()).flatMap(findings), cnt = (s) => L.filter((f) => (s == 'open' ? fState(f) != 'fixed' : s == 'all' ? 1 : fState(f) == s)).length;
    const V2 = L.filter((f) => (QF == 'all' ? 1 : QF == 'open' ? fState(f) != 'fixed' : fState(f) == QF)).sort((x, y) => SEV[x.sev][2] - SEV[y.sev][2]);
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><div style="flex:1"><h2>Замечания аудита${FA ? ': ' + E(cn((QA().find((a) => a.id == FA) || {}).cl)) : ''}</h2><div style="color:var(--mu);font-size:13px">Замечание живёт дольше аудита: отслеживается, пока задача-исправление не будет выполнена.</div></div>${FA ? `<button class="b s" onclick="qaFind(null)">Все аудиты</button>` : ''}<button class="b" onclick="mx();go()" aria-label="Закрыть">✕</button></div><div class="bd2">
      <div class="row">${[['open', 'Активные'], ['new', 'Не переданы'], ['review', 'На проверке'], ['late', 'Просрочены'], ['fixed', 'Устранены'], ['all', 'Все']].map(([k, t]) => `<button class="b s ${QF == k ? 'p' : ''}" onclick="QFs('${k}')">${t} <span class="tg">${cnt(k)}</span></button>`).join('')}</div>
      <div class="tw"><table><tr><th>Клиент / аудит</th><th>Что проверяли</th><th>Замечание</th><th>Статус</th><th></th></tr>${V2.map((f) => { const s = fState(f), t = f.task && S.tasks.find((x) => x.id == f.task); return `<tr><td><b>${E(cn(f.a.cl))}</b><br><span style="font-size:12px;color:var(--mu)">${dRu(f.a.from)}–${dRu(f.a.to)}</span></td><td>${E(f.src)}</td><td><span class="tg ${SEV[f.sev][1]}">${SEV[f.sev][0]}</span> ${E(f.note || '')}</td><td><span class="tg ${FST[s][1]}">${FST[s][0]}</span>${t ? `<br><span style="font-size:12px;color:var(--mu)">${E(en(t.emp))} · до ${dRu(t.due)}</span>` : ''}</td><td>${s == 'new' ? `<button class="b s p" onclick="qaSend('${f.a.id}','${f.key}')">Передать исполнителю</button>` : t ? `<button class="b s" onclick="tkCard&&tkCard(${t.id})">Задача</button>` : ''} <button class="b s" onclick="mx();qaOpen('${f.a.id}')">Аудит</button></td></tr>`; }).join('') || '<tr><td colspan=5>В этом разделе замечаний нет. Они появляются, когда аудитор ставит вердикт «Замечание».</td></tr>'}</table></div>
      ${V2.some((f) => fState(f) == 'new') ? `<div class="row"><button class="b p" onclick="qaSendAll()">Передать все непереданные (${V2.filter((f) => fState(f) == 'new').length})</button></div>` : ''}</div></div>`;
    $('#md').className = 'on';
  };
  window.QFs = (k) => { QF = k; qaFind(); };
  function send(a, key) {
    const f = findings(a).find((x) => x.key == key); if (!f || fState(f) != 'new') return 0;
    const c = S.clients.find((x) => x.id == a.cl); if (!c) return 0;
    const src = key[0] == 't' ? S.tasks.find((t) => t.id == key.slice(1)) : null, emp = (src && src.emp) || c.ex || c.ch;
    if (!emp) { toast('У клиента «' + c.n + '» нет исполнителя'); return 0; }
    const t = { id: nid(S), cl: a.cl, t: ('Исправить замечание аудита: ' + f.src).slice(0, 300), per: 'Разово', emp, due: iso(SEV[f.sev][2]), st: 'new', sp: 0, run: 0, h: 0.5, by: 'руководитель (аудит)', cr: TD(), qa: a.id, qf: key, nt: ('[' + SEV[f.sev][0] + '] ' + (f.note || '')).slice(0, 1000), rev: 1 };
    S.tasks.push(t); f.ref.task = t.id; a.up = Date.now(); return 1;
  }
  window.qaSend = function (aid, key) { const a = QA().find((x) => x.id == aid); if (!a) return; if (send(a, key)) { logA('передал замечание аудита исполнителю: ' + cn(a.cl)); save(); toast('Задача-исправление создана'); } qaFind(); };
  window.qaSendAll = function () { let n = 0; (FA ? QA().filter((a) => a.id == FA) : QA()).forEach((a) => findings(a).filter((f) => fState(f) == 'new').forEach((f) => { n += send(a, f.key); })); if (n) { logA('передал замечания аудита: ' + n); save(); } toast('Создано задач-исправлений: ' + n); qaFind(); };

  /* ---------- Стандарт чек-листа ---------- */
  window.qaStd = function () {
    const L = std();
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><div style="flex:1"><h2>Стандарт чек-листа</h2><div style="color:var(--mu);font-size:13px">Копируется в каждый новый аудит. Изменения не затрагивают уже созданные аудиты.</div></div><button class="b" onclick="mx();go()" aria-label="Закрыть">✕</button></div><div class="bd2">
      <p style="color:var(--mu);font-size:13px">Каждая строка — пункт: <b>Раздел | Текст пункта</b>. Пустые строки пропускаются.</p>
      <textarea id="qs_t" rows="16" style="font-family:ui-monospace,Consolas,monospace">${E(L.map((r) => r.sec + ' | ' + r.n).join('\n'))}</textarea><div id="qs_e"></div>
      <div class="row"><button class="b p" onclick="qaStdSave()">Сохранить стандарт</button><button class="b" onclick="qaStdReset()">Вернуть стандартный (${DEF_STD.length})</button><button class="b" onclick="mx();go()">Отмена</button></div></div></div>`;
    $('#md').className = 'on';
  };
  window.qaStdSave = function () {
    const lines = document.getElementById('qs_t').value.split('\n').map((s) => s.trim()).filter(Boolean), out = [], bad = [];
    lines.forEach((l, i) => { const p = l.split('|'); if (p.length < 2 || !p[0].trim() || !p.slice(1).join('|').trim()) bad.push(i + 1); else out.push({ sec: p[0].trim().slice(0, 80), n: p.slice(1).join('|').trim().slice(0, 300) }); });
    if (bad.length) { document.getElementById('qs_e').innerHTML = `<div class="tg er" style="display:block;white-space:normal;padding:8px">Строки ${bad.slice(0, 8).join(', ')}: нужен формат «Раздел | Текст пункта».</div>`; return; }
    if (!out.length) { document.getElementById('qs_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Стандарт пуст — добавьте хотя бы один пункт.</div>'; return; }
    if (out.length > 150) { document.getElementById('qs_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Не больше 150 пунктов.</div>'; return; }
    S.qstd = out; logA('изменил стандарт чек-листа аудита: ' + out.length + ' пунктов'); save(); toast('Стандарт сохранён: ' + out.length + ' пунктов'); mx(); go();
  };
  window.qaStdReset = function () { ask('Вернуть стандартный чек-лист (' + DEF_STD.length + ' пунктов)? Ваш текущий стандарт будет заменён.', () => { S.qstd = null; save(); toast('Возвращён стандартный чек-лист'); qaStd(); }); };

  /* задача-исправление выполнена → в карточке аудита замечание станет «Устранено» автоматически (через fState) */
  window.ESA2 = window.ESA2 || {}; Object.assign(window.ESA2, { qaFindings: findings, qaState: fState });
  if (typeof S !== 'undefined' && S) { try { go(); } catch (e) { } }
})();
