// app.js — client-side search + "which law applies" wizard. No dependencies.
(function () {
  var SOURCES = null;
  var DATA = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function srcLinks(keys) {
    if (!SOURCES) return '';
    return keys.map(function (k) {
      var s = SOURCES[k];
      return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>' : esc(k);
    }).join(', ');
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function haystack(r, kind) {
    var extra = kind === 'code' ? ' tds payment code challan' : kind === 'form' ? ' form' : ' section';
    return [r.old, r.new, r.topic, r.purpose, r.nature, r.code, r.notes, r.keywords, extra].join(' ');
  }
  var STOP = { on: 1, the: 1, of: 1, for: 1, to: 1, a: 1, an: 1, in: 1, and: 1, under: 1, what: 1, is: 1, new: 1, old: 1 };

  function matches(q, r, kind) {
    var hay = norm(haystack(r, kind));
    if (hay.indexOf(norm(q)) !== -1) return true;
    var tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return t && !STOP[t]; });
    if (!tokens.length) return false;
    return tokens.every(function (t) { return hay.indexOf(t) !== -1; });
  }

  function searchAll(q) {
    var out = { sections: [], forms: [], codes: [] };
    if (!q.trim()) return out;
    DATA.sections.forEach(function (r) { if (matches(q, r, 'section')) out.sections.push(r); });
    DATA.forms.forEach(function (r) { if (matches(q, r, 'form')) out.forms.push(r); });
    DATA.tds_codes.forEach(function (r) { if (matches(q, r, 'code')) out.codes.push(r); });
    DATA.tds_codes_single_source.forEach(function (r) { if (matches(q, r, 'code')) out.codes.push(r); });
    return out;
  }

  function renderResults(q, el) {
    var res = searchAll(q);
    var total = res.sections.length + res.forms.length + res.codes.length;
    if (!q) { el.innerHTML = ''; return; }
    if (!total) {
      el.innerHTML = '<p>No verified mapping found for “' + esc(q) + '”. Try an old section number (e.g. 80C, 194J), a topic (“TDS on rent”), or a code (e.g. 1023). Some mappings were left out because they could not be verified twice — see the <a href="/sources/">Sources page</a>.</p>';
      return;
    }
    var html = '<p><strong>' + total + ' result' + (total === 1 ? '' : 's') + '</strong> for “' + esc(q) + '”</p>';
    res.sections.forEach(function (r) {
      html += '<article class="result"><h3>Section ' + esc(r.old) + ' <span class="arrow">→</span> Section ' + esc(r.new) + '</h3><p>' + esc(r.topic) + (r.notes ? '<br><span class="note">' + esc(r.notes) + '</span>' : '') + '</p><p class="src">Sources: ' + srcLinks(r.sources) + '</p></article>';
    });
    res.forms.forEach(function (r) {
      html += '<article class="result"><h3>' + esc(r.old) + ' <span class="arrow">→</span> ' + esc(r.new) + '</h3><p>' + esc(r.purpose) + (r.notes ? '<br><span class="note">' + esc(r.notes) + '</span>' : '') + '</p><p class="src">Sources: ' + srcLinks(r.sources) + '</p></article>';
    });
    res.codes.forEach(function (r) {
      var warn = r.status === 'single-source' ? ' <span class="badge">single source — verify</span>' : '';
      html += '<article class="result"><h3>TDS code ' + esc(r.code) + ' — old Section ' + esc(r.old) + ' <span class="arrow">→</span> ' + esc(r.new) + warn + '</h3><p>' + esc(r.nature) + '<br>Rate: <strong>' + esc(r.rate) + '</strong> · Threshold: ' + esc(r.threshold) + '</p><p class="src">Sources: ' + srcLinks(r.sources) + '</p></article>';
    });
    el.innerHTML = html;
  }

  function initSearch() {
    var input = document.getElementById('q');
    var results = document.getElementById('results');
    if (!input || !results) return;
    input.addEventListener('input', function () { renderResults(input.value.trim(), results); });
    document.querySelectorAll('.hint button[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = b.getAttribute('data-q');
        renderResults(input.value, results);
        input.focus();
      });
    });
    var preset = new URLSearchParams(location.search).get('q');
    if (preset) { input.value = preset; renderResults(preset, results); }
  }

  function initWizard() {
    var form = document.getElementById('wizard');
    if (!form) return;
    var tdsExtra = document.getElementById('tds-extra');
    form.addEventListener('change', function () {
      var what = form.querySelector('input[name="what"]:checked');
      tdsExtra.hidden = !(what && what.value === 'tds');
    });
    document.getElementById('wizard-go').addEventListener('click', function () {
      var what = form.querySelector('input[name="what"]:checked');
      var year = form.querySelector('input[name="year"]:checked');
      var out = document.getElementById('wizard-result');
      if (!what || !year) { out.innerHTML = '<p>Please answer questions 1 and 2 first.</p>'; return; }
      var oldAct = 'The <strong>Income-tax Act, 1961</strong> applies — use the OLD section and form numbers.';
      var newAct = 'The <strong>Income-tax Act, 2025</strong> applies — use the NEW section and form numbers.';
      var title, body;
      if (what.value === 'notice') {
        if (year.value === 'fy25') { title = oldAct; body = 'Notices, assessments and appeals for years before 1 April 2026 continue under the 1961 Act (transition, Section 536 of the 2025 Act). The case is argued and decided under the old law, even though the hearing happens after the new Act took effect.'; }
        else { title = newAct; body = 'A notice or assessment for Tax Year 2026-27 (income from 1 April 2026 onward) is under the 2025 Act, with the new section numbers.'; }
      } else if (what.value === 'tds') {
        var d = form.querySelector('input[name="tdsdate"]:checked');
        if (!d) { out.innerHTML = '<p>For TDS, please also answer question 3 — which date came first, payment or credit.</p>'; return; }
        if (d.value === 'before') { title = oldAct; body = 'TDS is governed by the earlier of the payment date or the credit date. If either fell on or before 31 March 2026, the 1961 Act applies. Example: salary credited on 31 March 2026 but paid on 5 April 2026 is still under the 1961 Act, Section 192.'; }
        else { title = newAct; body = 'Both the payment and the credit fell on or after 1 April 2026, so the 2025 Act applies — use the new section (e.g. salary is Section 392, other payments are Section 393) and the new payment codes.'; }
      } else if (what.value === 'adv') {
        if (year.value === 'fy25') { title = oldAct; body = 'Advance tax for FY 2025-26 was payable under the 1961 Act. Interest for any shortfall or deferment is computed under the old sections (234B/234C).'; }
        else { title = newAct; body = 'Advance tax for Tax Year 2026-27 is payable under the 2025 Act. The interest provisions are now Sections 423–425 (old 234A/234B/234C).'; }
      } else {
        if (year.value === 'fy25') { title = oldAct; body = 'Returns for FY 2025-26 (assessment year 2026-27) are filed under the 1961 Act — old sections (e.g. 80C, 139, 192) and old forms (e.g. Form 16).'; }
        else { title = newAct; body = 'Income from 1 April 2026 onward (Tax Year 2026-27) is under the 2025 Act — new sections (e.g. 80C is now 123, 139 is now 263, 192 is now 392) and new forms (e.g. Form 16 is now Form 130).'; }
      }
      out.innerHTML = '<div class="answer"><h3>' + title + '</h3><p>' + body + '</p><p class="small">This is general information, not tax advice. If the facts are unusual (e.g. a mixed-year payment), check with your CA.</p></div>';
    });
  }

  fetch('/data.json').then(function (r) { return r.json(); }).then(function (d) {
    DATA = d; SOURCES = d.meta.sources;
    initSearch(); initWizard();
  }).catch(function () {
    var el = document.getElementById('results');
    if (el) el.innerHTML = '<p>Search data could not be loaded. You can still browse the <a href="/cheatsheet/">cheat sheet</a> and the <a href="/tds/">TDS code finder</a>.</p>';
  });
})();
