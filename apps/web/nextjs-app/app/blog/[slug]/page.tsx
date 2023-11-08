import React from "react";
import Title from "../../components/Title";
import Text from "../../components/Text";
import { getPost } from "../../service";

type Props = {
  params: {
    slug: string;
  };
};

const Page = async ({ params }: Props) => {
  const { title, text } = await getPost(params.slug);

  return (
    <div>
      <Title value={title} />
      <Text value={text} />
    </div>
  );
};

export default Page;
