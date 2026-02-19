import { Link } from "react-router-dom";

type AuthShellProps = {
  title: string;
  subtitle: string;
  altText: string;
  altLink: string;
  altLabel: string;
  children: React.ReactNode;
};

export const AuthShell = ({ title, subtitle, altText, altLink, altLabel, children }: AuthShellProps) => {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-title">Dishpatch</h1>
        <h2 className="auth-title">{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
        <p className="auth-alt">
          {altText} <Link to={altLink}>{altLabel}</Link>
        </p>
      </div>
    </div>
  );
};
