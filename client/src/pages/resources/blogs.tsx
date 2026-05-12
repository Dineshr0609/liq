import { PublicNavigation } from "@/components/public-navigation";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Blog } from "@shared/schema";
import {
  Calendar, Clock, ArrowRight, BookOpen, ArrowLeft
} from "lucide-react";

function BlogPost({ slug }: { slug: string }) {
  const { data: post, isLoading } = useQuery<Blog>({
    queryKey: ['/api/blogs', slug],
    queryFn: () => fetch(`/api/blogs/${slug}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <PublicNavigation />
        <div className="pt-32 pb-16 px-4">
          <div className="container mx-auto max-w-3xl text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto" />
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!post || !post.title) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <PublicNavigation />
        <div className="pt-32 pb-16 px-4">
          <div className="container mx-auto max-w-3xl text-center py-12">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Post Not Found</h1>
            <Link href="/resources/blogs">
              <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Blog</Button>
            </Link>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicNavigation />
      <article className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <Link href="/resources/blogs">
            <Button variant="ghost" className="mb-6 text-orange-600 hover:text-orange-700" data-testid="button-back-to-blog">
              <ArrowLeft className="w-4 h-4 mr-2" />Back to Blog
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4 text-sm text-slate-500 dark:text-slate-400">
            {post.category && <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 px-3 py-1 rounded-full text-xs font-medium">{post.category}</span>}
            {post.publishedAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(post.publishedAt).toLocaleDateString()}</span>}
            {post.readTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTime}</span>}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">{post.title}</h1>
          {post.author && <p className="text-slate-500 dark:text-slate-400 mb-8">By {post.author}</p>}
          <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-orange-600" dangerouslySetInnerHTML={{ __html: post.content || '' }} />
        </div>
      </article>
      <PublicFooter />
    </div>
  );
}

export default function BlogsPage() {
  const params = useParams<{ slug?: string }>();

  if (params.slug) {
    return <BlogPost slug={params.slug} />;
  }

  const { data: posts, isLoading } = useQuery<Blog[]>({
    queryKey: ['/api/blogs/published'],
    queryFn: () => fetch('/api/blogs/published').then(r => r.json()),
  });

  const featured = posts?.find(p => p.isFeatured);
  const regularPosts = posts?.filter(p => !p.isFeatured) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <PublicNavigation />

      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <BookOpen className="h-4 w-4" />
            Resource Center
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
            Blog & Insights
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            Stay updated with the latest trends in contract management, compliance,
            and AI-native finance automation.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto" />
        </div>
      ) : (
        <>
          {featured && (
            <section className="py-8 px-4">
              <div className="container mx-auto max-w-6xl">
                <Card className="overflow-hidden bg-gradient-to-r from-orange-700 to-amber-800 text-white">
                  <div className="p-8 md:p-12">
                    <span className="inline-block bg-white/20 text-white text-sm font-medium px-3 py-1 rounded-full mb-4">Featured</span>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{featured.title}</h2>
                    <p className="text-lg text-white/90 mb-6 max-w-2xl">{featured.excerpt}</p>
                    <div className="flex items-center gap-6 text-white/80 text-sm mb-6">
                      {featured.publishedAt && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(featured.publishedAt).toLocaleDateString()}</span>}
                      {featured.readTime && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{featured.readTime}</span>}
                    </div>
                    <Link href={`/resources/blogs/${featured.slug}`}>
                      <Button variant="secondary" className="bg-white text-orange-700 hover:bg-slate-100" data-testid="button-read-featured">
                        Read Article <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            </section>
          )}

          <section className="py-16 px-4">
            <div className="container mx-auto max-w-6xl">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Latest Articles</h2>
              {regularPosts.length === 0 && !featured ? (
                <div className="text-center py-12 text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-lg">No blog posts published yet. Check back soon!</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {regularPosts.map((post) => (
                    <Link key={post.id} href={`/resources/blogs/${post.slug}`}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer group h-full" data-testid={`card-blog-${post.id}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <div className="h-10 w-10 bg-gradient-to-br from-orange-600 to-amber-800 rounded-lg flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-white" />
                            </div>
                            {post.category && (
                              <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                                {post.category}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-xl group-hover:text-orange-700 transition-colors">
                            {post.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-slate-600 dark:text-slate-400 mb-4">{post.excerpt}</p>
                          <div className="flex items-center justify-between text-sm text-slate-500">
                            {post.publishedAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(post.publishedAt).toLocaleDateString()}</span>}
                            {post.readTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTime}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="py-16 px-4 bg-slate-50 dark:bg-slate-800/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Subscribe to Our Newsletter</h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">Get the latest insights on contract management and AI automation delivered to your inbox.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <input type="email" placeholder="Enter your email" className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" data-testid="input-newsletter-email" />
            <Button className="bg-gradient-to-r from-orange-700 to-amber-800 text-white px-6" data-testid="button-subscribe">Subscribe</Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
