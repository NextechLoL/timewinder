import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#817784' }}>
          <p style={{ fontSize: '16px', fontWeight: 600 }}>Something went wrong rendering this view.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '12px',
              padding: '8px 20px',
              borderRadius: '20px',
              border: '1px solid #817784',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui',
              fontSize: '13px',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
