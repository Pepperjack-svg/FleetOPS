import React from "react";
import clsx from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  className,
  children,
  ...props
}) => {
  const base =
    "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none";

  const styles = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    secondary: "bg-neutral-800 hover:bg-neutral-700 text-gray-200",
    outline:
      "border border-neutral-700 text-gray-300 hover:bg-neutral-800 hover:text-white",
  };

  return (
    <button className={clsx(base, styles[variant], className)} {...props}>
      {children}
    </button>
  );
};
