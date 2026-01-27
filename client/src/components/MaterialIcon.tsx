import React from 'react';

type MaterialIconProps = {
  name: string;
  size?: number;
  className?: string;
  title?: string;
  ariaHidden?: boolean;
};

const MaterialIcon: React.FC<MaterialIconProps> = ({ name, size, className, title, ariaHidden = true }) => (
  <span
    className={`material-symbols-outlined${className ? ` ${className}` : ''}`}
    style={size ? { fontSize: size } : undefined}
    aria-hidden={ariaHidden}
    title={title}
  >
    {name}
  </span>
);

export default MaterialIcon;
