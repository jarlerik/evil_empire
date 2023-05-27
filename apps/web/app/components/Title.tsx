import React from "react";

type Props = {
  value: string;
};

const Title = ({ value }: Props) => {
  return (
    <div>
      <h1>{value}</h1>
    </div>
  );
};

export default Title;
