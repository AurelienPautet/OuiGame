import { Component } from "react";

// Catches render-time errors anywhere below it so a single thrown error
// doesn't blank the whole app. React requires this to be a class component.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center gap-4 bg-base-300 text-base-content">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="opacity-70">
            The game hit an unexpected error. Reloading usually fixes it.
          </p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
