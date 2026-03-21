// ════════════════════════════════════════
// LoopLogic — JS-only Python Step Interpreter
// engine/looplogic.js
//
// Supports: variables, print(), if/elif/else,
// for x in range() / list, while, arithmetic,
// augmented assignment, basic string ops, f-strings
// ════════════════════════════════════════

window.LoopLogic = (function(){

  // ── Tokenise a simple expression ─────────────────────────
  // using JS eval() in a sandboxed environment for expressions.
  // Python->JS translations happen before eval.

  function pyToJsExpr(expr, env){
    if(expr === undefined || expr === null) return 'undefined';
    let s = String(expr).trim();

    s = s.replace(/\bNone\b/g,'null')
         .replace(/\bTrue\b/g,'true')
         .replace(/\bFalse\b/g,'false');
    s = s.replace(/\bnot\b\s+/g,'!');
    s = s.replace(/\band\b/g,'&&').replace(/\bor\b/g,'||');

    // f-string: f"..." or f'...'
    s = s.replace(/f(['"])(.*?)\1/g,(m,q,inner)=>{
      const template = inner.replace(/\{([^}]+)\}/g,(mm,expr2)=>'${'+expr2+'}');
      return '`'+template+'`';
    });

    // Python slice: s[a:b] → s.slice(a,b)  (simple numeric/variable, no step)
    s = s.replace(/(\w+)\[(-?\w*):(-?\w*)\]/g,(m,v,a,b)=>{
      const start = a==='' ? '0' : a;
      const end   = b==='' ? `${v}.length` : b;
      return `${v}.slice(${start},${end})`;
    });

    return s;
  }

  // Python builtins available inside evalExpr
  const PY_BUILTINS = {
    len:   v => v==null ? 0 : (typeof v==='string'||Array.isArray(v)) ? v.length : Object.keys(v).length,
    range: (...a) => { const r=[]; const [s,e,st]=a.length===1?[0,a[0],1]:a.length===2?[a[0],a[1],1]:a; if(st>0)for(let i=s;i<e;i+=st)r.push(i);else for(let i=s;i>e;i+=st)r.push(i); return r; },
    abs:   v => Math.abs(v),
    max:   (...a) => a.length===1&&Array.isArray(a[0])?Math.max(...a[0]):Math.max(...a),
    min:   (...a) => a.length===1&&Array.isArray(a[0])?Math.min(...a[0]):Math.min(...a),
    sum:   a => Array.isArray(a)?a.reduce((acc,v)=>acc+v,0):0,
    str:   v => v==null?'None':String(v),
    int:   v => parseInt(v)||0,
    float: v => parseFloat(v)||0,
    bool:  v => !!v,
    list:  v => Array.isArray(v)?[...v]:typeof v==='string'?v.split(''):Object.keys(v),
    tuple: v => Array.isArray(v)?[...v]:typeof v==='string'?v.split(''):Object.keys(v),
    type:  v => Array.isArray(v)?'list':typeof v==='string'?'str':typeof v==='number'?'int':typeof v==='boolean'?'bool':v==null?'NoneType':'object',
    enumerate: (a,s=0) => (Array.isArray(a)?a:typeof a==='string'?a.split(''):Object.keys(a)).map((v,i)=>[i+s,v]),
    zip:   (...arrs) => { const len=Math.min(...arrs.map(a=>a.length)); return Array.from({length:len},(_,i)=>arrs.map(a=>a[i])); },
    reversed: a => [...(Array.isArray(a)?a:a.split(''))].reverse(),
    sorted: (a,key,rev) => { const arr=[...(Array.isArray(a)?a:Object.keys(a))]; arr.sort((x,y)=>typeof x==='number'?x-y:String(x).localeCompare(String(y))); if(rev)arr.reverse(); return arr; },
    print: (...a) => a.map(v=>v==null?'None':String(v)).join(' '),
    input: () => '',
    round: (v,n=0) => parseFloat(v.toFixed(n)),
    chr:   v => String.fromCharCode(v),
    ord:   v => v.charCodeAt(0),
    hex:   v => '0x'+v.toString(16),
    bin:   v => '0b'+v.toString(2),
    oct:   v => '0o'+v.toString(8),
  };

  function evalExpr(expr, env){
    const js = pyToJsExpr(expr, env);
    const keys   = [...Object.keys(env), ...Object.keys(PY_BUILTINS)];
    const values = [...Object.values(env), ...Object.values(PY_BUILTINS)];
    try {
      const fn = new Function(...keys, `"use strict"; return (${js});`);
      return fn(...values);
    } catch(e){
      return `<error: ${e.message}>`;
    }
  }

  // ── Depth-aware arg split (handles range(len(S))) ──────────
  function splitArgsDepth(s){
    const parts=[]; let depth=0,cur='',inStr=null,esc=false;
    for(const ch of s){
      if(esc){cur+=ch;esc=false;continue;}
      if(ch==='\\'){esc=true;cur+=ch;continue;}
      if(inStr){cur+=ch;if(ch===inStr)inStr=null;continue;}
      if(ch==='"'||ch==="'"){inStr=ch;cur+=ch;continue;}
      if(ch==='('||ch==='['||ch==='{'){depth++;cur+=ch;continue;}
      if(ch===')'||ch===']'||ch==='}'){depth--;cur+=ch;continue;}
      if(ch===','&&depth===0){parts.push(cur.trim());cur='';continue;}
      cur+=ch;
    }
    if(cur.trim()) parts.push(cur.trim());
    return parts;
  }

  // ── Parse range() ─────────────────────────────────────────
  function parseRange(argStr, env){
    const args = splitArgsDepth(argStr).map(a=>Number(evalExpr(a, env)));
    if(args.length===1) return {start:0, stop:args[0], step:1};
    if(args.length===2) return {start:args[0], stop:args[1], step:1};
    return {start:args[0], stop:args[1], step:args[2]};
  }

  function rangeToArray(r){
    const arr=[];
    if(r.step>0) for(let i=r.start;i<r.stop;i+=r.step) arr.push(i);
    else         for(let i=r.start;i>r.stop;i+=r.step) arr.push(i);
    return arr;
  }

  // ── Parse print() arguments ───────────────────────────────
  function evalPrint(argStr, env){
    // Split by commas not inside parens/brackets/quotes
    const parts = splitArgs(argStr);
    return parts.map(p=>String(evalExpr(p.trim(), env))).join(' ');
  }

  function splitArgs(s){
    const parts=[];
    let depth=0,cur='',inStr=null,esc=false;
    for(const ch of s){
      if(esc){cur+=ch;esc=false;continue;}
      if(ch==='\\'){esc=true;cur+=ch;continue;}
      if(inStr){cur+=ch;if(ch===inStr)inStr=null;continue;}
      if(ch==='"'||ch==="'"){inStr=ch;cur+=ch;continue;}
      if(ch==='('||ch==='['||ch==='{'){depth++;cur+=ch;continue;}
      if(ch===')'||ch===']'||ch==='}'){depth--;cur+=ch;continue;}
      if(ch===','&&depth===0){parts.push(cur);cur='';continue;}
      cur+=ch;
    }
    if(cur.trim()) parts.push(cur);
    return parts;
  }

  // ── Parse Python lines into an AST-like structure ─────────
  function parseLine(raw){
    const line = raw;
    const stripped = raw.trim();

    // Blank / comment
    if(stripped==='' || stripped.startsWith('#'))
      return {type:'blank'};

    // Indentation level
    const indent = raw.match(/^(\s*)/)[1].length;

    // import / from … import
    if(/^\s*(import|from)\s/.test(raw))
      return {type:'unsupported', code:stripped, explain:'import not supported', indent};

    // def / class / decorator / async / try / except / with / yield
    if(/^\s*(def|class|@|async|await|try|except|finally|with|yield|raise|lambda)\b/.test(raw))
      return {type:'unsupported', code:stripped, explain:'construct not supported', indent};

    // for x in range(...):
    const forRange = stripped.match(/^for\s+(\w+)\s+in\s+range\s*\((.+)\)\s*:/);
    if(forRange) return {type:'for_range', var:forRange[1], rangeArgs:forRange[2], indent, code:stripped};

    // for x in <expr>:
    const forIn = stripped.match(/^for\s+(\w+)\s+in\s+(.+?)\s*:/);
    if(forIn) return {type:'for_in', var:forIn[1], iterExpr:forIn[2], indent, code:stripped};

    // while <cond>:
    const whileM = stripped.match(/^while\s+(.+?)\s*:/);
    if(whileM) return {type:'while', cond:whileM[1], indent, code:stripped};

    // if <cond>:
    const ifM = stripped.match(/^if\s+(.+?)\s*:/);
    if(ifM) return {type:'if', cond:ifM[1], indent, code:stripped};

    // elif <cond>:
    const elifM = stripped.match(/^elif\s+(.+?)\s*:/);
    if(elifM) return {type:'elif', cond:elifM[1], indent, code:stripped};

    // else:
    if(/^else\s*:/.test(stripped))
      return {type:'else', indent, code:stripped};

    // break / continue / pass
    if(stripped==='break') return {type:'break', indent, code:stripped};
    if(stripped==='continue') return {type:'continue', indent, code:stripped};
    if(stripped==='pass') return {type:'pass', indent, code:stripped};

    // print(...)
    const printM = stripped.match(/^print\s*\((.*)\)$/s);
    if(printM) return {type:'print', args:printM[1], indent, code:stripped};

    // augmented assignment: x += expr
    const augM = stripped.match(/^(\w+)\s*(\+=|-=|\*=|\/=|\/\/=|%=|\*\*=)\s*(.+)$/);
    if(augM) return {type:'aug_assign', var:augM[1], op:augM[2], expr:augM[3], indent, code:stripped};

    // assignment: x = expr  (not ==)
    const assignM = stripped.match(/^([a-zA-Z_]\w*)\s*=(?!=)\s*(.+)$/);
    if(assignM) return {type:'assign', var:assignM[1], expr:assignM[2], indent, code:stripped};

    // multiple assignment: a, b = expr
    const multiM = stripped.match(/^([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)+)\s*=(?!=)\s*(.+)$/);
    if(multiM) return {type:'multi_assign', vars:multiM[1].split(',').map(v=>v.trim()), expr:multiM[2], indent, code:stripped};

    // Bare expression (just evaluate and discard)
    return {type:'expr', expr:stripped, indent, code:stripped};
  }

  // ── Flatten code into execution steps ─────────────────────
  // flatten loops/conditionals into a sequence of "instructions"
  // each with a lineIdx pointing back to the source line.
  // The interpreter then runs these instructions one at a time.

  function compile(sourceCode, unsupportedSet){
    const rawLines = sourceCode.split('\n');
    const parsed   = rawLines.map((l,i)=>({...parseLine(l), lineIdx:i, lineNo:i+1}));

    return {
      rawLines,
      parsed,
      unsupportedSet: unsupportedSet || new Set(),
      totalLines: rawLines.length,
      env: {},
      output: [],
      // Execution cursor — index into a flat "instruction list" we build lazily
      ip: 0,
      instructions: null, // built on first step
      done: false,
    };
  }

  // Build a flat instruction list by expanding loops
  // Max iterations guard to prevent infinite loops
  const MAX_ITER = 1000;

  function buildInstructions(state){
    // doing a tree-structured execution using a call stack approach
    // instead of fully flattening (to handle loops properly)
    return null; // signal to use the tree executor
  }

  // ── Tree executor — the core stepper ─────────────────────
  // state.execStack: [{type:'lines', lines:[...], idx:0}, ...]
  // Each entry represents a block we're executing.

  function ensureExecStack(state){
    if(!state.execStack){
      state.execStack = [{
        type:'lines',
        lines: state.parsed,
        idx: 0,
        iterGuard: 0,
      }];
    }
  }

  // Returns a step result or null if done
  function step(state){
    if(state.done) return {done:true};
    ensureExecStack(state);

    // Pop from top of stack until something found to execute
    while(state.execStack.length > 0){
      const frame = state.execStack[state.execStack.length-1];

      if(frame.type==='lines'){
        if(frame.idx >= frame.lines.length){
          state.execStack.pop();
          continue;
        }
        const node = frame.lines[frame.idx];
        frame.idx++;

        // Skip blank lines and comments silently
        if(node.type==='blank') continue;

        // Unsupported
        if(state.unsupportedSet.has(node.lineIdx) || node.type==='unsupported'){
          return {
            lineIdx: node.lineIdx,
            lineNo:  node.lineNo,
            code:    node.code,
            type:    'skipped',
            explain: node.explain || 'unsupported construct',
          };
        }

        return executeNode(node, state, frame);
      }

      // for loop frame
      if(frame.type==='for'){
        if(frame.iterGuard++ > MAX_ITER){ state.execStack.pop(); continue; }

        if(frame.iterIdx >= frame.items.length){
          state.execStack.pop();
          continue;
        }
        // Assign loop var
        state.env[frame.varName] = frame.items[frame.iterIdx++];
        // Push the body as a new lines frame
        state.execStack.push({
          type:'lines',
          lines: frame.body,
          idx: 0,
          iterGuard: 0,
        });
        // Return the for-line step to show assignment
        return {
          lineIdx: frame.lineIdx,
          lineNo:  frame.lineNo,
          code:    frame.code,
          type:    'for_iter',
          explain: `Loop iteration: ${frame.varName} = ${reprVal(state.env[frame.varName])}`,
          output:  '',
        };
      }

      // while loop frame
      if(frame.type==='while'){
        if(frame.iterGuard++ > MAX_ITER){ state.execStack.pop(); continue; }

        const cond = evalExpr(frame.condExpr, state.env);
        if(!cond){
          state.execStack.pop();
          continue;
        }
        state.execStack.push({
          type:'lines',
          lines: frame.body,
          idx: 0,
          iterGuard: 0,
        });
        return {
          lineIdx: frame.lineIdx,
          lineNo:  frame.lineNo,
          code:    frame.code,
          type:    'while_check',
          explain: `while condition is true (${frame.condExpr} → ${cond})`,
          output:  '',
        };
      }

      state.execStack.pop();
    }

    state.done = true;
    return {done: true};
  }

  function executeNode(node, state, parentFrame){
    switch(node.type){

      case 'assign':{
        const val = evalExpr(node.expr, state.env);
        state.env[node.var] = val;
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'assign',
          explain: `Assign ${node.var} = ${reprVal(val)}`,
          output: '',
        };
      }

      case 'multi_assign':{
        const val = evalExpr(node.expr, state.env);
        const arr = Array.isArray(val) ? val : [val];
        node.vars.forEach((v,i)=>{ state.env[v] = arr[i]; });
        const parts = node.vars.map((v,i)=>`${v} = ${reprVal(arr[i])}`).join(', ');
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'assign',
          explain: `Unpack: ${parts}`,
          output: '',
        };
      }

      case 'aug_assign':{
        const opMap = {'+=':'+','-=':'-','*=':'*','/=':'/','//=':'//','%=':'%','**=':'**'};
        const op = opMap[node.op]||'+';
        const cur = state.env[node.var]??0;
        const rhs = evalExpr(node.expr, state.env);
        let result;
        switch(op){
          case '+':  result=cur+rhs; break;
          case '-':  result=cur-rhs; break;
          case '*':  result=cur*rhs; break;
          case '/':  result=cur/rhs; break;
          case '//': result=Math.trunc(cur/rhs); break;
          case '%':  result=((cur%rhs)+rhs)%rhs; break;
          case '**': result=Math.pow(cur,rhs); break;
          default:   result=cur+rhs;
        }
        state.env[node.var]=result;
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'assign',
          explain: `${node.var} ${node.op} ${reprVal(rhs)}  →  ${node.var} = ${reprVal(result)}`,
          output: '',
        };
      }

      case 'print':{
        const out = evalPrint(node.args, state.env);
        state.output.push(out);
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'print',
          explain: `print() outputs to console`,
          output: out,
        };
      }

      case 'expr':{
        const val = evalExpr(node.expr, state.env);
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'expr',
          explain: `Expression evaluates to: ${reprVal(val)}`,
          output: '',
        };
      }

      case 'pass':
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'pass', explain: 'pass — do nothing', output: '',
        };

      case 'for_range':{
        const r = parseRange(node.rangeArgs, state.env);
        const items = rangeToArray(r);
        // Collect body = next lines with greater indent
        const body = collectBody(parentFrame.lines, parentFrame.idx - 1, node.indent);
        // Skip those lines in parent frame
        parentFrame.idx += body.length;
        state.execStack.push({
          type:'for', varName:node.var, items, iterIdx:0,
          body, lineIdx:node.lineIdx, lineNo:node.lineNo,
          code:node.code, iterGuard:0,
        });
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'for_start',
          explain: `for loop: ${node.var} will take ${items.length} value(s): ${reprVal(items.slice(0,5))}${items.length>5?'…':''}`,
          output: '',
        };
      }

      case 'for_in':{
        const iter = evalExpr(node.iterExpr, state.env);
        let items;
        if(Array.isArray(iter)){
          items = iter;
        } else if(typeof iter === 'string'){
          // Iterate over characters
          items = iter.split('');
        } else if(iter && typeof iter === 'object'){
          // dict — iterate over keys
          items = Object.keys(iter);
        } else {
          items = [];
        }
        const body = collectBody(parentFrame.lines, parentFrame.idx - 1, node.indent);
        parentFrame.idx += body.length;
        const typeLabel = typeof iter==='string' ? `string "${iter}"` : Array.isArray(iter) ? `list/tuple` : `dict keys`;
        state.execStack.push({
          type:'for', varName:node.var, items, iterIdx:0,
          body, lineIdx:node.lineIdx, lineNo:node.lineNo,
          code:node.code, iterGuard:0,
        });
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'for_start',
          explain: `for loop over ${typeLabel} (${items.length} item${items.length!==1?'s':''})`,
          output: '',
        };
      }

      case 'while':{
        const body = collectBody(parentFrame.lines, parentFrame.idx - 1, node.indent);
        parentFrame.idx += body.length;
        state.execStack.push({
          type:'while', condExpr:node.cond, body,
          lineIdx:node.lineIdx, lineNo:node.lineNo,
          code:node.code, iterGuard:0,
        });
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'while_start',
          explain: `while loop: will repeat as long as "${node.cond}" is true`,
          output: '',
        };
      }

      case 'if':{
        const cond = !!evalExpr(node.cond, state.env);
        const body = collectBody(parentFrame.lines, parentFrame.idx - 1, node.indent);
        parentFrame.idx += body.length;

        // Also eat elif/else chains
        let elifElseCount = 0;
        while(parentFrame.idx < parentFrame.lines.length){
          const next = parentFrame.lines[parentFrame.idx];
          if(next && (next.type==='elif'||next.type==='else') && next.indent===node.indent){
            const branch = collectBody(parentFrame.lines, parentFrame.idx, node.indent);
            parentFrame.idx += 1 + branch.length;
            elifElseCount++;
          } else break;
        }

        if(cond){
          state.execStack.push({type:'lines', lines:body, idx:0, iterGuard:0});
        }
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'if',
          explain: `if ${node.cond} → ${cond ? 'TRUE — entering block' : 'FALSE — skipping block'}`,
          output: '',
        };
      }

      case 'elif':
      case 'else':
        // Should be consumed by the if handler; if seen them standalone, skip
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code,
          type: 'skipped', explain: 'branch already handled by if', output:'',
        };

      case 'break':
        // Pop until for/while frame found
        while(state.execStack.length>0){
          const f=state.execStack[state.execStack.length-1];
          if(f.type==='for'||f.type==='while'){state.execStack.pop();break;}
          state.execStack.pop();
        }
        return {
          lineIdx:node.lineIdx,lineNo:node.lineNo,code:node.code,
          type:'break',explain:'break — exiting loop',output:'',
        };

      case 'continue':
        // Pop to the nearest for/while
        while(state.execStack.length>0){
          const f=state.execStack[state.execStack.length-1];
          if(f.type==='for'||f.type==='while') break;
          state.execStack.pop();
        }
        return {
          lineIdx:node.lineIdx,lineNo:node.lineNo,code:node.code,
          type:'continue',explain:'continue — skip to next iteration',output:'',
        };

      default:
        return {
          lineIdx: node.lineIdx, lineNo: node.lineNo, code: node.code||node.type,
          type: 'skipped', explain: `unknown node type: ${node.type}`, output:'',
        };
    }
  }

  // Collect indented body lines following a header line
  function collectBody(lines, headerIdx, headerIndent){
    const body=[];
    for(let i=headerIdx+1; i<lines.length; i++){
      const l=lines[i];
      if(l.type==='blank') continue;
      if(l.indent > headerIndent) body.push(l);
      else break;
    }
    return body;
  }

  function reprVal(v){
    if(v===null||v===undefined) return 'None';
    if(typeof v==='string') return `"${v}"`;
    if(Array.isArray(v)) return '['+v.map(reprVal).join(', ')+']';
    if(typeof v==='object') return '{'+Object.entries(v).map(([k,val])=>`${reprVal(k)}: ${reprVal(val)}`).join(', ')+'}';
    if(typeof v==='boolean') return v?'True':'False';
    return String(v);
  }

  return { compile, step };

})();
