import React from "react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { Document } from "@contentful/rich-text-types";
type Props = {
  value: Document;
};
const Text = ({ value }: Props) => {
  return <div>{documentToReactComponents(value)}</div>;
};

export default Text;
