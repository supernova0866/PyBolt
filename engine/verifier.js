// ════════════════════════════════════════
// PyBolt — Pre-run Python Verifier
// engine/verifier.js
//
// Runs before Brython executes. Catches common
// mistakes instantly with human-readable messages.
// Returns: { ok: true } or { ok: false, message, line }
// ════════════════════════════════════════

window.PyBoltVerifier = (function(){

  // ── Helpers ──────────────────────────────────────
  function lines(src){ return src.split('\n'); }

  function stripStrings(s){
    return s
      .replace(/"""[\s\S]*?"""/g, '""')
      .replace(/'''[\s\S]*?'''/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  }

  function stripInlineComment(line){
    return stripStrings(line).replace(/#.*$/, '');
  }

  function isBlank(line){
    return line.trim() === '' || line.trim().startsWith('#');
  }

  // ── Rules ─────────────────────────────────────────
  const rules = [

    // Wrong-case builtins
    {
      name: 'wrong_case_builtin',
      check(line, no){
        const s = stripInlineComment(line);
        const cases = {
          'Print':  'print',  'INPUT': 'input',   'Input': 'input',
          'TRUE':   'True',   'FALSE': 'False',    'NONE':  'None',
          'LEN':    'len',    'Len':   'len',      'RANGE': 'range',
          'Range':  'range',  'TYPE':  'type',     'Type':  'type',
          'INT':    'int',    'Float': 'float',    'Str':   'str',
          'List':   'list',   'Dict':  'dict',     'Tuple': 'tuple',
          'Set':    'set',    'FLOAT': 'float',    'STR':   'str',
          'LIST':   'list',   'DICT':  'dict',
        };
        for(const [wrong, correct] of Object.entries(cases)){
          // Must be a standalone word (not part of a longer identifier)
          const re = new RegExp(`(?<![\\w.])${wrong}(?![\\w])`, '');
          if(re.test(s)){
            return `NameError on line ${no}: "${wrong}" is not defined — did you mean "${correct}"?`;
          }
        }
        return null;
      }
    },

    // Assignment to a number literal
    {
      name: 'assign_to_number',
      check(line, no){
        const s = stripInlineComment(line).trim();
        const m = s.match(/^(\d[\d.]*)\s*(?<![=!<>])=(?!=)/);
        if(m){
          return `SyntaxError on line ${no}: cannot assign to literal "${m[1]}" — did you mean "==" for comparison?`;
        }
        return null;
      }
    },

    // Assignment to a string literal
    {
      name: 'assign_to_string',
      check(line, no){
        const s = stripInlineComment(line).trim();
        if(/^(["']).*\1\s*(?<![=!<>])=(?!=)/.test(s)){
          return `SyntaxError on line ${no}: cannot assign to a string literal`;
        }
        return null;
      }
    },

    // print without parens (Python 2 style): print "hello"
    {
      name: 'print_no_parens',
      check(line, no){
        const s = stripInlineComment(line);
        const m = s.match(/^\s*print\s+([^({\s].*)/);
        if(m){
          const arg = m[1].trim();
          return `SyntaxError on line ${no}: missing parentheses — did you mean: print(${arg})?`;
        }
        return null;
      }
    },

    // Missing colon on block statement: if x > 0, def foo(), for x in y
    {
      name: 'missing_colon',
      check(line, no){
        const s = stripInlineComment(line).trimEnd();
        const m = s.match(/^(\s*)(if|elif|else|for|while|def|class|try|except|finally|with)\b/);
        if(!m) return null;
        if(!/:\s*$/.test(s) && !/\\\s*$/.test(s)){
          return `SyntaxError on line ${no}: missing ":" at the end of "${m[2]}" statement`;
        }
        return null;
      }
    },

    // Single = in if/while condition: if x = 5
    {
      name: 'assign_in_condition',
      check(line, no){
        const s = stripInlineComment(line);
        const m = s.match(/^\s*(if|elif|while)\s+(.*)/);
        if(!m) return null;
        const cond = stripStrings(m[2]);
        // Single = not part of ==, !=, <=, >=, :=
        if(/(?<![=!<>:])=(?!=)/.test(cond)){
          return `SyntaxError on line ${no}: did you mean "==" instead of "=" in the condition?`;
        }
        return null;
      }
    },

    // Mismatched/unclosed quotes on a single line
    {
      name: 'mismatched_quotes',
      check(line, no){
        const s = stripInlineComment(line);
        // After stripping valid strings, leftover quotes are unmatched
        let temp = s;
        temp = temp.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, '');
        temp = temp.replace(/"(?:[^"\\]|\\.)*"/g, '');
        temp = temp.replace(/'(?:[^'\\]|\\.)*'/g, '');
        const hasD = (temp.match(/"/g) || []).length % 2 !== 0;
        const hasS = (temp.match(/(?<![a-zA-Z])'/g) || []).length % 2 !== 0;
        if(hasD) return `SyntaxError on line ${no}: unmatched double quote (")`;
        if(hasS) return `SyntaxError on line ${no}: unmatched single quote (')`;
        return null;
      }
    },

    // Mixed tabs and spaces in indentation
    {
      name: 'mixed_indent',
      check(line, no){
        if(/^\t+ /.test(line) || /^ +\t/.test(line)){
          return `IndentationError on line ${no}: mixed tabs and spaces — use spaces only`;
        }
        return null;
      }
    },

    // More closing brackets than opening on a single line
    {
      name: 'extra_closing_bracket',
      check(line, no){
        const s = stripStrings(stripInlineComment(line));
        const opens  = (s.match(/[\(\[\{]/g) || []).length;
        const closes = (s.match(/[\)\]\}]/g) || []).length;
        if(closes > opens){
          const n = closes - opens;
          return `SyntaxError on line ${no}: ${n} unexpected closing bracket${n > 1 ? 's' : ''}`;
        }
        return null;
      }
    },

    // exec without parens (Python 2 style)
    {
      name: 'exec_no_parens',
      check(line, no){
        const s = stripInlineComment(line);
        if(/^\s*exec\s+[^(]/.test(s)){
          return `SyntaxError on line ${no}: "exec" requires parentheses in Python 3 — use exec(...)`;
        }
        return null;
      }
    },

  ];

  // ── Main verify function ──────────────────────────
  function verifyPython(src){
    const ls = lines(src);
    for(let i = 0; i < ls.length; i++){
      const lineNo = i + 1;
      const line   = ls[i];
      if(isBlank(line)) continue;
      for(const rule of rules){
        const result = rule.check(line, lineNo, ls);
        if(result !== null) return { ok: false, message: result, line: lineNo };
      }
    }
    return { ok: true };
  }

  function verifyJSON(src){
    try{
      JSON.parse(src);
      return { ok: true };
    } catch(e){
      // e.message looks like: "Unexpected token x at position N"
      // Convert position to line number
      const msg = e.message;
      const posMatch = msg.match(/position (\d+)/i);
      if(posMatch){
        const pos = parseInt(posMatch[1]);
        const before = src.slice(0, pos);
        const lineNo = (before.match(/\n/g)||[]).length + 1;
        const col    = pos - before.lastIndexOf('\n');
        // Get the offending line
        const offending = src.split('\n')[lineNo-1]?.trim() ?? '';
        return { ok: false, message: `JSONError on line ${lineNo}, col ${col}: ${offending ? '"'+offending+'"' : msg}`, line: lineNo };
      }
      return { ok: false, message: `JSONError: ${msg}`, line: 1 };
    }
  }

  function verify(src, filename=''){
    if(filename.endsWith('.json')) return verifyJSON(src);
    return verifyPython(src);
  }

  return { verify };
})();
