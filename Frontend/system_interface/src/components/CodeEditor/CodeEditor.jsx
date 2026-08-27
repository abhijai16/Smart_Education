import React, { useState, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import Editor, { loader } from '@monaco-editor/react';
import styles from './CodeEditor.module.css';

const LANGUAGES = [
  { value: 'python', label: 'Python', monaco: 'python' },
  { value: 'cpp', label: 'C / C++', monaco: 'cpp' },
  { value: 'java', label: 'Java', monaco: 'java' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
];

const THEMES = [
  { value: 'vesper', label: '🌙 Vesper' },
  { value: 'vs-dark', label: '🌑 Dark' },
  { value: 'vs-light', label: '☀️ Light' },
  { value: 'hc-black', label: '🔲 High Contrast' },
];

const TEMPLATES = {
  python: '# Write your Python solution here\n\ndef solution():\n    pass\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Read input from stdin (e.g., cin >> a >> b;)\n    // Write your C / C++ solution here\n    // Print output to stdout (e.g., cout << result << endl;)\n\n    return 0;\n}\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n',
  javascript: '// Write your JavaScript solution here\n\nfunction solution() {\n    \n}\n',
};

/* Vesper — by Rauno Freiberg (MIT). Trimmed of comments for Monaco's
   strict JSON parser; colors and token rules otherwise unchanged. */
const VESPER_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8b8b8b94', fontStyle: 'italic' },
    { token: 'variable', foreground: 'FFFFFF' },
    { token: 'string constant.other.placeholder', foreground: 'FFFFFF' },
    { token: 'entity.name.tag', foreground: 'FFFFFF' },
    { token: 'constant.other.color', foreground: 'FFFFFF' },
    { token: 'invalid', foreground: 'FF8080' },
    { token: 'invalid.illegal', foreground: 'FF8080' },
    { token: 'keyword', foreground: 'A0A0A0' },
    { token: 'storage.type', foreground: 'A0A0A0' },
    { token: 'storage.modifier', foreground: 'A0A0A0' },
    { token: 'keyword.control', foreground: 'A0A0A0' },
    { token: 'punctuation.definition.tag', foreground: 'A0A0A0' },
    { token: 'punctuation.separator.inheritance.php', foreground: 'A0A0A0' },
    { token: 'punctuation.definition.tag.html', foreground: 'A0A0A0' },
    { token: 'punctuation.definition.tag.begin.html', foreground: 'A0A0A0' },
    { token: 'punctuation.definition.tag.end.html', foreground: 'A0A0A0' },
    { token: 'punctuation.section.embedded', foreground: 'A0A0A0' },
    { token: 'keyword.other.template', foreground: 'A0A0A0' },
    { token: 'keyword.other.substitution', foreground: 'A0A0A0' },
    { token: 'meta.tag.sgml', foreground: 'FFC799' },
    { token: 'markup.deleted.git_gutter', foreground: 'FFC799' },
    { token: 'entity.name.function', foreground: 'FFC799' },
    { token: 'variable.function', foreground: 'FFC799' },
    { token: 'support.function', foreground: 'FFC799' },
    { token: 'keyword.other.special-method', foreground: 'FFC799' },
    { token: 'meta.block variable.other', foreground: 'FFFFFF' },
    { token: 'support.other.variable', foreground: 'FFFFFF' },
    { token: 'string.other.link', foreground: 'FFFFFF' },
    { token: 'constant.numeric', foreground: 'FFC799' },
    { token: 'support.constant', foreground: 'FFC799' },
    { token: 'constant.character', foreground: 'FFC799' },
    { token: 'constant.escape', foreground: 'FFC799' },
    { token: 'keyword.other.unit', foreground: 'FFC799' },
    { token: 'keyword.other', foreground: 'FFC799' },
    { token: 'constant.language.boolean', foreground: 'FFC799' },
    { token: 'string', foreground: '99FFE4' },
    { token: 'constant.other.symbol', foreground: '99FFE4' },
    { token: 'constant.other.key', foreground: '99FFE4' },
    { token: 'meta.group.braces.curly constant.other.object.key.js string.unquoted.label.js', foreground: '99FFE4' },
    { token: 'entity.name', foreground: 'FFC799' },
    { token: 'support.type', foreground: 'FFC799' },
    { token: 'support.class', foreground: 'FFC799' },
    { token: 'support.other.namespace.use.php', foreground: 'FFC799' },
    { token: 'meta.use.php', foreground: 'FFC799' },
    { token: 'support.other.namespace.php', foreground: 'FFC799' },
    { token: 'markup.changed.git_gutter', foreground: 'FFC799' },
    { token: 'support.type.sys-types', foreground: 'FFC799' },
    { token: 'source.css support.type.property-name', foreground: 'FFFFFF' },
    { token: 'source.sass support.type.property-name', foreground: 'FFFFFF' },
    { token: 'source.scss support.type.property-name', foreground: 'FFFFFF' },
    { token: 'source.less support.type.property-name', foreground: 'FFFFFF' },
    { token: 'source.stylus support.type.property-name', foreground: 'FFFFFF' },
    { token: 'source.postcss support.type.property-name', foreground: 'FFFFFF' },
    { token: 'support.type.vendored.property-name.css', foreground: 'FFFFFF' },
    { token: 'source.css.scss entity.name.tag', foreground: 'FFFFFF' },
    { token: 'variable.parameter.keyframe-list.css', foreground: 'FFFFFF' },
    { token: 'meta.property-name.css', foreground: 'FFFFFF' },
    { token: 'variable.parameter.url.scss', foreground: 'FFFFFF' },
    { token: 'meta.property-value.scss', foreground: 'FFFFFF' },
    { token: 'meta.property-value.css', foreground: 'FFFFFF' },
    { token: 'entity.name.module.js', foreground: 'FF8080' },
    { token: 'variable.import.parameter.js', foreground: 'FF8080' },
    { token: 'variable.other.class.js', foreground: 'FF8080' },
    { token: 'variable.language', foreground: 'A0A0A0' },
    { token: 'entity.name.method.js', foreground: 'FFFFFF' },
    { token: 'meta.class-method.js entity.name.function.js', foreground: 'FFFFFF' },
    { token: 'variable.function.constructor', foreground: 'FFFFFF' },
    { token: 'entity.other.attribute-name', foreground: 'A0A0A0' },
    { token: 'meta.property-list.scss', foreground: 'A0A0A0' },
    { token: 'meta.attribute-selector.scss', foreground: 'A0A0A0' },
    { token: 'entity.name.tag.reference.scss', foreground: 'A0A0A0' },
    { token: 'entity.name.tag.nesting.css', foreground: 'A0A0A0' },
    { token: 'punctuation.separator.key-value.css', foreground: 'A0A0A0' },
    { token: 'text.html.basic entity.other.attribute-name.html', foreground: 'FFC799' },
    { token: 'text.html.basic entity.other.attribute-name', foreground: 'FFC799' },
    { token: 'entity.other.attribute-name.class', foreground: 'FFC799' },
    { token: 'entity.other.attribute-name.id', foreground: 'FFC799' },
    { token: 'variable.parameter.misc.css', foreground: 'FFC799' },
    { token: 'source.sass keyword.control', foreground: '99FFE4' },
    { token: 'markup.inserted', foreground: '99FFE4' },
    { token: 'markup.deleted', foreground: 'FF8080' },
    { token: 'markup.changed', foreground: 'A0A0A0' },
    { token: 'string.regexp', foreground: 'A0A0A0' },
    { token: 'constant.character.escape', foreground: 'A0A0A0' },
    { token: 'tag.decorator.js entity.name.tag.js', foreground: 'FFFFFF' },
    { token: 'tag.decorator.js punctuation.definition.tag.js', foreground: 'FFFFFF' },
    { token: 'source.js constant.other.object.key.js string.unquoted.label.js', foreground: 'FF8080', fontStyle: 'italic' },
    { token: 'source.json meta.structure.dictionary.json support.type.property-name.json', foreground: 'FFC799' },
    { token: 'text.html.markdown', foreground: 'FFFFFF' },
    { token: 'punctuation.definition.list_item.markdown', foreground: 'FFFFFF' },
    { token: 'text.html.markdown markup.inline.raw.markdown', foreground: 'A0A0A0' },
    { token: 'text.html.markdown markup.inline.raw.markdown punctuation.definition.raw.markdown', foreground: 'FFFFFF' },
    { token: 'markdown.heading', foreground: 'FFC799' },
    { token: 'markup.heading', foreground: 'FFC799' },
    { token: 'markup.heading.markdown punctuation.definition.heading.markdown', foreground: 'FFC799' },
    { token: 'markup.inserted.git_gutter', foreground: 'FFC799' },
    { token: 'markup.italic', foreground: 'FFFFFF', fontStyle: 'italic' },
    { token: 'markup.bold', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.bold markup.italic', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.italic markup.bold', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.quote markup.bold', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.bold markup.italic string', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.italic markup.bold string', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.quote markup.bold string', foreground: 'FFFFFF', fontStyle: 'bold' },
    { token: 'markup.underline', foreground: 'FFC799', fontStyle: 'underline' },
    { token: 'markup.quote punctuation.definition.blockquote.markdown', foreground: 'FFFFFF' },
    { token: 'string.other.link.title.markdown', foreground: 'FFFFFF' },
    { token: 'string.other.link.description.title.markdown', foreground: 'A0A0A0' },
    { token: 'constant.other.reference.link.markdown', foreground: 'FFC799' },
    { token: 'markup.raw.block', foreground: 'A0A0A0' },
    { token: 'markup.raw.block.fenced.markdown', foreground: '00000050' },
    { token: 'punctuation.definition.fenced.markdown', foreground: '00000050' },
    { token: 'variable.language.fenced.markdown', foreground: 'FFFFFF' },
    { token: 'punctuation.section.class.end', foreground: 'FFFFFF' },
    { token: 'meta.separator', foreground: '65737E', fontStyle: 'bold' },
    { token: 'markup.table', foreground: 'FFFFFF' },
  ],
  colors: {
    'editor.background': '#101010',
    'editor.foreground': '#FFFFFF',
    'editor.selectionBackground': '#FFFFFF25',
    'editor.selectionHighlightBackground': '#FFFFFF25',
    'editorLineNumber.foreground': '#505050',
    'editorWarning.foreground': '#FFC799',
    'editorError.foreground': '#FF8080',
    'editorGutter.addedBackground': '#99FFE4',
    'editorGutter.deletedBackground': '#FF8080',
    'editorGutter.modifiedBackground': '#FFC799',
    'editorInlayHint.foreground': '#A0A0A0',
    'editorInlayHint.background': '#1C1C1C',
    'editorBracketMatch.background': '#232323',
    'editorBracketMatch.border': '#FFC799',
    'editorHoverWidget.background': '#161616',
    'editorHoverWidget.border': '#282828',
    'editorWidget.background': '#101010',
    'editorSuggestWidget.background': '#101010',
    'editorSuggestWidget.border': '#282828',
    'editorSuggestWidget.selectedBackground': '#232323',
    'scrollbarSlider.background': '#34343480',
    'scrollbarSlider.hoverBackground': '#343434',
    'scrollbarSlider.activeBackground': '#505050',
  },
};

