import React from 'react';

type IconButtonProps = {
  icon: string; // relative to public/, e.g. 'ui/play.svg'
  alt: string;
  title?: string;
  size?: number; // px
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

const IconButton: React.FC<IconButtonProps> = ({ icon, alt, title, size = 56, pressed, disabled, onClick }) => {
  const href = new URL(icon, document.baseURI).toString();
  return (
    <button
      type="button"
      className="icon-btn"
      title={title ?? alt}
      aria-label={alt}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${href}")`,
      }}
    />
  );
};

export default IconButton;

