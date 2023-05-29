import Title from "../components/Title";
import Link from "next/link";
import { getPosts } from "../service";

export const revalidate = 60;

export default async function Blog() {
  const posts = await getPosts();
  return (
    <>
      <h1>Blog</h1>
      <div>
        {posts.map((post) => {
          const { id, title } = post;

          return (
            <Link key={id} href={`/blog/${post.slug}`}>
              <Title value={title} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
