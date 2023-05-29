import React from "react";

type Props = {
  value: string;
};

const Title = ({ value }: Props) => {
  return <h1>{value}</h1>;
};

export default Title;
