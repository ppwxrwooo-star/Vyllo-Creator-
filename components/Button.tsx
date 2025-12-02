import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'red';
  isLoading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  icon,
  className = '',
  size = 'md',
  disabled,
  ...props 
}) => {
  
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 rounded-pill";
  
  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base"
  };

  const variants = {
    primary: "bg-vyllo-primary text-white hover:bg-black border border-transparent shadow-sm",
    secondary: "bg-vyllo-light text-vyllo-primary hover:bg-[#dcdcdc] border border-transparent",
    ghost: "bg-transparent text-vyllo-primary hover:bg-vyllo-light",
    red: "bg-vyllo-red text-white hover:bg-[#ad081b] shadow-sm"
  };

  return (
    <button 
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full mr-1"></div>
      ) : icon}
      {children}
    </button>
  );
};