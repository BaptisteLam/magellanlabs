import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Link as LinkIcon,
  Eye,
  Save,
  Send,
  ArrowLeft,
  X,
  Loader2,
  Upload,
} from 'lucide-react';

interface BlogEditorProps {
  projectId: string;
  post?: {
    id: string;
    title: string;
    content?: string;
    slug: string;
    status: string;
    featured_image?: string;
    tags?: string[];
  };
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export function BlogEditor({ projectId, post, onSave, onClose }: BlogEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [featuredImage, setFeaturedImage] = useState(post?.featured_image || '');
  const [tags, setTags] = useState<string[]>(post?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full',
        },
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Commencez à écrire votre article...',
      }),
    ],
    content: post?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  // Auto-generate slug from title
  useEffect(() => {
    if (!post && title) {
      const generatedSlug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generatedSlug);
    }
  }, [title, post]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image');
      return null;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Erreur lors de l'upload");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [projectId]);

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await handleImageUpload(file);
    if (url) {
      setFeaturedImage(url);
    }
  };

  const insertImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = await handleImageUpload(file);
        if (url && editor) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      }
    };
    input.click();
  };

  const addLink = () => {
    const url = prompt('URL du lien:');
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async (publish: boolean = false) => {
    if (!title) {
      toast.error('Le titre est requis');
      return;
    }
    if (!slug) {
      toast.error('Le slug est requis');
      return;
    }

    const setter = publish ? setIsPublishing : setIsSaving;
    setter(true);

    try {
      await onSave({
        id: post?.id,
        title,
        content: editor?.getHTML() || '',
        slug,
        status: publish ? 'published' : 'draft',
        featured_image: featuredImage || null,
        published_at: publish ? new Date().toISOString() : null,
      });
      toast.success(publish ? 'Article publié !' : 'Brouillon enregistré');
      if (!post) onClose();
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setter(false);
    }
  };

  if (showPreview) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setShowPreview(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'édition
          </Button>
          <h2 className="text-lg font-semibold">Aperçu</h2>
          <div className="w-[100px]" />
        </div>
        <article className="max-w-3xl mx-auto px-6 py-10">
          {featuredImage && (
            <img src={featuredImage} alt={title} className="w-full h-64 object-cover rounded-xl mb-8" />
          )}
          <h1 className="text-4xl font-bold mb-4">{title || 'Sans titre'}</h1>
          {tags.length > 0 && (
            <div className="flex gap-2 mb-6">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }}
          />
        </article>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)} className="rounded-lg">
            <Eye className="h-4 w-4 mr-2" />
            Aperçu
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="rounded-lg"
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sauvegarder
          </Button>
          <Button 
            onClick={() => handleSave(true)}
            disabled={isPublishing}
            className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20 px-4"
            variant="outline"
          >
            {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Publier
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Featured Image */}
        <div className="mb-6">
          <Label className="text-sm text-muted-foreground mb-2 block">Image de couverture</Label>
          {featuredImage ? (
            <div className="relative group">
              <img src={featuredImage} alt="Cover" className="w-full h-48 object-cover rounded-xl" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setFeaturedImage('')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFeaturedImageUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Cliquez pour ajouter une image</span>
                </>
              )}
            </label>
          )}
        </div>

        {/* Title */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l'article"
          className="text-3xl font-bold border-none shadow-none px-0 focus-visible:ring-0 mb-2"
        />

        {/* Slug */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span>/blog/</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-de-larticle"
            className="w-auto border-none shadow-none px-0 focus-visible:ring-0 text-sm"
          />
        </div>

        {/* Tags */}
        <div className="mb-6">
          <Label className="text-sm text-muted-foreground mb-2 block">Tags</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Ajouter un tag"
              className="w-40"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <Button variant="outline" size="sm" onClick={addTag}>Ajouter</Button>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 mb-4 p-2 bg-muted/50 rounded-lg">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={editor?.isActive('bold') ? 'bg-muted' : ''}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={editor?.isActive('italic') ? 'bg-muted' : ''}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor?.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor?.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={editor?.isActive('bulletList') ? 'bg-muted' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={editor?.isActive('orderedList') ? 'bg-muted' : ''}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={editor?.isActive('blockquote') ? 'bg-muted' : ''}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={insertImage}
            disabled={isUploading}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={addLink}
            className={editor?.isActive('link') ? 'bg-muted' : ''}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Editor */}
        <div className="border rounded-xl bg-card min-h-[400px]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
