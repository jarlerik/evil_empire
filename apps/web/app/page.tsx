import React from "react";
import { getPage } from "./service";
import Text from "./components/Text";

export default async function Home() {
  const page = await getPage();
  return (
    <div>
      <Text value={page.content} />
    </div>
  );
}
