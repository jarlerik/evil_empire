import * as contentful from "contentful";
import { Document } from "@contentful/rich-text-types";

export type ContentfulAuthor = {
  contentTypeId: "author";
  fields: {
    name: contentful.EntryFieldTypes.Text;
  };
};

export type ContentfulPost = {
  contentTypeId: "post";
  fields: {
    title: contentful.EntryFieldTypes.Text;
    text: contentful.EntryFieldTypes.RichText;
    author: contentful.EntryFieldTypes.EntryLink<ContentfulAuthor>;
    slug: contentful.EntryFieldTypes.Text;
  };
};

export type Post = {
  id: string;
  title: string;
  text: Document;
  slug: string;
};
