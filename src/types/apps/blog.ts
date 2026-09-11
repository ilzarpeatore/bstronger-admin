
export type Profile = {
  id?: string | number;
  avatar?: string;
  name?: string;
  time?: string;
};

export interface BlogType {
  id?: string;
  profile?: Profile;
  time?: Date;
  comment?: string;
  replies?: BlogType[];
}

export interface BlogCategoryType {
  id?: number;
  title?: string;
  slug?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPostType {
  id?: number | any;
  title?: string;
  slug?: string;
  content?: string;
  description?: string;
  bibliography?: string;
  coverImg?: string;
  post_image?: string;
  datetime?: string;
  createdAt?: Date;
  view?: number;
  share?: number;
  category?: string;
  category_ids?: number[];
  category_name?: { id: number; title: string }[];
  blog_category_id?: number | null;
  blog_category?: { id: number; title: string; slug: string } | null;
  tags_id?: number[];
  tags_name?: { id: number; title: string }[];
  is_featured?: boolean;
  featured?: boolean;
  author?: Profile;
  comments?: BlogType[];
  published?: boolean;
  status?: string;
}
