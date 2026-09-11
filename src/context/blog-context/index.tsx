import { createContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useCallback } from 'react';
import { BlogPostType, BlogCategoryType, BlogType } from 'src/types/apps/blog';
import React from 'react';
import { api } from 'src/lib/api';

export interface BlogContextProps {
  posts: BlogPostType[];
  blogCategories: BlogCategoryType[];
  sortBy: string;
  selectedPost: BlogPostType | null;
  isLoading: boolean;
  setPosts: Dispatch<SetStateAction<BlogPostType[]>>;
  setBlogCategories: Dispatch<SetStateAction<BlogCategoryType[]>>;
  setSortBy: Dispatch<SetStateAction<string>>;
  setSelectedPost: Dispatch<SetStateAction<BlogPostType | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  addComment: (postId: number, newComment: BlogType) => void;
  fetchPosts: (page?: number, search?: string, blogCategoryId?: number | null) => Promise<void>;
  fetchBlogCategories: () => Promise<void>;
  deletePost: (id: number) => Promise<void>;
  toggleStatus: (id: number, status: string) => Promise<void>;
  error: null;
}

export const BlogContext = createContext<BlogContextProps>({
  posts: [],
  blogCategories: [],
  sortBy: 'newest',
  selectedPost: null,
  isLoading: true,
  setPosts: () => {},
  setBlogCategories: () => {},
  setSortBy: () => {},
  setSelectedPost: () => {},
  setLoading: () => {},
  addComment: () => {},
  fetchPosts: async () => {},
  fetchBlogCategories: async () => {},
  deletePost: async () => {},
  toggleStatus: async () => {},
  error: null,
});

export const BlogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<BlogPostType[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategoryType[]>([]);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedPost, setSelectedPost] = useState<BlogPostType | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [error] = useState<any>(null);

  const fetchPosts = useCallback(async (page = 1, search = '', blogCategoryId: number | null = null) => {
    setLoading(true);
    try {
      let url = `/admin/posts?page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (blogCategoryId) url += `&blog_category_id=${blogCategoryId}`;
      const res = await api.get(url);
      setPosts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlogCategories = useCallback(async () => {
    try {
      const res = await api.get('/admin/blog-categories');
      setBlogCategories(res.data || []);
    } catch (err) {
      console.error('Failed to fetch blog categories:', err);
    }
  }, []);

  const deletePost = useCallback(async (id: number) => {
    await api.delete(`/admin/posts/${id}`);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleStatus = useCallback(async (id: number, status: string) => {
    const newStatus = status === 'publish' || status === 'active' ? 'inactive' : 'publish';
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    try {
      await api.put(`/admin/posts/${id}`, { status: newStatus });
    } catch (err) {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      console.error('Failed to toggle post status:', err);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchBlogCategories();
  }, [fetchPosts, fetchBlogCategories]);

  const addComment = (postId: number, newComment: BlogType) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, comments: [newComment, ...(post.comments || [])] } : post
      )
    );
  };

  const value: BlogContextProps = {
    posts,
    blogCategories,
    sortBy,
    selectedPost,
    isLoading,
    setPosts,
    setBlogCategories,
    setSortBy,
    setSelectedPost,
    setLoading,
    addComment,
    fetchPosts,
    fetchBlogCategories,
    deletePost,
    toggleStatus,
    error,
  };

  return <BlogContext.Provider value={value}>{children}</BlogContext.Provider>;
};
