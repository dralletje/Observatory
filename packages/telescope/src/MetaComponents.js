// @flow

import React from 'react';
import shallowEqual from 'shallowequal';

// Still not sure what I should call this
export class EmptyC extends React.Component {
  render() {
    return null;
  }
}

export class State extends React.Component {
  // props: {
  //   initialValue: any,
  //   children?: (value: any, update: (value: any) => void) => React$Element<*>,
  // };
  constructor(props) {
    super(props)
    this.state = {
      thing: this.props.initialValue,
    };
  }
  render() {
    if (!this.props.children) return;

    return this.props.children(this.state.thing, valueOrFn => {
      if (typeof valueOrFn === 'function') {
        this.setState(state => {
          return { thing: valueOrFn(state.thing) };
        });
      } else {
        this.setState({ thing: valueOrFn });
      }
    });
  }
}

export class Compose extends React.Component {
  // props: {
  //   [key: string]: (children: () => React$Element<*>) => React$Element<*>,
  //   children?: () => React$Element<*>,
  // };

  render() {
    const { children, ...chain } = this.props;

    const entries = Object.entries(chain);
    const fn = entries.reduce((acc, [key, wrapFn]) => {
      // $FlowFixMe
      return props => wrapFn(value => acc({ ...props, [key]: value }));
    }, props => (children ? children(props) : null));

    return fn();
  }
}

// type TCleanUp = () => mixed;
export class Lifecycle extends React.Component {
  // cleanup: ?TCleanUp;
  //
  // props: {
  //   componentDidMount?: () => TCleanUp | mixed,
  // };

  componentDidMount() {
    if (this.props.componentDidMount) {
      let cleanup = this.props.componentDidMount();
      if (typeof cleanup === 'function') {
        this.cleanup = cleanup;
      }
    }
  }

  componentWillUnmount() {
    if (this.cleanup) this.cleanup();
  }

  render() {
    return this.props.children || null;
  }
}

type TOnChangeProps = {
  values: any,
  onUpdate: (props: any) => mixed,
};
export class OnChange<T: any> extends React.Component {
  // props: TOnChangeProps;

  componentDidMount() {
    this.props.onUpdate(this.props.values);
  }

  componentDidUpdate(prevProps: TOnChangeProps) {
    if (!shallowEqual(prevProps.values, this.props.values)) {
      this.props.onUpdate(this.props.values);
    }
  }

  render() {
    return null;
  }
}
