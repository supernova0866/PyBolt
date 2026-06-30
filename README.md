# ⚡ PyBolt IDE

**A Python IDE that lives in your browser. No install. No setup. Just code.**

PyBolt is a fully browser-based Python IDE built for learners and developers who want to write and run Python anywhere, on any device, with nothing to install. Open the link, start coding.

---

## What you can do

### Write Python
A full code editor with syntax highlighting, bracket matching, auto-close for `()`, `[]`, `{}`, `""`, `''`, and a find bar. Your files are saved automatically every 10 seconds, even if you close the tab.

### Run it
Hit **Run** or `Ctrl+Enter`. Python executes right in the browser, powered by Brython. Output appears instantly in the panel below. First run takes a few extra seconds while the runtime warms up; every run after is fast.

**Supported:** variables, loops, conditionals, functions, classes, list/dict/set/tuple, f-strings, slicing, most builtins (`len`, `range`, `print`, `input`, `sorted`, `enumerate`, `zip`, `map`, `filter`, and more), `math`, `random`, `json`, `datetime`, `functools`, `collections`, and other standard library modules.

**Not supported:** file I/O, networking, `numpy`, `pandas`, `matplotlib`, or any package that requires native code.

### Organise your work
Create multiple files and folders, drag files between them, rename, duplicate, and move them with a right-click menu. Closing a tab doesn't delete the file, it stays in the explorer.

### Autocomplete
As you type, PyBolt suggests completions inline as faded ghost text. Press **Tab** to accept, **Esc** to dismiss. It knows Python's keywords, builtins, snippets, and every variable, function, and class you've defined in the current file.

### Pre-run checks
Before your code runs, PyBolt catches common mistakes: wrong-case builtins (`Print` instead of `print`), Python 2 syntax, missing colons, bad JSON, and more. Errors are shown clearly before execution even starts.

### Snippets
10 ready-to-use code examples: Hello World, Fibonacci, Classes, Decorators, Generators, Sorting, Dataclasses, Matrix Ops, and more. Click any card to open it in the editor.

---

## Loop Explainer

A built-in teaching tool that walks through your code **line by line**, explaining what each line does in plain English.

- The current line highlights in the editor as it executes
- Each step gets a card describing what happened
- Variables update live so you can watch them change
- Switch between **Step Output** (one card per line) and **Full Output** (just the printed results)
- Works on mobile too, tap the Explainer button from the PyBolt mobile screen

The Explainer runs its own pure JavaScript interpreter, so it's always fast and works fully offline.

---

## Settings

Tweak the IDE from the ⚙ Settings panel:

| Setting | What it does |
|---|---|
| **Verifier** | Pre-run syntax and mistake checker |
| **Autocomplete** | Inline ghost-text suggestions |
| **Line numbers** | Show or hide line numbers |
| **Auto Mirror** | Auto-close brackets and quotes |
| **Auto-save** | Save workspace every 10s and on every run |

---

## On mobile

PyBolt IDE is designed for desktop. If you open it on a phone, you'll see a button to launch **Loop Explainer Lite**, a mobile-friendly version of the Explainer that fits a small screen, with a collapsible code panel, touch-friendly controls, and a slide-up variables panel.

---

## What it runs on

Any modern browser. Chrome, Firefox, Safari, Edge. No extensions, no plugins, no accounts.

Python support is provided by [Brython](https://brython.info/). The editor is [CodeMirror 5](https://codemirror.net/).

---

## Credits

- **[Brython](https://brython.info/)** - Python 3 in the browser (MIT License)
- **[CodeMirror 5](https://codemirror.net/)** - code editor (MIT License)
- **[JetBrains Mono](https://www.jetbrains.com/legalforms/fonts/)** - editor font (OFL License)
- **[Syne](https://fonts.google.com/specimen/Syne)** - UI font (OFL License)

## License

Licensed under **Proprietary** - **All Rights Reserved**. See [`LICENSE`](https://github.com/supernova0866/PyBolt/blob/main/LICENSE) for full terms.

---

*Live app: [PyBolt](https://supernova0866.github.io/PyBolt/)*

*Built with ♡ by [Nova](https://supernova0866.github.io/Lore/)*
