import { OrderFilterPaths } from "contentful";
import client from "./contentfulClient";
import {
  ContentfulHeader,
  ContentfulPage,
  ContentfulPost,
  Header,
  Page,
  Post,
} from "./types";

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

export async function getPage(route = "home"): Promise<Page> {
  const res = await client.getEntries<ContentfulPage>({
    content_type: "page",
    "fields.route": route,
  });

  const page = res.items[0];

  return {
    id: page.sys.id,
    content: page.fields.content,
    route: page.fields.route,
  };
}

export async function getHeader() {
  const res = await client.getEntries<ContentfulHeader>({
    content_type: "headerItem",
    order: ["fields.order"],
  });

  const header = res.items.reduce((acc: Header[], item) => {
    const {
      fields: { id, text, link },
    } = item;
    acc.push({ id, text, link });
    return acc;
  }, []);
  return header;
}
