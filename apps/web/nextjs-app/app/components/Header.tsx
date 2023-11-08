import React from "react";
import { getHeader } from "../service";
import { HeaderItem } from "./HeaderItem";
import styles from "./Header.module.scss";

export default async function Header() {
  const header = await getHeader();
  return (
    <div className={styles.header}>
      {header.map(({ id, text, link }) => {
        return <HeaderItem key={id} link={link} text={text} />;
      })}
    </div>
  );
}
