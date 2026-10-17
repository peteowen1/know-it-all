import './routeFallback.css';

/** Skeleton lines shown while a lazily loaded screen (or the question bank) arrives. */
export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-label="Loading">
      <span />
      <span />
      <span />
    </div>
  );
}
