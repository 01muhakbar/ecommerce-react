import React from 'react';

export default class RouteError extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  constructor(props:any){
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(e:any){
    return { hasError: true, msg: String(e?.message || e) };
  }

  componentDidCatch(err:any, info:any){
    console.error('Route error caught by ErrorBoundary:', err, info);
  }

  render(){
    if(this.state.hasError){
      return <div style={{padding:16, margin: 16, border: '1px solid red', borderRadius: 8, backgroundColor: '#fff5f5'}}>
        <h2 style={{color: '#c53030'}}>Unexpected Application Error</h2>
        <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{this.state.msg}</pre>
      </div>;
    }
    return this.props.children;
  }
}
