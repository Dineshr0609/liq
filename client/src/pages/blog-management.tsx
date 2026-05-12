import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TLink from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import type { Blog } from "@shared/schema";
import {
  Plus, Edit, Trash2, Eye, FileText, Calendar, Clock,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Quote, Code, ImageIcon, Link2,
  Heading1, Heading2, Heading3, Undo, Redo, Highlighter,
  Globe, PenLine, Search, X
} from "lucide-react";

const CATEGORIES = ["AI & Technology", "Compliance", "Case Study", "Audit", "Product Updates", "Industry Insights", "Best Practices", "General"];

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function RichTextEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TLink.configure({ openOnClick: false }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your blog post...' }),
      Highlight,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[300px] focus:outline-none px-4 py-3',
      },
    },
  });

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const ToolbarButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${active ? 'bg-slate-200 dark:bg-slate-700 text-orange-600' : 'text-slate-600 dark:text-slate-400'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border-b">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="w-4 h-4" /></ToolbarButton>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 className="w-4 h-4" /></ToolbarButton>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight"><Highlighter className="w-4 h-4" /></ToolbarButton>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight className="w-4 h-4" /></ToolbarButton>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List"><List className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List"><ListOrdered className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block"><Code className="w-4 h-4" /></ToolbarButton>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Insert Link"><Link2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={addImage} title="Insert Image"><ImageIcon className="w-4 h-4" /></ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export default function BlogManagement() {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [previewBlog, setPreviewBlog] = useState<Blog | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState({
    title: '', slug: '', excerpt: '', content: '', category: 'General',
    author: 'LicenseIQ Team', readTime: '', isFeatured: false,
    status: 'draft' as string, metaTitle: '', metaDescription: '', tags: [] as string[],
  });

  const { data: blogsList, isLoading } = useQuery<Blog[]>({ queryKey: ['/api/blogs'] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/blogs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ title: "Blog post created" });
      closeEditor();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/blogs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ title: "Blog post updated" });
      closeEditor();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/blogs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ title: "Blog post deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingBlog(null);
    setFormData({ title: '', slug: '', excerpt: '', content: '', category: 'General', author: 'LicenseIQ Team', readTime: '', isFeatured: false, status: 'draft', metaTitle: '', metaDescription: '', tags: [] });
  };

  const openNew = () => {
    setEditingBlog(null);
    setFormData({ title: '', slug: '', excerpt: '', content: '', category: 'General', author: 'LicenseIQ Team', readTime: '', isFeatured: false, status: 'draft', metaTitle: '', metaDescription: '', tags: [] });
    setEditorOpen(true);
  };

  const openEdit = (blog: Blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title || '', slug: blog.slug || '', excerpt: blog.excerpt || '', content: blog.content || '',
      category: blog.category || 'General', author: blog.author || 'LicenseIQ Team',
      readTime: blog.readTime || '', isFeatured: blog.isFeatured || false,
      status: blog.status || 'draft', metaTitle: blog.metaTitle || '',
      metaDescription: blog.metaDescription || '', tags: blog.tags || [],
    });
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const slug = formData.slug || generateSlug(formData.title);
    const payload = {
      ...formData,
      slug,
      publishedAt: formData.status === 'published' ? new Date().toISOString() : null,
    };
    if (editingBlog) {
      updateMutation.mutate({ id: editingBlog.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredBlogs = (blogsList || []).filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery && !b.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusColor = (s: string | null) => {
    if (s === 'published') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'draft') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-slate-100 text-slate-600';
  };

  if (editorOpen) {
    return (
      <MainLayout title={editingBlog ? 'Edit Blog Post' : 'New Blog Post'} description="Create and manage blog content">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={closeEditor} data-testid="button-back-to-list">← Back</Button>
            <h1 className="text-2xl font-bold" data-testid="text-editor-title">{editingBlog ? 'Edit Blog Post' : 'New Blog Post'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}>
              <SelectTrigger className="w-32" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-orange-600 hover:bg-orange-700" data-testid="button-save-blog">
              <PenLine className="w-4 h-4 mr-2" />
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Post"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <Input
              placeholder="Post Title *"
              value={formData.title}
              onChange={(e) => {
                const title = e.target.value;
                setFormData(f => ({ ...f, title, slug: f.slug || generateSlug(title) }));
              }}
              className="text-xl font-semibold h-12"
              data-testid="input-blog-title"
            />
            <Textarea
              placeholder="Write a compelling excerpt (shown on blog listing)..."
              value={formData.excerpt}
              onChange={(e) => setFormData(f => ({ ...f, excerpt: e.target.value }))}
              rows={2}
              className="resize-none"
              data-testid="input-blog-excerpt"
            />
            <RichTextEditor
              content={formData.content}
              onChange={(html) => setFormData(f => ({ ...f, content: html }))}
            />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Post Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">URL Slug</label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData(f => ({ ...f, slug: e.target.value }))}
                    placeholder="auto-generated-from-title"
                    className="h-9 text-sm font-mono"
                    data-testid="input-blog-slug"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Author</label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData(f => ({ ...f, author: e.target.value }))}
                    className="h-9 text-sm"
                    data-testid="input-blog-author"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Read Time</label>
                  <Input
                    value={formData.readTime}
                    onChange={(e) => setFormData(f => ({ ...f, readTime: e.target.value }))}
                    placeholder="5 min read"
                    className="h-9 text-sm"
                    data-testid="input-blog-readtime"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData(f => ({ ...f, isFeatured: e.target.checked }))}
                    className="rounded"
                    data-testid="checkbox-featured"
                  />
                  <label className="text-sm">Featured Post</label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">SEO Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Meta Title</label>
                  <Input
                    value={formData.metaTitle}
                    onChange={(e) => setFormData(f => ({ ...f, metaTitle: e.target.value }))}
                    placeholder="SEO title (optional)"
                    className="h-9 text-sm"
                    data-testid="input-meta-title"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Meta Description</label>
                  <Textarea
                    value={formData.metaDescription}
                    onChange={(e) => setFormData(f => ({ ...f, metaDescription: e.target.value }))}
                    placeholder="SEO description (optional)"
                    rows={2}
                    className="text-sm resize-none"
                    data-testid="input-meta-description"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Blog Management" description="Create and manage blog posts for the public website"
      actions={
        <Button onClick={openNew} className="bg-orange-600 hover:bg-orange-700" data-testid="button-new-blog">
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
      }
    >
      <div className="max-w-6xl mx-auto">

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-blogs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9" data-testid="select-filter-status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filteredBlogs.length} post{filteredBlogs.length !== 1 ? 's' : ''}</Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading blog posts...</div>
      ) : filteredBlogs.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No blog posts yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first blog post to get started</p>
            <Button onClick={openNew} className="bg-orange-600 hover:bg-orange-700" data-testid="button-new-blog-empty">
              <Plus className="w-4 h-4 mr-2" /> Create Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBlogs.map((blog) => (
            <div key={blog.id}>
              <Card className="hover:shadow-md transition-shadow" data-testid={`card-blog-${blog.id}`}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate">{blog.title}</h3>
                      {blog.isFeatured && <Badge className="bg-orange-100 text-orange-800 text-[10px]">Featured</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{blog.excerpt || 'No excerpt'}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className={`text-[10px] ${statusColor(blog.status)}`}>{blog.status}</Badge>
                      <span>{blog.category}</span>
                      {blog.readTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{blog.readTime}</span>}
                      {blog.publishedAt && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(blog.publishedAt).toLocaleDateString()}</span>}
                      <span>{blog.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {blog.status === 'published' && (
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/resources/blogs/${blog.slug}`, '_blank')} data-testid={`button-view-${blog.id}`}>
                        <Globe className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setPreviewBlog(previewBlog?.id === blog.id ? null : blog)} className={previewBlog?.id === blog.id ? 'text-orange-600' : ''} data-testid={`button-preview-${blog.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(blog)} data-testid={`button-edit-${blog.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => {
                      if (confirm('Delete this blog post?')) deleteMutation.mutate(blog.id);
                    }} data-testid={`button-delete-${blog.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {previewBlog?.id === blog.id && (
                <Card className="mt-1 border-orange-200 dark:border-orange-800 bg-slate-50 dark:bg-slate-900">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">{previewBlog.title}</h3>
                      <Button variant="ghost" size="sm" onClick={() => setPreviewBlog(null)} data-testid="button-close-preview">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                      {previewBlog.category && <Badge variant="outline" className="text-[10px]">{previewBlog.category}</Badge>}
                      {previewBlog.author && <span>By {previewBlog.author}</span>}
                      {previewBlog.readTime && <span>{previewBlog.readTime}</span>}
                      {previewBlog.publishedAt && <span>{new Date(previewBlog.publishedAt).toLocaleDateString()}</span>}
                    </div>
                    <Separator className="mb-4" />
                    <ScrollArea className="max-h-[400px]">
                      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewBlog.content || '<p>No content</p>' }} />
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </MainLayout>
  );
}
