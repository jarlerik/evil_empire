import styles from "./page.module.scss";
import * as contentful from "contentful";
import Title from "./components/Title";
import Text from "./components/Text";

type AuthorReferenceType = {
  contentTypeId: "author";
  fields: {
    name: contentful.EntryFieldTypes.Text;
  };
};

type PostType = {
  contentTypeId: "post";
  fields: {
    title: contentful.EntryFieldTypes.Text;
    text: contentful.EntryFieldTypes.RichText;
    author: contentful.EntryFieldTypes.EntryLink<AuthorReferenceType>;
  };
};

const client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE || "",
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || "",
});

async function getPosts() {
  const res = await client.getEntries<PostType>({
    content_type: "post",
  });

  return {
    posts: res.items,
  };
}

export const revalidate = 60;

export default async function Home() {
  const posts = await getPosts();
  return (
    <div className={styles.root}>
      <h1>Blog</h1>
      <div>
        {posts.posts.map((post) => {
          const {
            sys: { id },
            fields: { title, text },
          } = post;

          return (
            <div key={id}>
              <Title value={title} />
              <Text value={text} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
