// ════════════════════════════════════════
// PyBolt — Inline Ghost-Text Autocomplete
// engine/autocomplete.js
// ════════════════════════════════════════

window.PyBoltAutocomplete = (function () {

  const KEYWORDS = [
    'False','None','True','and','as','assert','async','await',
    'break','class','continue','def','del','elif','else','except',
    'finally','for','from','global','if','import','in','is',
    'lambda','nonlocal','not','or','pass','raise','return',
    'try','while','with','yield',
  ];

  const BUILTINS = [
    'abs','all','any','bin','bool','bytes','callable','chr',
    'dict','dir','divmod','enumerate','eval','exec',
    'filter','float','format','frozenset','getattr','globals',
    'hasattr','hash','hex','id','input','int','isinstance',
    'issubclass','iter','len','list','locals','map','max',
    'min','next','object','oct','open','ord','pow','print',
    'range','repr','reversed','round','set','setattr','slice','sorted',
    'staticmethod','str','sum','super','tuple','type','vars','zip',
  ];

  const SNIPPETS = [
    { t:'def',        i:'def ★():' },
    { t:'class',      i:'class ★:' },
    { t:'if',         i:'if ★:' },
    { t:'elif',       i:'elif ★:' },
    { t:'else',       i:'else:' },
    { t:'for',        i:'for ★ in :' },
    { t:'while',      i:'while ★:' },
    { t:'try',        i:'try:\n    ★\nexcept Exception as e:\n    pass' },
    { t:'import',     i:'import ★' },
    { t:'from',       i:'from ★ import ' },
    { t:'with',       i:'with ★ as f:' },
    { t:'lambda',     i:'lambda ★: ' },
    { t:'return',     i:'return ★' },
    { t:'print',      i:'print(★)' },
    { t:'input',      i:'input("★")' },
    { t:'range',      i:'range(★)' },
    { t:'len',        i:'len(★)' },
    { t:'enumerate',  i:'enumerate(★)' },
    { t:'isinstance', i:'isinstance(★, )' },
    { t:'list',       i:'list(★)' },
    { t:'dict',       i:'dict(★)' },
    { t:'set',        i:'set(★)' },
    { t:'tuple',      i:'tuple(★)' },
    { t:'sorted',     i:'sorted(★)' },
    { t:'filter',     i:'filter(★, )' },
    { t:'map',        i:'map(★, )' },
    { t:'zip',        i:'zip(★)' },
    { t:'open',       i:'open("★", "r")' },
    { t:'super',      i:'super().★' },
  ];

  const METHODS = [
    'append','extend','insert','remove','pop','clear','copy',
    'sort','reverse','index','count',
    'upper','lower','strip','lstrip','rstrip','split','join',
    'replace','find','startswith','endswith','format','encode',
    'decode','title','capitalize','isdigit','isalpha','isspace',
    'keys','values','items','get','update','setdefault',
    'add','discard','union','intersection','difference',
    'read','write','close','readline','readlines','flush',
  ];

  let cm            = null;
  let ghostDiv      = null;
  let ghostText     = '';
  let ghostSnip     = null;
  let debounceTimer = null;
  let ghostLine     = -1;
  let ghostCh       = -1;

  // ── Ghost overlay ─────────────────────

  function ensureGhostDiv() {
    if (ghostDiv && ghostDiv.parentNode) return;
    const wrapper = cm.getWrapperElement();
    // Must be relative so absolute child positions correctly
    const wStyle = window.getComputedStyle(wrapper).position;
    if (wStyle === 'static') wrapper.style.position = 'relative';

    ghostDiv = document.createElement('div');
    ghostDiv.id = 'pb-ghost-overlay';
    ghostDiv.style.cssText = [
      'position:absolute',
      'z-index:9999',
      'pointer-events:none',
      'user-select:none',
      'white-space:pre',
      'font-family:JetBrains Mono,monospace',
      'font-size:13.5px',
      'line-height:1.75',
      'color:rgba(205,214,244,0.38)',
      'letter-spacing:0',
      'display:none',
      'top:0',
      'left:0',
    ].join(';');
    wrapper.appendChild(ghostDiv);
  }

  function clearGhost() {
    if (ghostDiv) ghostDiv.style.display = 'none';
    ghostText = '';
    ghostSnip = null;
    ghostLine = -1;
    ghostCh   = -1;
  }

  function showGhost(text, snip) {
    clearGhost();
    if (!text) return;
    ensureGhostDiv();

    const cur     = cm.getCursor();
    // Use 'page' coords then subtract wrapper's bounding rect
    // This correctly accounts for CM's internal scroll offset
    const coords  = cm.cursorCoords(cur, 'page');
    const wRect   = cm.getWrapperElement().getBoundingClientRect();

    ghostText = text;
    ghostSnip = snip || null;
    ghostLine = cur.line;
    ghostCh   = cur.ch;

    ghostDiv.textContent   = text;
    ghostDiv.style.left    = (coords.left - wRect.left) + 'px';
    ghostDiv.style.top     = (coords.top  - wRect.top)  + 'px';
    ghostDiv.style.display = 'block';
  }

  // ── Variable scanner ──────────────────

  function extractUserVars() {
    const names = new Set();
    for (let i = 0; i < cm.lineCount(); i++) {
      const line = cm.getLine(i).trim();
      const a = line.match(/^([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*=(?!=)/);
      if (a) a[1].split(',').forEach(v => names.add(v.trim()));
      const f = line.match(/^for\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s+in\b/);
      if (f) f[1].split(',').forEach(v => names.add(v.trim()));
      const d = line.match(/^def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
      if (d) {
        names.add(d[1]);
        d[2].split(',').forEach(p => {
          const n = p.trim().split('=')[0].replace(/^\*+/, '').trim();
          if (n && /^[a-zA-Z_]/.test(n)) names.add(n);
        });
      }
      const c = line.match(/^class\s+([a-zA-Z_]\w*)/);
      if (c) names.add(c[1]);
    }
    return [...names];
  }

  // ── Context ───────────────────────────

  function getContext() {
    const cur    = cm.getCursor();
    const line   = cm.getLine(cur.line);
    const before = line.slice(0, cur.ch);

    // String literal check
    let inStr = false, strChar = '';
    for (const ch of before) {
      if (!inStr && (ch === '"' || ch === "'")) { inStr = true; strChar = ch; }
      else if (inStr && ch === strChar) { inStr = false; strChar = ''; }
    }
    if (inStr) return { mode: 'none', word: '' };

    // Method
    const dotM = before.match(/([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/);
    if (dotM) return { mode: 'method', word: dotM[2] };

    // Word
    const wordM = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    return { mode: 'word', word: wordM ? wordM[0] : '' };
  }

  // ── Suggestion ────────────────────────

  function suggestWord(word) {
    if (word.length < 1) return null;
    const low  = word.toLowerCase();
    const vars = extractUserVars();
    const all  = [...new Set([...KEYWORDS, ...BUILTINS, ...SNIPPETS.map(s => s.t), ...vars])];
    const match =
      all.find(w => w.startsWith(word)              && w.length > word.length) ||
      all.find(w => w.toLowerCase().startsWith(low) && w.length > word.length);
    if (!match) return null;
    return { suffix: match.slice(word.length), snip: SNIPPETS.find(s => s.t === match) || null };
  }

  function suggestMethod(partial) {
    const low   = partial.toLowerCase();
    const match = partial.length === 0
      ? METHODS[0]
      : METHODS.find(m => m.toLowerCase().startsWith(low) && m.length > partial.length);
    if (!match) return null;
    return { suffix: match.slice(partial.length), snip: null };
  }

  // ── Accept ────────────────────────────

  function acceptGhost() {
    if (!ghostText && !ghostSnip) return false;
    const savedText = ghostText;
    const savedSnip = ghostSnip;
    clearGhost();
    const cur = cm.getCursor();

    if (savedSnip) {
      const before    = cm.getLine(cur.line).slice(0, cur.ch);
      const m         = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
      const wordStart = m ? cur.ch - m[0].length : cur.ch;
      const from      = { line: cur.line, ch: wordStart };
      const raw       = savedSnip.i;
      const text      = raw.replace('★', '');
      cm.replaceRange(text, from, cur);
      if (raw.includes('★')) {
        const bs      = raw.slice(0, raw.indexOf('★'));
        const bsLines = bs.split('\n');
        cm.setCursor({
          line: from.line + bsLines.length - 1,
          ch:   bsLines.length === 1
            ? wordStart + bsLines[0].length
            : bsLines[bsLines.length - 1].length,
        });
      }
    } else {
      cm.replaceRange(savedText, cur, cur);
    }
    cm.focus();
    return true;
  }

  // ── Trigger ───────────────────────────

  function trigger() {
    if (window.ideSettings?.autocomplete === false) { clearGhost(); return; }
    const ctx = getContext();
    if (ctx.mode === 'none') { clearGhost(); return; }
    if (ctx.mode === 'method') {
      const r = suggestMethod(ctx.word);
      if (!r) { clearGhost(); return; }
      showGhost(r.suffix, null);
      return;
    }
    if (!ctx.word) { clearGhost(); return; }
    const r = suggestWord(ctx.word);
    if (!r) { clearGhost(); return; }
    showGhost(r.suffix, r.snip);
  }

  // ── Attach ────────────────────────────

  function attach(editor) {
    cm = editor;

    // Pre-create the ghost div immediately at attach time
    ensureGhostDiv();

    cm.addKeyMap({
      'Tab': function (instance) {
        if (ghostText || ghostSnip) { acceptGhost(); return; }
        if (instance.somethingSelected()) instance.indentSelection('add');
        else instance.replaceSelection('    ', 'end');
      },
      'Escape': function () {
        if (ghostText || ghostSnip) { clearGhost(); return; }
        return CodeMirror.Pass;
      },
      'Enter': function () {
        clearGhost();
        return CodeMirror.Pass;
      },
    });

    // Use both 'change' and 'changes' to be safe
    cm.on('change', (instance, change) => {
      const o = change.origin;
      if (!o || o === 'setValue' || o === 'undo' || o === 'redo') {
        clearGhost(); return;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(trigger, 120);
    });

    cm.on('cursorActivity', () => {
      if (ghostLine === -1) return;
      const cur = cm.getCursor();
      if (cur.line !== ghostLine || cur.ch !== ghostCh) clearGhost();
    });

    cm.on('scroll', () => {
      if (!ghostDiv || ghostDiv.style.display === 'none') return;
      const coords = cm.cursorCoords({ line: ghostLine, ch: ghostCh }, 'page');
      const wRect  = cm.getWrapperElement().getBoundingClientRect();
      ghostDiv.style.left = (coords.left - wRect.left) + 'px';
      ghostDiv.style.top  = (coords.top  - wRect.top)  + 'px';
    });

    cm.on('blur', clearGhost);
  }

  return { attach, clearGhost };

})();
