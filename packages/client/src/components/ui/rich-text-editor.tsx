import * as React from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

import { cn } from '@/lib/utils';

export interface RichTextEditorHandle {
   clear: () => void;
}

const TOOLBAR_OPTIONS = [
   ['bold', 'italic', 'underline'],
   [{ list: 'ordered' }, { list: 'bullet' }],
   ['link'],
   ['clean'],
];

// Thin wrapper around Quill's own (BSD-licensed, free) editor+toolbar —
// kept uncontrolled (initialized once with `defaultValue`) rather than
// synced from a `value` prop on every render, since re-applying HTML into
// Quill on each keystroke is what causes cursor-jump bugs in naive
// React+Quill integrations. Callers that need to clear the editor (e.g.
// after a successful submit) use the `clear()` imperative handle instead.
export const RichTextEditor = React.forwardRef<
   RichTextEditorHandle,
   {
      id?: string;
      defaultValue?: string;
      placeholder?: string;
      onChange?: (html: string, text: string) => void;
      'aria-invalid'?: boolean;
      className?: string;
   }
>(function RichTextEditor(
   {
      id,
      defaultValue,
      placeholder,
      onChange,
      'aria-invalid': ariaInvalid,
      className,
   },
   ref
) {
   const containerRef = React.useRef<HTMLDivElement>(null);
   const quillRef = React.useRef<Quill | null>(null);
   const onChangeRef = React.useRef(onChange);
   onChangeRef.current = onChange;

   React.useImperativeHandle(ref, () => ({
      // 'silent' suppresses Quill's text-change event — without it, this
      // programmatic clear fires `onChange('', '')` just like user typing
      // would, which re-triggers the caller's validation on an empty value
      // right after it just reset its form state (e.g. after a successful
      // submit), resurrecting a "required" error the user never caused.
      clear: () => quillRef.current?.setText('', 'silent'),
   }));

   React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const editorEl = document.createElement('div');
      container.appendChild(editorEl);

      const quill = new Quill(editorEl, {
         theme: 'snow',
         placeholder,
         modules: { toolbar: TOOLBAR_OPTIONS },
      });
      if (defaultValue) quill.clipboard.dangerouslyPasteHTML(defaultValue);
      quillRef.current = quill;

      quill.on('text-change', () => {
         const isEmpty =
            quill.getText().trim().length === 0 && quill.getLength() <= 1;
         onChangeRef.current?.(
            isEmpty ? '' : quill.root.innerHTML,
            quill.getText().trim()
         );
      });

      return () => {
         // Use the `container` captured above, not `containerRef.current`
         // — by the time this cleanup runs (e.g. React StrictMode's dev
         // double-invoke of effects), the ref may already read as
         // null/undefined, which made `containerRef.current?.foo()`
         // silently no-op and leave the previous toolbar/editor DOM
         // orphaned inside the still-live container.
         quillRef.current = null;
         container.replaceChildren();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   return (
      <div
         id={id}
         ref={containerRef}
         data-slot="rich-text-editor"
         aria-invalid={ariaInvalid}
         className={cn(
            'flex flex-col rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
            // Corners are rounded on the inner toolbar/container directly
            // rather than `overflow-hidden` on this wrapper, since that
            // would also clip the link-editor tooltip popup whenever it
            // opens near an edge.
            '[&_.ql-toolbar]:rounded-t-lg [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-border [&_.ql-toolbar]:px-2 [&_.ql-toolbar]:py-1.5',
            '[&_.ql-container]:rounded-b-lg [&_.ql-container]:border-none [&_.ql-container]:font-sans [&_.ql-container]:text-base [&_.ql-container]:md:text-sm',
            '[&_.ql-editor]:min-h-24 [&_.ql-editor]:px-3 [&_.ql-editor]:py-2 [&_.ql-editor]:!text-foreground',
            '[&_.ql-editor.ql-blank::before]:!text-muted-foreground [&_.ql-editor.ql-blank::before]:not-italic [&_.ql-editor.ql-blank::before]:![opacity:1]',
            // Quill's snow theme hardcodes stroke/fill:#444 (dark-on-light
            // only) and an active/hover blue (#06c) that clashes with the
            // app's teal primary — `!` forces these to win over the
            // imported quill.snow.css regardless of stylesheet order, and
            // swaps the accent for the app's own tokens so it looks right
            // in both themes.
            '[&_.ql-stroke]:!stroke-muted-foreground [&_.ql-fill]:!fill-muted-foreground [&_.ql-picker]:!text-muted-foreground',
            '[&_.ql-toolbar_button:hover]:!bg-accent [&_.ql-toolbar_button:hover]:rounded-sm [&_.ql-toolbar_button:hover_.ql-stroke]:!stroke-accent-foreground [&_.ql-toolbar_button:hover_.ql-fill]:!fill-accent-foreground',
            '[&_.ql-toolbar_button.ql-active]:!bg-accent [&_.ql-toolbar_button.ql-active]:rounded-sm [&_.ql-toolbar_button.ql-active_.ql-stroke]:!stroke-primary [&_.ql-toolbar_button.ql-active_.ql-fill]:!fill-primary',
            // Link-editor popup — restyle Quill's hardcoded white/black/blue
            // tooltip to match the app's popover surface.
            '[&_.ql-tooltip]:!bg-popover [&_.ql-tooltip]:!text-popover-foreground [&_.ql-tooltip]:!border-border [&_.ql-tooltip]:rounded-md [&_.ql-tooltip]:!shadow-md',
            '[&_.ql-tooltip_input]:!bg-background [&_.ql-tooltip_input]:!border-input [&_.ql-tooltip_input]:!text-foreground [&_.ql-tooltip_input]:rounded-sm',
            '[&_.ql-tooltip_a]:!text-primary',
            className
         )}
      />
   );
});
