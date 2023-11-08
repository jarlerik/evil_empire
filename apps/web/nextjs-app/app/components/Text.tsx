import React from "react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { Document, MARKS } from "@contentful/rich-text-types";
type Props = {
  value: Document;
};

const Pre = ({ children }: { children: React.ReactNode }) => (
  <pre>{children}</pre>
);

const options = {
  renderMark: {
    [MARKS.CODE]: (text: React.ReactNode) => <Pre>{text}</Pre>,
  },
};

const Text = ({ value }: Props) => {
  return <div>{documentToReactComponents(value, options)}</div>;
};

export default Text;
