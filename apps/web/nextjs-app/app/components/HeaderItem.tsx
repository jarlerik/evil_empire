import React from "react";
import Link from "next/link";
import styles from "./Header.module.scss";

interface Props {
  text: string;
  link: string;
}

export function HeaderItem({ text, link = "" }: Props) {
  return (
    <Link className={styles.headerItem} href={`/${link}`}>
      {text}
    </Link>
  );
}
