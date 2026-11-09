'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// A command palette: Ctrl K (or ⌘K) from anywhere in the app, or the search button in the header.
// Type to filter, arrows to move, Enter to run, Escape to close. Styles in app/fx.css (.palette-*).

export type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon?: ReactNode;
  run: () => void;
};

const OPEN_EVENT = 'command-palette:open';

export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The header button that opens the palette, showing its shortcut. */
export function CommandButton({ label = 'Search or ask', className = '' }: { label?: string; className?: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMac(isMac()));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <button type="button" onClick={openCommandPalette} className={`palette-trigger ${className}`} aria-label={`${label} (${mac ? '⌘' : 'Ctrl'} K)`}>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span className="truncate">{label}</span>
      <kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
  );
}

export function CommandPalette({ commands, placeholder = 'Type a command or a question…' }: { commands: Command[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // Every opening starts from an empty search, set in the same event that opens it.
  const isOpen = useRef(false);
  useEffect(() => {
    isOpen.current = open;
  }, [open]);

  useEffect(() => {
    const show = () => {
      setQuery('');
      setActive(0);
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (isOpen.current) setOpen(false);
        else show();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Every word must match somewhere; a match in the name ranks above one in the group or keywords.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length === 0) return commands;
    const score = (command: Command) => {
      const label = command.label.toLowerCase();
      const text = `${label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
      if (!words.every((word) => text.includes(word))) return 0;
      if (label === q) return 4;
      if (label.startsWith(q)) return 3;
      return words.every((word) => label.includes(word)) ? 2 : 1;
    };
    return commands
      .map((command, order) => ({ command, order, score: score(command) }))
      .filter((entry) => entry.score > 0)
      .sort((x, y) => y.score - x.score || x.order - y.order)
      .map((entry) => entry.command);
  }, [commands, query]);

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    // Let the palette close before the command opens anything of its own.
    requestAnimationFrame(() => command.run());
  };

  return (
    <div className="palette-backdrop" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-search">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={query}
            placeholder={placeholder}
            aria-label="Search commands"
            aria-controls="palette-list"
            aria-activedescendant={shown[active] ? `palette-${shown[active].id}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) => Math.min(shown.length - 1, index + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => Math.max(0, index - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(shown[active]);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-list" ref={list} role="listbox" className="palette-list">
          {shown.length === 0 && <li className="palette-empty">Nothing matches &ldquo;{query}&rdquo;.</li>}
          {shown.map((command, index) => {
            const header = index === 0 || shown[index - 1].group !== command.group ? command.group : null;
            return (
              <li key={command.id} role="presentation">
                {header && <p className="palette-group">{header}</p>}
                <div
                  id={`palette-${command.id}`}
                  role="option"
                  aria-selected={index === active}
                  className="palette-item"
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(command)}
                >
                  <span className="palette-icon" aria-hidden>
                    {command.icon ?? '→'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.hint && <span className="palette-hint">{command.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="palette-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>Enter</kbd> to run
          </span>
        </p>
      </div>
    </div>
  );
}
