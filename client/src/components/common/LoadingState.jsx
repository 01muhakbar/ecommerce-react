import "./LoadingState.css";

export default function LoadingState({ message = "Loading..." }) {
  return <div className="loading-state">{message}</div>;
}
