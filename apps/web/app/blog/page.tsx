import Title from "../components/Title";
import Text from "../components/Text";
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
          const { id, title, text } = post;

          return (
            <div key={id}>
              <Link href={`/blog/${post.slug}`}>
                <Title value={title} />
              </Link>
              <Text value={text} />
            </div>
          );
        })}
      </div>
    </>
  );
}
