import React from 'react';
import MaterialIcon from './MaterialIcon';

type IconButtonProps = {
  icon: string; // Material Symbols name
  alt: string;
  title?: string;
  size?: number; // px
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

const IconButton: React.FC<IconButtonProps> = ({ icon, alt, title, size = 56, pressed, disabled, onClick }) => {
  return (
    <button
      type="button"
      className="icon-btn"
      title={title ?? alt}
      aria-label={alt}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <MaterialIcon name={icon} size={Math.max(16, Math.round(size * 0.45))} ariaHidden />
    </button>
  );
};

export default IconButton;
