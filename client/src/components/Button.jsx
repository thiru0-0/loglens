export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="btn-spinner" />}
      {!loading && icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}
