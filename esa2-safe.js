/* ESA Control 2.0 · Этап 6: сейф паролей клиентов и ограничения роли «Проверяющий».
   Сейф: пароли ИТС, ЭЦП, Тундук ЕСИ, интернет-банкинга и поле «Доступы / инструкции» шифруются прямо в браузере
   (AES-GCM 256, ключ из пароля сейфа через PBKDF2-SHA-256, 250 000 повторов). На сервер уходит только шифр.
   Пароль сейфа нигде не хранится: в настройках фирмы (S.vault) лежат соль и проверочная строка. Забыли пароль — пароли не восстановить.
   Подключается последним, после esa2-admin.js. */
(function () {
  'use strict';
  const PFX = 'enc1:', IT = 250000, CHECK = 'ESA-VAULT-OK';
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
  const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const own = () => ME == null && S && S.role == 'admin';
  let VK = null; // ключ в памяти, только до перезагрузки страницы
  const CACHE = new Map(); // шифр -> открытый текст
  let AFTER = null;

  const isEnc = (v) => typeof v == 'string' && v.startsWith(PFX);
  async function derive(pass, salt, it) {
    const k = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: it || IT, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function enc(key, s) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(String(s))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return PFX + b64(out);
  }
  async function dec(key, v) {
    const u = ub64(v.slice(PFX.length));
    return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, key, u.subarray(12)));
  }

  /* Где лежат секреты в карточке клиента */
  function slots(c) {
    const L = [];
    if (c.its && c.its.pass) L.push([c.its, 'pass']);
    if (c.eds) { if (c.eds.pass) L.push([c.eds, 'pass']); if (c.eds.esip) L.push([c.eds, 'esip']); }
    (c.banks || []).forEach((b) => { if (b && b.p) L.push([b, 'p']); });
    if (c.acc) L.push([c, 'acc']);
    return L;
  }
  const allClients = () => S.clients.concat((S.trash || []).map((r) => r && r.c).filter(Boolean));

  async function encClient(c, key) {
    key = key || VK; if (!key) throw Error('сейф закрыт');
    for (const [o, f] of slots(c)) { if (!isEnc(o[f])) { const p = String(o[f]); o[f] = await enc(key, p); CACHE.set(o[f], p); } }
  }
  async function warm() { // расшифровать всё, что видно, в память
    if (!VK) return 0; let bad = 0;
    for (const c of allClients()) for (const [o, f] of slots(c)) if (isEnc(o[f]) && !CACHE.has(o[f])) { try { CACHE.set(o[f], await dec(VK, o[f])); } catch (e) { bad++; } }
    return bad;
  }
  let pend = false;
  const pv = (v) => {
    if (!isEnc(v)) return v;
    if (CACHE.has(v)) return CACHE.get(v);
    if (VK && !pend) { pend = true; warm().then(() => { pend = false; if (window.ccRender) ccRender(); }); }
    return null;
  };

  async function unlock(pass) {
    const V = S.vault; if (!V) return false;
    const key = await derive(pass, ub64(V.s), V.it);
    try { if ((await dec(key, V.c)) !== CHECK) return false; } catch (e) { return false; }
    VK = key; await warm(); return true;
  }

  const err = (m) => { const e = document.getElementById('vl_err'); if (e) e.innerHTML = `<div class="tg er" style="display:block;white-space:normal;padding:8px;margin:6px 0">${E(m)}</div>`; };
  const busy = (on) => { document.querySelectorAll('#md button').forEach((b) => { b.disabled = !!on; }); };

  window.VLT = {
    isEnc, pv, encClient: (c) => encClient(c),
    on: () => !!(S && S.vault),
    open: () => !!VK,
    ask(after) {
      if (!own()) { toast('Сейф открывает только руководитель'); return; }
      if (!S.vault) { toast('Сейф не включён — включите его в Настройках'); return; }
      if (VK) { after && after(); return; }
      AFTER = after || null;
      modal(`<h3>🔒 Сейф паролей клиентов</h3><p style="color:var(--mu);font-size:13px">Введите пароль сейфа. Он нужен, чтобы увидеть или изменить пароли клиентов. Сейф закроется при выходе или перезагрузке страницы.</p><div id="vl_err"></div>
        <div class="kv"><span>Пароль сейфа</span><input id="vl_p" type="password" autocomplete="off" onkeydown="if(event.key=='Enter')vlGo()"></div>
        <div class="row"><button class="b p" onclick="vlGo()">Открыть</button><button class="b" onclick="mx()">Отмена</button></div>`);
      setTimeout(() => { const i = document.getElementById('vl_p'); if (i) i.focus(); }, 30);
    },
  };
  window.vlGo = async function () {
    const p = (document.getElementById('vl_p') || {}).value || '';
    if (!p) return err('Введите пароль сейфа.');
    busy(1);
    let ok = false; try { ok = await unlock(p); } catch (e) { busy(0); return err('Не удалось открыть сейф: ' + e.message); }
    busy(0);
    if (!ok) return err('Неверный пароль сейфа.');
    mx(); toast('Сейф открыт'); const a = AFTER; AFTER = null; if (a) a(); else go();
  };
  window.vlLock = function () { VK = null; CACHE.clear(); toast('Сейф закрыт'); go(); };

  function passForm(title, note, btn, fn, withOld) {
    modal(`<h3>${title}</h3><p style="color:var(--mu);font-size:13px">${note}</p><div id="vl_err"></div>
      ${withOld ? '<div class="kv"><span>Текущий пароль сейфа</span><input id="vl_o" type="password" autocomplete="off"></div>' : ''}
      <div class="kv"><span>Новый пароль сейфа (от 8 знаков)</span><input id="vl_n1" type="password" autocomplete="new-password"></div>
      <div class="kv"><span>Повторите пароль</span><input id="vl_n2" type="password" autocomplete="new-password"></div>
      <div class="row"><button class="b p" onclick="${fn}()">${btn}</button><button class="b" onclick="mx()">Отмена</button></div>`);
  }
  const newPass = () => {
    const a = document.getElementById('vl_n1').value, b = document.getElementById('vl_n2').value;
    if (a.length < 8) { err('Пароль сейфа — не короче 8 знаков.'); return null; }
    if (a.length > 128) { err('Слишком длинный пароль (больше 128 знаков).'); return null; }
    if (a !== b) { err('Пароли не совпадают.'); return null; }
    if (LG && a === LG) { err('Пароль сейфа не должен совпадать с логином.'); return null; }
    return a;
  };
  async function makeVault(pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pass, salt, IT);
    return { key, v: { v: 1, s: b64(salt), it: IT, c: await enc(key, CHECK), at: new Date().toISOString(), by: LG || 'руководитель' } };
  }
  // перешифровать все секреты новым ключом (старые значения берём из памяти)
  async function rekey(key) {
    let n = 0;
    for (const c of allClients()) for (const [o, f] of slots(c)) {
      const p = isEnc(o[f]) ? CACHE.get(o[f]) : String(o[f]);
      if (p == null) throw Error('не все пароли удалось расшифровать — изменение отменено');
      o[f] = key ? await enc(key, p) : p; if (key) CACHE.set(o[f], p); n++;
    }
    return n;
  }
  const snap = () => JSON.stringify({ c: S.clients, t: S.trash || [], v: S.vault || null });
  const restore = (j) => { const o = JSON.parse(j); S.clients.splice(0, S.clients.length, ...o.c); S.trash = o.t; S.vault = o.v; };

  window.vlSetup = function () {
    if (!own()) return;
    passForm('Включить сейф паролей', 'Все пароли клиентов (ИТС, ЭЦП, Тундук ЕСИ, банки) и поле «Доступы» будут зашифрованы. Сотрудники и сервер увидят только шифр. <b>Запомните пароль сейфа: если его забыть, пароли клиентов восстановить нельзя.</b>', 'Включить и зашифровать', 'vlSetupGo');
  };
  window.vlSetupGo = async function () {
    if (S.vault) { mx(); return; }
    const p = newPass(); if (!p) return;
    busy(1); const bak = snap();
    try {
      const { key, v } = await makeVault(p); let n = 0;
      for (const c of allClients()) { const k = slots(c).filter(([o, f]) => !isEnc(o[f])).length; await encClient(c, key); n += k; }
      S.vault = v; VK = key;
      logA('включил сейф паролей клиентов (зашифровано: ' + n + ')'); save(); mx(); toast('Сейф включён. Зашифровано паролей: ' + n); go();
    } catch (e) { restore(bak); busy(0); err('Не получилось: ' + e.message + '. Ничего не изменено.'); }
  };
  window.vlChange = function () {
    if (!VK) { VLT.ask(vlChange); return; }
    passForm('Сменить пароль сейфа', 'Все пароли клиентов будут перешифрованы новым паролем.', 'Сменить', 'vlChangeGo', true);
  };
  window.vlChangeGo = async function () {
    const o = document.getElementById('vl_o').value; const p = newPass(); if (!p) return;
    busy(1); const bak = snap();
    try {
      const k0 = await derive(o, ub64(S.vault.s), S.vault.it); let ok = false; try { ok = (await dec(k0, S.vault.c)) === CHECK; } catch (e) { }
      if (!ok) { busy(0); return err('Текущий пароль сейфа неверный.'); }
      await warm(); const { key, v } = await makeVault(p); const n = await rekey(key);
      S.vault = v; VK = key; logA('сменил пароль сейфа (перешифровано: ' + n + ')'); save(); mx(); toast('Пароль сейфа изменён'); go();
    } catch (e) { restore(bak); busy(0); err('Не получилось: ' + e.message + '. Ничего не изменено.'); }
  };
  window.vlOff = function () {
    if (!VK) { VLT.ask(vlOff); return; }
    ask('Выключить сейф? Пароли клиентов снова будут храниться открытым текстом и станут видны в данных сотрудникам, которым доступен клиент.', async () => {
      const bak = snap();
      try { await warm(); const n = await rekey(null); S.vault = null; VK = null; CACHE.clear(); logA('выключил сейф паролей (расшифровано: ' + n + ')'); save(); toast('Сейф выключен'); go(); }
      catch (e) { restore(bak); toast('Не получилось: ' + e.message + '. Ничего не изменено.'); }
    });
  };
  window.vlFix = async function () { // дошифровать пароли, добавленные старой версией сайта
    if (!VK) { VLT.ask(vlFix); return; }
    let n = 0; for (const c of allClients()) { n += slots(c).filter(([o, f]) => !isEnc(o[f])).length; await encClient(c); }
    if (n) { logA('дошифровал открытые пароли клиентов: ' + n); save(); }
    toast(n ? 'Зашифровано: ' + n : 'Открытых паролей нет'); go();
  };

  /* ---------- Карточка в Настройках ---------- */
  const _set = V.set;
  V.set = function () {
    const h = _set.call(V);
    if (!own()) return h;
    let total = 0, open = 0, bad = 0;
    allClients().forEach((c) => slots(c).forEach(([o, f]) => { total++; if (!isEnc(o[f])) open++; else if (VK && !CACHE.has(o[f])) bad++; }));
    const sec = typeof crypto != 'undefined' && crypto.subtle;
    const card = `<div class="c"><h3>🔒 Сейф паролей клиентов</h3>${!sec ? '<p class="tg er">Шифрование недоступно: откройте сайт по https.</p>' : S.vault
      ? `<p>Сейф <b>включён</b>${S.vault.at ? ' с ' + new Date(S.vault.at).toLocaleDateString('ru-RU') : ''} · сейчас <b>${VK ? 'открыт' : 'закрыт'}</b>. Паролей в карточках: ${total}${open ? `, <span class="tg wa">не зашифровано: ${open}</span>` : ''}${bad ? `, <span class="tg er">не расшифровываются: ${bad}</span>` : ''}.</p>
         <div class="row">${VK ? '<button class="b" onclick="vlLock()">Закрыть сейф</button>' : '<button class="b p" onclick="VLT.ask()">Открыть сейф</button>'}${open ? '<button class="b p" onclick="vlFix()">Зашифровать открытые</button>' : ''}<button class="b" onclick="vlChange()">Сменить пароль сейфа</button><button class="b r" onclick="vlOff()">Выключить сейф</button></div>`
      : `<p style="color:var(--mu);font-size:13px">Сейчас пароли клиентов хранятся открытым текстом (паролей в карточках: ${total}). Карточка клиента скрывает их от сотрудников на экране, но в данных они есть. Сейф шифрует их паролем, который знает только руководитель.</p><div class="row"><button class="b p" onclick="vlSetup()">Включить сейф</button></div>`}</div>`;
    return h.replace('<div class="gr g2">', '<div class="gr g2">' + card);
  };

  /* ---------- Проверяющий: чужие задачи только смотреть ---------- */
  const AUD = () => S && S.rr == 'aud';
  ['bk', 'dl', 'dnc', 'dn', 'pr', 'tg', 'tkForce', 'tkSub', 'tkUnassign', 'tkWaive', 'ans', 'dUp', 'reopen', 'te', 'tkNote'].forEach((f) => {
    const o = window[f]; if (typeof o != 'function') return;
    window[f] = function (id) {
      if (AUD()) { const t = S.tasks.find((x) => x.id == id); if (!t || t.emp != ME) { toast('Проверяющий может только смотреть чужие задачи'); return; } }
      return o.apply(this, arguments);
    };
  });
  if (typeof window.tkForm == 'function') { const o = window.tkForm; window.tkForm = function () { if (AUD()) { toast('Проверяющий не создаёт задачи'); return; } return o.apply(this, arguments); }; }

  if (typeof S !== 'undefined' && S) { try { go(); } catch (e) { } }
})();
