import React from "react";
import * as contentful from "contentful";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";

type Props = {
  value: contentful.EntryFieldTypes.RichText;
};
const Text = ({ value }: Props) => {
  return (
    <div>
      <p>{"value"}</p>
    </div>
  );
};

export default Text;
