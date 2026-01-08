import "./ErrorState.css";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <div>{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