window.MonacoEnvironment = {
  getWorker: function (_moduleId, label) {
    if (label === 'json') {
      return new Worker(new URL('monaco-editor/language/json/json.worker', import.meta.url), { type: 'module' });
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(new URL('monaco-editor/language/css/css.worker', import.meta.url), { type: 'module' });
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(new URL('monaco-editor/language/html/html.worker', import.meta.url), { type: 'module' });
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(new URL('monaco-editor/language/typescript/ts.worker', import.meta.url), { type: 'module' });
    }
    return new Worker(new URL('monaco-editor/editor/editor.worker', import.meta.url), { type: 'module' });
  }
};

// Explicitly tell monaco-editor to use the locally bundled version instead of the internet CDN.
loader.config({ monaco });

const CodeEditor = ({
  value,
  onChange,
  language = 'python',
  onLanguageChange,
  theme = 'vesper',
  onThemeChange,
  height = '100%',
  readOnly = false,
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  const monacoLang = LANGUAGES.find((l) => l.value === language)?.monaco || 'python';

  const [monacoLoaded, setMonacoLoaded] = useState(false);
  const [monacoError, setMonacoError] = useState(false);

  useEffect(() => {
    let timeoutId = setTimeout(() => {
      if (!monacoLoaded) {
        console.warn("Monaco loading timed out, falling back to textarea.");
        setMonacoError(true);
      }
    }, 5000); // Increased timeout slightly for local loading

    loader.init()
      .then(() => {
        clearTimeout(timeoutId);
        // Register Vesper once Monaco is ready. Safe to call repeatedly —
        // monaco throws if the same name is defined twice, so guard.
        try {
          monaco.editor.defineTheme('vesper', VESPER_THEME);
        } catch {
          /* already registered */
        }
        setMonacoLoaded(true);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error("Monaco loading failed:", err);
        setMonacoError(true);
      });

    return () => clearTimeout(timeoutId);
  }, [monacoLoaded]);

  // When language changes externally and code is empty/template, load new template
  useEffect(() => {
    if (!readOnly && (!value || Object.values(TEMPLATES).includes(value))) {
      onChange?.(TEMPLATES[language] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  const handleLangChange = (e) => {
    const lang = e.target.value;
    
    if (readOnly) {
      onLanguageChange?.(lang);
      return;
    }

    const isDirty = value && !Object.values(TEMPLATES).includes(value);
    
    if (isDirty) {
      if (!window.confirm("Changing the language will delete your current code. Are you sure you want to proceed?")) {
        return;
      }
    }

    onLanguageChange?.(lang);
    onChange?.(TEMPLATES[lang] || '');
  };

  const container = fullscreen ? `${styles.container} ${styles.fullscreen}` : styles.container;

  return (
    <div className={container} style={fullscreen ? {} : { height }}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {onLanguageChange ? (
          <select
            className={styles.select}
            value={language}
            onChange={handleLangChange}
            aria-label="Select language"
            disabled={readOnly}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        ) : (
          <div style={{ color: 'var(--clr-text-2)', fontSize: '14px', fontWeight: 'bold' }}>
            {LANGUAGES.find(l => l.value === language)?.label || language}
          </div>
        )}

        {onThemeChange ? (
          <select
            className={styles.select}
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
            aria-label="Select theme"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        ) : (
          <div style={{ color: 'var(--clr-text-2)', fontSize: '13px' }}>
            {THEMES.find((t) => t.value === theme)?.label || theme}
          </div>
        )}

        <button
          className={`btn btn-ghost btn-sm ${styles.fullscreenBtn}`}
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {fullscreen ? '⊡ Exit' : '⛶ Full'}
        </button>
      </div>

      {/* Editor */}
      <div className={styles.editorWrap}>
        {monacoError ? (
          <textarea
            value={value}
            onChange={(e) => {
              if (!readOnly) onChange?.(e.target.value);
            }}
            readOnly={readOnly}
            placeholder="Type your solution here..."
            style={{
              width: '100%',
              height: '100%',
              background: theme === 'vs-light' ? '#ffffff' : '#1e1e1e',
              color: theme === 'vs-light' ? '#000000' : '#d4d4d4',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '14px',
              padding: '16px',
              border: 'none',
              outline: 'none',
              resize: 'none',
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={monacoLang}
            theme={theme}
            value={value}
            onChange={(v) => {
              if (!readOnly) onChange?.(v || '');
            }}
            options={{
              readOnly: readOnly,
              fontSize: 14,
              minimap: { enabled: false },
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: false,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
