import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Go to Homepage</Link>
    </div>
  );
};

export default NotFoundPage;
