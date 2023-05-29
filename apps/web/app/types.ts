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

export type ContentfulPage = {
  contentTypeId: "page";
  fields: {
    id: contentful.EntryFieldTypes.Text;
    content: contentful.EntryFieldTypes.RichText;
    route: contentful.EntryFieldTypes.Text;
  };
};

export type Page = {
  id: string;
  content: Document;
  route: string;
};

export type ContentfulHeader = {
  contentTypeId: "headerItem";
  fields: {
    id: contentful.EntryFieldTypes.Text;
    text: contentful.EntryFieldTypes.Text;
    link: contentful.EntryFieldTypes.Text;
    order: contentful.EntryFieldTypes.Number;
  };
};

export type Header = {
  id: string;
  text: string;
  link: string;
};
