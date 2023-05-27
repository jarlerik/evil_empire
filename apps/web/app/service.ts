import client from "./contentfulClient";
import { ContentfulPost, Post } from "./types";

export async function getPosts() {
  const res = await client.getEntries<ContentfulPost>({
    content_type: "post",
  });

  const posts = res.items.reduce((acc: Post[], item) => {
    const {
      fields: { title, text, slug },
      sys: { id },
    } = item;
    acc.push({ id, title, text, slug });
    return acc;
  }, []);
  return posts;
}

export async function getPost(slug: string): Promise<Post> {
  const res = await client.getEntries<ContentfulPost>({
    content_type: "post",
    "fields.slug": slug,
  });

  const post = res.items[0];

  return {
    id: post.sys.id,
    title: post.fields.title,
    text: post.fields.text,
    slug: post.fields.slug,
  };
}
