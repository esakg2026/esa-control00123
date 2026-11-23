/* ESA Control 2.0 · Этап 3: БухЗадачник 2.0.
   Поля задачи: sub [{n,ok}] — подпункты, doc — нужен документ, wv — требование документа снято, rev — с проверкой,
   nt — заметка исполнителя, rc — комментарий при возврате, fx — причина принудительного закрытия, by — кто поручил. */
(function () {
  'use strict';
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const boss = () => S && S.role != 'acc';                         // руководитель или главбух
  const me = () => (ME == null ? null : ME);
  const myName = () => (ME == null ? 'руководитель' : en(ME));
  const dRu = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '—');
  const subDone = (t) => (t.sub || []).filter((s) => s.ok).length;
  const needDoc = (t) => t.doc && !t.wv && !(typeof dList == 'function' && dList(t.id).length);
  const T = (id) => S.tasks.find((x) => x.id == id);
  const bpOf = (t) => t.bp && (S.bp || []).find((b) => b.id == t.bp);
  const canEdit = (t) => boss() || t.emp == me();

  const st = document.createElement('style');
  st.textContent = `
  .tkb{display:inline-flex;gap:4px;flex-wrap:wrap;margin-left:4px}.tkb .tg{font-weight:500}
  #tbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:auto;margin-left:10px}
  #tbar .run{display:inline-flex;gap:6px;align-items:center;background:var(--soft);border:1px solid var(--bd);border-radius:20px;padding:4px 6px 4px 12px;font-size:13px;max-width:360px}
  #tbar .run b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px}
  .tkc .sub label{display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--bd);cursor:pointer}
  .tkc .sub label.ok span{text-decoration:line-through;color:var(--mu)}
  `;
  document.head.appendChild(st);

  /* ---------- Правила закрытия: подпункты и документ ---------- */
  const _dn = window.dn;
  window.dn = function (id) {
    const t = T(id); if (!t) return;
    if (t.st != 'rev' && t.st != 'done') {
      if ((t.sub || []).length && subDone(t) < t.sub.length) { toast('Сначала отметьте все подпункты: ' + subDone(t) + ' из ' + t.sub.length); tkCard(id); return; }
      if (ONL && needDoc(t)) { toast(boss() ? 'Нужен документ: загрузите файл или снимите требование «Документ не нужен»' : 'Нужен документ: загрузите файл к задаче (📎)'); tkCard(id); return; }
    }
    _dn(id);
    if (t.st == 'done' && t.rc) { delete t.rc; save(); }
  };

  /* Возврат с комментарием */
  const _bk = window.bk;
  window.bk = function (id) {
    const t = T(id); if (!t) return;
    modal(`<h3>Вернуть на доработку</h3><p><b>${E(t.t)}</b> · ${E(cn(t.cl))} · ${E(en(t.emp))}</p><textarea id="rc_t" rows="3" placeholder="Что исправить — исполнитель увидит это в задаче"></textarea><div id="rc_e"></div><div class="row"><button class="b r" id="rc_ok">Вернуть</button><button class="b" onclick="mx()">Отмена</button></div>`);
    document.getElementById('rc_ok').onclick = () => {
      const v = document.getElementById('rc_t').value.trim();
      if (v.length < 3) { document.getElementById('rc_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Напишите, что исправить (хотя бы несколько слов).</div>'; return; }
      t.rc = v.slice(0, 500); mx(); _bk(id); logA('комментарий к возврату «' + t.t + '»: ' + t.rc);
    };
  };

  /* ---------- Карточка задачи ---------- */
  let TC = null;
  window.tkCard = function (id) {
    const t = T(id); if (!t) return; TC = id;
    const b = bpOf(t), docs = typeof dList == 'function' ? dList(t.id) : [], st = t.st, ro = !canEdit(t);
    const stTxt = st == 'done' ? `<span class="tg ok">выполнена ${dRu(t.dd)}${t.fx ? ' · принудительно' : ''}</span>` : st == 'rev' ? '<span class="tg wa">на проверке</span>' : od(t) ? '<span class="tg er">просрочена</span>' : st == 'work' ? '<span class="tg">в работе</span>' : '<span class="tg">не начата</span>';
    const sub = (t.sub || []).map((s, i) => `<label class="${s.ok ? 'ok' : ''}"><input type="checkbox" ${s.ok ? 'checked' : ''} ${ro || st == 'done' || st == 'rev' ? 'disabled' : ''} onchange="tkSub(${t.id},${i},this.checked)"> <span>${E(s.n)}</span></label>`).join('');
    const act = [];
    if (st != 'done' && st != 'rev' && (t.emp == me() || boss())) act.push(`<button class="b ${t.run ? 'r' : 'p'}" onclick="tg(${t.id});tkCard(${t.id})">${t.run ? '⏸ Пауза' : t.sp > 1 ? '▶ Продолжить' : '▶ Старт'}</button><button class="b g" onclick="mx();dnc(${t.id})">${S.role == 'acc' ? '✓ Сдать на проверку' : '✓ Выполнено'}</button>`);
    if (st == 'rev' && boss()) act.push(`<button class="b g" onclick="mx();dnc(${t.id})">Принять</button><button class="b r" onclick="bk(${t.id})">Вернуть с комментарием</button>`);
    if (st != 'done' && boss()) { if (t.doc && !t.wv) act.push(`<button class="b" onclick="tkWaive(${t.id})">Документ не нужен</button>`); act.push(`<button class="b" onclick="tkForce(${t.id})">Закрыть принудительно</button>`); }
    if (st == 'done' && boss() && typeof reopen == 'function') act.push(`<button class="b" onclick="mx();reopen(${t.id})">↩ Отменить приёмку</button>`);
    if (boss()) act.push(`<button class="b r" onclick="mx();teD(${t.id})">Удалить</button>`);
    $('#md').innerHTML = `<div class="c cc2 tkc"><div class="hd"><div style="flex:1;min-width:0"><h2>${E(t.t)}</h2><div style="color:var(--mu);font-size:13px">${E(cn(t.cl))} · ${E(t.per || '')} · срок ${dRu(t.due)} · исполнитель ${E(en(t.emp))}${t.by ? ' · поручил: ' + E(t.by) : ''}</div></div>${stTxt}<button class="b" onclick="mx()" aria-label="Закрыть">✕</button></div><div class="bd2">
      ${t.rc && st != 'done' ? `<div class="tg wa" style="display:block;white-space:normal;padding:10px"><b>Вернули на доработку:</b> ${E(t.rc)}</div>` : ''}
      ${t.fx ? `<div class="tg" style="display:block;white-space:normal;padding:10px"><b>Закрыта принудительно:</b> ${E(t.fx)}</div>` : ''}
      <div class="sec"><div class="sb"><div class="kv"><span>Затрачено</span><b class="tm ${t.run ? 'run' : ''}" data-t="${t.id}">${fmt(spent(t))}</b></div><div class="kv"><span>План</span><b>${t.h ? t.h + ' ч' : '—'}</b></div><div class="kv"><span>Правила</span><b>${t.doc ? (t.wv ? 'документ не нужен (снято)' : 'нужен документ') : 'без документа'}${t.rev || S.role == 'acc' ? ' · с проверкой' : ''}</b></div>${t.q ? `<div class="kv"><span>Количество</span><b>${t.q}</b></div>` : ''}</div></div>
      ${b && b.d ? `<div class="sec"><div class="st">Что сделать</div><div class="sb"><div class="full" style="white-space:pre-wrap">${E(b.d)}</div></div></div>` : ''}
      ${sub ? `<div class="sec"><div class="st">Подпункты: ${subDone(t)} из ${t.sub.length}</div><div class="sb"><div class="full sub">${sub}</div></div></div>` : ''}
      <div class="sec"><div class="st">Документы${t.doc && !t.wv ? ' <span class="tg wa">обязательны для закрытия</span>' : ''}<div class="sp"><button class="b s" onclick="mx();dOpen(${t.id})">📎 Открыть / загрузить (${docs.length})</button></div></div><div class="sb"><div class="full">${docs.map((d) => `<div>📄 ${E(d.n)} <span style="color:var(--mu);font-size:12px">${E(d.by || d.lg || '')}</span></div>`).join('') || '<span style="color:var(--mu)">Не прикреплены</span>'}</div></div></div>
      <div class="sec"><div class="st">Заметка исполнителя</div><div class="sb"><textarea class="full" id="tk_nt" rows="3" placeholder="Нюансы по задаче — чтобы вспомнить позже" ${ro ? 'disabled' : ''} onblur="tkNote(${t.id})">${E(t.nt || '')}</textarea><span class="full" style="font-size:12px;color:var(--mu)">Сохраняется, когда вы выходите из поля</span></div></div>
      <div class="row">${act.join('')}</div></div></div>`;
    $('#md').className = 'on';
  };
  window.tkSub = function (id, i, v) { const t = T(id); if (!t || !canEdit(t) || !t.sub || !t.sub[i]) return; t.sub[i].ok = v ? 1 : 0; t.ut = Date.now(); save(); tkCard(id); go(); };
  window.tkNote = function (id) { const t = T(id), e = document.getElementById('tk_nt'); if (!t || !e || !canEdit(t)) return; const v = e.value.trim().slice(0, 1000); if ((t.nt || '') == v) return; if (v) t.nt = v; else delete t.nt; t.ut = Date.now(); save(); toast('Заметка сохранена'); };
  window.tkWaive = function (id) { const t = T(id); if (!t || !boss()) return; ask('Снять требование документа для «' + t.t + '»? Задачу можно будет закрыть без файла.', () => { t.wv = 1; t.ut = Date.now(); logA('снял требование документа: ' + t.t + ' · ' + cn(t.cl)); save(); toast('Требование документа снято'); tkCard(id); go(); }); };
  window.tkForce = function (id) {
    const t = T(id); if (!t || !boss()) return;
    modal(`<h3>Закрыть принудительно</h3><p><b>${E(t.t)}</b> · ${E(cn(t.cl))}. Задача закроется без документа и подпунктов. Причина попадёт в журнал и в задачу.</p><textarea id="fx_t" rows="3" placeholder="Причина (например: клиент сдал сам, работа не нужна в этом месяце)"></textarea><div id="fx_e"></div><div class="row"><button class="b r" id="fx_ok">Закрыть</button><button class="b" onclick="tkCard(${id})">Отмена</button></div>`);
    document.getElementById('fx_ok').onclick = () => {
      const v = document.getElementById('fx_t').value.trim();
      if (v.length < 3) { document.getElementById('fx_e').innerHTML = '<div class="tg er" style="display:block;padding:8px">Укажите причину.</div>'; return; }
      if (t.run) { t.sp += (Date.now() - t.run) / 1000; t.run = 0; }
      t.fx = v.slice(0, 300); t.st = 'done'; t.dd = TD(); t.ok = t.due >= TD(); t.ut = Date.now(); delete t.rc;
      logA('закрыл принудительно: ' + t.t + ' · ' + cn(t.cl) + ' — ' + t.fx); save(); mx(); toast('Задача закрыта'); go();
    };
  };

  /* ---------- Новая задача: своя или из каталога, по сотрудникам или по компаниям ---------- */
  window.tkForm = function () {
    if (!CL().length || !S.emps.length) { toast('Сначала добавьте сотрудников и клиентов'); return; }
    const L = CL(), cat = (S.bp || []).slice().sort((a, b) => a.n.localeCompare(b.n));
    const emps = S.emps.filter((e) => !e.off && (ME == null || e.r == 'acc' || e.id == ME));
    $('#md').innerHTML = `<div class="c cc2"><div class="hd"><h2 style="flex:1">Новая задача</h2><button class="b" onclick="mx()" aria-label="Закрыть">✕</button></div><div class="bd2">
      <div class="row"><label><input type="radio" name="nk_src" value="c" checked onchange="nkSrc()"> Своя задача</label><label><input type="radio" name="nk_src" value="k" onchange="nkSrc()" ${cat.length ? '' : 'disabled'}> Из каталога${cat.length ? '' : ' (каталог пуст)'}</label></div>
      <div id="nk_cat" style="display:none" class="kv"><span>Процесс из каталога</span><select id="nk_bp" onchange="nkPick()"><option value="">— выберите —</option>${cat.map((b) => `<option value="${b.id}">${E(b.n)}</option>`).join('')}</select></div>
      <div class="kv"><span>Название *</span><input id="nk_n" maxlength="300" placeholder="Например: Сверка с банком"></div>
      <div class="kv"><span>Уточнение (необязательно)</span><textarea id="nk_d" rows="2" placeholder="Что важно именно в этот раз"></textarea></div>
      <div class="row"><div class="kv"><span>Срок *</span><input id="nk_due" type="date" value="${iso(3)}"></div><label><input type="checkbox" id="nk_doc"> Документ обязателен для закрытия</label>${ME == null || S.role == 'chief' ? '<label><input type="checkbox" id="nk_rev"> Отправлять на проверку</label>' : ''}</div>
      <div class="row"><b>Кому:</b><label><input type="radio" name="nk_m" value="e" checked onchange="nkMode()"> по сотрудникам</label><label><input type="radio" name="nk_m" value="c" onchange="nkMode()"> по компаниям (каждой — её исполнителю)</label></div>
      <div id="nk_me" class="kv"><span>Сотрудник</span><select id="nk_emp">${emps.map((e) => `<option value="${e.id}" ${e.id == ME ? 'selected' : ''}>${E(e.n)}</option>`).join('')}</select><span>Компания (необязательно)</span><select id="nk_cl"><option value="">— без конкретной компании: первая из ваших —</option>${L.map((c) => `<option value="${c.id}">${E(c.n)}</option>`).join('')}</select></div>
      <div id="nk_mc" style="display:none"><div class="row"><input id="nk_cq" placeholder="🔎 Поиск компании" oninput="nkFilt(this.value)" style="flex:1"><button class="b s" onclick="nkAll(1)">Все</button><button class="b s" onclick="nkAll(0)">Никого</button><span id="nk_cnt" style="color:var(--mu)">выбрано 0</span></div><div id="nk_cls" style="max-height:240px;overflow:auto;border:1px solid var(--bd);border-radius:10px;padding:6px">${L.map((c) => `<label data-n="${E(c.n.toLowerCase())}" style="display:flex;gap:8px;padding:4px"><input type="checkbox" value="${c.id}" onchange="nkCnt()"> ${E(c.n)} <span style="color:var(--mu);font-size:12px;margin-left:auto">→ ${E(en(c.ex || c.ch))}</span></label>`).join('')}</div></div>
      <div id="nk_err"></div><div class="row"><button class="b p" onclick="nkGo()">Создать задачу</button><button class="b" onclick="mx()">Отмена</button></div></div></div>`;
    $('#md').className = 'on';
  };
  window.nkSrc = () => { const k = document.querySelector('[name=nk_src]:checked').value == 'k'; document.getElementById('nk_cat').style.display = k ? '' : 'none'; };
  window.nkPick = () => { const b = (S.bp || []).find((x) => x.id == document.getElementById('nk_bp').value); if (!b) return; document.getElementById('nk_n').value = b.n; document.getElementById('nk_doc').checked = !!b.doc; const r = document.getElementById('nk_rev'); if (r) r.checked = !!b.rev; };
  window.nkMode = () => { const c = document.querySelector('[name=nk_m]:checked').value == 'c'; document.getElementById('nk_me').style.display = c ? 'none' : ''; document.getElementById('nk_mc').style.display = c ? '' : 'none'; };
  window.nkFilt = (q) => { q = q.toLowerCase(); document.querySelectorAll('#nk_cls label').forEach((l) => { l.style.display = !q || l.dataset.n.includes(q) ? '' : 'none'; }); };
  window.nkAll = (v) => { document.querySelectorAll('#nk_cls label').forEach((l) => { if (l.style.display != 'none') l.querySelector('input').checked = !!v; }); nkCnt(); };
  window.nkCnt = () => { document.getElementById('nk_cnt').textContent = 'выбрано ' + document.querySelectorAll('#nk_cls input:checked').length; };
  window.nkGo = function () {
    const err = (m) => { document.getElementById('nk_err').innerHTML = `<div class="tg er" role="alert" style="display:block;white-space:normal;padding:8px">${E(m)}</div>`; };
    const n = document.getElementById('nk_n').value.trim(), d = document.getElementById('nk_d').value.trim(), due = document.getElementById('nk_due').value;
    const isCat = document.querySelector('[name=nk_src]:checked').value == 'k', b = isCat ? (S.bp || []).find((x) => x.id == document.getElementById('nk_bp').value) : null;
    const doc = document.getElementById('nk_doc').checked, rev = (document.getElementById('nk_rev') || {}).checked;
    if (isCat && !b) return err('Выберите процесс из каталога.');
    if (!n) return err('Укажите название задачи.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return err('Укажите срок.');
    if (due < iso(-31)) return err('Срок больше месяца назад — проверьте дату.');
    if (due > iso(730)) return err('Срок больше чем через 2 года — проверьте год.');
    let pairs = [], skipped = [];
    if (document.querySelector('[name=nk_m]:checked').value == 'c') {
      const ids = [...document.querySelectorAll('#nk_cls input:checked')].map((x) => +x.value);
      if (!ids.length) return err('Отметьте хотя бы одну компанию.');
      ids.forEach((id) => { const c = S.clients.find((x) => x.id == id); const e = c && (c.ex || c.ch); if (e) pairs.push([id, e]); else if (c) skipped.push(c.n); });
      if (!pairs.length) return err('У выбранных компаний не назначен исполнитель — назначьте его в карточке клиента.');
      if (ME != null && S.role == 'acc') pairs = pairs.filter((p) => p[1] == ME);
    } else {
      const e = +document.getElementById('nk_emp').value, cl = +document.getElementById('nk_cl').value || (CL()[0] || {}).id;
      if (!e) return err('Выберите сотрудника.'); if (!cl) return err('Нет компании для задачи.'); pairs = [[cl, e]];
    }
    if (pairs.length > 200) return err('Слишком много компаний за раз (больше 200).');
    const subs = b ? b.ch.map((s) => ({ n: s.slice(0, 200), ok: 0 })) : [];
    pairs.forEach(([cl, emp]) => {
      const t = { id: nid(S), cl, t: n.slice(0, 300), per: 'Разово', emp, due, st: 'new', sp: 0, run: 0, h: b && b.min ? Math.round(b.min / 6) / 10 : 1, by: emp != ME ? myName() : null, cr: TD() };
      if (b) t.bp = b.id; if (subs.length) t.sub = subs.map((s) => ({ ...s })); if (doc) t.doc = 1; if (rev) t.rev = 1; if (d) t.nt = d.slice(0, 1000);
      S.tasks.push(t);
    });
    logA('создал задачу «' + n + '»' + (pairs.length > 1 ? ' для ' + pairs.length + ' компаний' : ' · ' + cn(pairs[0][0])));
    mx(); save(); toast(pairs.length > 1 ? 'Создано задач: ' + pairs.length : 'Задача создана'); if (skipped.length) toast('Пропущены (нет исполнителя): ' + skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? ' и ещё ' + (skipped.length - 3) : '')); go();
  };

  /* ---------- Вкладки «Я поручил» и «Поручено мне» ---------- */
  const gave = () => S.tasks.filter((t) => t.by && t.emp != ME && (ME == null ? t.by == 'руководитель' : t.by == en(ME)) && (t.st != 'done' || (t.dd && t.dd >= iso(-30))));
  const tome = () => (ME == null ? [] : S.tasks.filter((t) => t.by && t.emp == ME && t.st != 'done'));
  window.tkUnassign = function (id) { const t = T(id); if (!t) return; if (t.st == 'done') { toast('Задача уже выполнена — отменить нельзя'); return; } ask('Отозвать поручение «' + t.t + '» у ' + en(t.emp) + '? Задача будет удалена.', () => { S.tasks = S.tasks.filter((x) => x.id != id); logA('отозвал поручение: ' + t.t + ' · ' + en(t.emp)); save(); toast('Поручение отозвано'); go(); }); };
  const _tk = V.tk;
  V.tk = function () {
    const g = gave(), m = tome();
    if (S.tf == 'gave' || S.tf == 'tome') {
      const L = (S.tf == 'gave' ? g : m).slice().sort((a, b) => (a.st == 'done') - (b.st == 'done') || (a.due < b.due ? -1 : 1));
      const sts = (t) => t.st == 'done' ? `<span class="tg ok">выполнена${t.fx ? ' (принуд.)' : ''}</span>` : t.st == 'rev' ? '<span class="tg wa">на проверке</span>' : od(t) ? '<span class="tg er">просрочена</span>' : t.st == 'work' ? 'в работе' : 'не начата';
      return `${MH()}<div class="row">${tabs(g, m)}</div><div class="c tw"><p style="color:var(--mu);margin-bottom:8px">${S.tf == 'gave' ? 'Задачи, которые вы поручили другим. Выполненные видны 30 дней.' : 'Задачи, которые вам поручили.'}</p><table><tr><th>Задача</th><th>Компания</th><th>${S.tf == 'gave' ? 'Исполнитель' : 'Поручил'}</th><th>Срок</th><th>Статус</th><th></th></tr>${L.map((t) => `<tr><td><b style="cursor:pointer" onclick="tkCard(${t.id})">${E(t.t)}</b>${badges(t)}</td><td>${E(cn(t.cl))}</td><td>${E(S.tf == 'gave' ? en(t.emp) : t.by)}</td><td>${dRu(t.due)}</td><td>${sts(t)}</td><td><button class="b s" onclick="tkCard(${t.id})">Открыть</button>${S.tf == 'gave' && t.st != 'done' ? ` <button class="b s r" onclick="tkUnassign(${t.id})">Отозвать</button>` : ''}</td></tr>`).join('') || '<tr><td colspan=6>Пока пусто</td></tr>'}</table></div>`;
    }
    let h = _tk.call(V);
    h = h.replace(/(<div class="row">)(<button class="b s [^"]*" onclick="S\.tf='all';go\(\)">)/, `$1${tabs(g, m)}$2`);
    return h;
  };
  const tabs = (g, m) => `${g.length || S.tf == 'gave' ? `<button class="b s ${S.tf == 'gave' ? 'p' : ''}" onclick="S.tf='gave';go()">Я поручил <span class="tg">${g.filter((t) => t.st != 'done').length}</span></button>` : ''}${m.length || S.tf == 'tome' ? `<button class="b s ${S.tf == 'tome' ? 'p' : ''}" onclick="S.tf='tome';go()">Поручено мне <span class="tg ${m.some((t) => t.cr >= iso(-2)) ? 'er' : ''}">${m.length}</span></button>` : ''}${S.tf == 'gave' || S.tf == 'tome' ? `<button class="b s" onclick="S.tf='all';go()">← Все задачи</button>` : ''}`;
  const badges = (t) => {
    const a = [];
    if ((t.sub || []).length) a.push(`<span class="tg ${subDone(t) == t.sub.length ? 'ok' : ''}" title="Подпункты">☑ ${subDone(t)}/${t.sub.length}</span>`);
    if (t.doc && !t.wv) a.push(`<span class="tg ${ONL && needDoc(t) ? 'wa' : 'ok'}" title="Для закрытия нужен документ">📎 ${ONL && needDoc(t) ? 'нужен документ' : 'документ есть'}</span>`);
    if (t.rc && t.st != 'done') a.push(`<span class="tg er" title="${E(t.rc)}">возвращена: ${E(t.rc.slice(0, 40))}${t.rc.length > 40 ? '…' : ''}</span>`);
    if (t.nt) a.push(`<span class="tg" title="${E(t.nt)}">✎ заметка</span>`);
    if (t.fx) a.push(`<span class="tg" title="${E(t.fx)}">закрыта принудительно</span>`);
    return a.length ? `<span class="tkb">${a.join('')}</span>` : '';
  };

  /* ---------- После каждой отрисовки: значки в строках задач, открытие карточки, плашка таймера ---------- */
  const _go = window.go;
  window.go = function () {
    _go.apply(this, arguments);
    try {
      document.querySelectorAll('#v td[data-t]').forEach((td) => {
        const tr = td.closest('tr'), id = +td.dataset.t, t = T(id); if (!tr || !t || tr.dataset.k) return;
        tr.dataset.k = 1; tr.ondblclick = () => tkCard(id); tr.title = 'Двойной щелчок — карточка задачи';
        const c0 = tr.cells[0]; if (c0) c0.insertAdjacentHTML('beforeend', badges(t));
        const last = tr.cells[tr.cells.length - 1]; if (last) last.insertAdjacentHTML('afterbegin', `<button class="b s" onclick="tkCard(${id})" title="Карточка задачи">☰</button> `);
      });
      tbar();
    } catch (e) { }
  };
  function tbar() {
    const tb = $('#tb'); if (!tb || !S) return;
    const R = S.tasks.filter((t) => t.run && (ME == null ? true : t.emp == ME)).slice(0, 2);
    let el = document.getElementById('tbar');
    if (!R.length) { if (el) el.remove(); return; }
    const h = R.map((t) => `<span class="run" title="${E(t.t)} · ${E(cn(t.cl))}"><span style="color:var(--ac)">●</span><b onclick="tkCard(${t.id})" style="cursor:pointer">${E(t.t)}</b><span class="tm run" data-t="${t.id}">${fmt(spent(t))}</span><button class="b s" onclick="tg(${t.id})" aria-label="Пауза">⏸</button><button class="b s g" onclick="dnc(${t.id})" aria-label="Выполнено">✓</button></span>`).join('');
    if (!el) { const h1 = tb.querySelector('h1'); if (!h1) return; h1.insertAdjacentHTML('afterend', '<div id="tbar"></div>'); el = document.getElementById('tbar'); h1.style.marginRight = '0'; }
    el.innerHTML = h;
  }

  /* таймер в карточке и плашке обновляется общим setInterval по [data-t] (из основного кода) */
  if (typeof S !== 'undefined' && S) { try { go(); } catch (e) { } }
})();
