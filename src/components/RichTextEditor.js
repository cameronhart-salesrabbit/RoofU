import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BaseImage from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { supabase } from '../supabase/client';

const IMAGE_ALIGN_STYLE = {
  left: 'display: block; max-width: 100%; margin: 0 auto 0 0;',
  center: 'display: block; max-width: 100%; margin: 0 auto;',
  right: 'display: block; max-width: 100%; margin: 0 0 0 auto;',
};

// Extends the base Image node with a `style` attribute so images can be
// left/center/right aligned (plain Image nodes have no alignment concept).
const Image = BaseImage.extend({
  addAttributes() {
    return {
      ...this.parent(),
      style: {
        default: IMAGE_ALIGN_STYLE.center,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
});

export default function RichTextEditor({ value, onChange, clientId }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Write lesson notes, summaries, or supplemental content…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const ext = file.name.split('.').pop();
    const path = `${clientId}/lesson-images/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('lesson-content').upload(path, file, { upsert: true });
    if (error) { alert('Image upload failed: ' + error.message); return; }

    const { data } = supabase.storage.from('lesson-content').getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl, style: IMAGE_ALIGN_STYLE.center }).run();
    e.target.value = '';
  }, [editor, clientId]);

  const alignImage = useCallback((align) => {
    editor.chain().focus().updateAttributes('image', { style: IMAGE_ALIGN_STYLE[align] }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading">H3</ToolbarBtn>
        <div style={styles.divider} />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left"><i className="fa-solid fa-align-left" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center"><i className="fa-solid fa-align-center" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right"><i className="fa-solid fa-align-right" /></ToolbarBtn>
        <div style={styles.divider} />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• List</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. List</ToolbarBtn>
        <div style={styles.divider} />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{`</>`}</ToolbarBtn>
        <div style={styles.divider} />
        <label style={styles.imgBtn} title="Upload image">
          🖼 Image
          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        </label>
        {editor.isActive('image') && (
          <>
            <div style={styles.divider} />
            <ToolbarBtn onClick={() => alignImage('left')} title="Align image left"><i className="fa-solid fa-align-left" /></ToolbarBtn>
            <ToolbarBtn onClick={() => alignImage('center')} title="Align image center"><i className="fa-solid fa-align-center" /></ToolbarBtn>
            <ToolbarBtn onClick={() => alignImage('right')} title="Align image right"><i className="fa-solid fa-align-right" /></ToolbarBtn>
          </>
        )}
      </div>
      <EditorContent editor={editor} style={styles.content} />
    </div>
  );
}

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ ...styles.btn, ...(active ? styles.btnActive : {}) }}
    >
      {children}
    </button>
  );
}

const styles = {
  wrapper: {
    border: '1px solid var(--gray-300)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--white)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    padding: '6px 8px',
    background: 'var(--gray-50)',
    borderBottom: '1px solid var(--gray-200)',
  },
  btn: {
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--gray-600)',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  btnActive: {
    background: 'var(--red-light)',
    color: 'var(--red)',
  },
  imgBtn: {
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--gray-600)',
    cursor: 'pointer',
  },
  divider: {
    width: 1,
    height: 18,
    background: 'var(--gray-200)',
    margin: '0 4px',
  },
  content: {
    padding: '12px 16px',
    minHeight: 440,
    resize: 'vertical',
    overflowY: 'auto',
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--gray-800)',
  },
};
