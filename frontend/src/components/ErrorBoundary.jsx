import { Component } from "react";
import { useLocation } from "react-router-dom";

/**
 * Sits once, near the top of the app (see main.jsx). Without this, an uncaught exception in ANY
 * component's render - anywhere in the tree, including camera/Virtual Try-On failures, a
 * lazy-loaded 3D model, a product/review that failed to load cleanly, or a broken image - tears
 * down the ENTIRE React app, leaving a blank page. This is invisible unless something is
 * watching for it, which is exactly what this component does: it shows a plain, honest
 * "something went wrong" screen, and logs the real error and component stack to the console so
 * the underlying bug can actually be identified and fixed - errors are never silently hidden.
 *
 * A React error boundary's `hasError` state, once set, normally never clears itself - nothing
 * forces `this.props.children` to render again. Previously this sat once above the entire
 * <App/>/<Routes> tree with nothing driving that re-render, so ANY single render error anywhere
 * permanently wedged the whole site behind this screen until a manual full-page reload.
 * `resetKey` (the current route's pathname, threaded in from RouteAwareErrorBoundary below)
 * fixes that: once the visitor navigates to a different location, this boundary retries
 * rendering its children fresh - a page that crashed once gets a genuinely new mount if
 * revisited, instead of staying frozen. The Reload button stays only as a last resort for an
 * error that keeps recurring on the exact same page.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught a render error:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-cream text-center">
          <div>
            <h1 className="font-display text-2xl text-plum mb-2">Something went wrong</h1>
            <p className="text-plum-light/70 text-sm mb-6 max-w-sm">
              This page ran into an unexpected error. Try going back or heading home - if it keeps happening, please let us know what you were
              doing right before it appeared.
            </p>
            <button onClick={() => window.location.reload()} className="btn-primary text-sm">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Thin wrapper so the class component above (which needs componentDidCatch/getDerivedStateFromError
// - still class-only APIs in React) can key its reset off the current route via the useLocation
// hook, which only works in a function component. This is what main.jsx actually renders; it
// requires being inside <BrowserRouter>, which it already is there.
export default function RouteAwareErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}
