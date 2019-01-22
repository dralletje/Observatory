import React from "react";
import { mapValues, isEqual } from "lodash";
import io from "socket.io-client";

import RenderChanges from "./RenderChanges.js";
// let jest_parser = require("./jest-parser.js");

let client = io();

class EventListener extends React.Component {
  componentDidMount() {
    this.handler = (data) => {
      this.props.handler(data);
    };
    client.on(this.props.event, this.handler);
  }

  componentWillUnmount() {
    client.off(this.props.event, this.handler);
  }

  render() {
    return null;
  }
}

const scoped_storage = (namespace: string) => {
  return {
    get: (): mixed => {
      const result = window.localStorage.getItem(namespace);
      if (typeof result === "string") {
        return JSON.parse(result);
      } else {
        return null;
      }
    },
    set: (value: mixed) => {
      if (value === null) {
        window.localStorage.removeItem(namespace);
      } else {
        window.localStorage.setItem(namespace, JSON.stringify(value));
      }
    },
  };
};

export const test_data_storage = scoped_storage("test_data");
const selected_file = scoped_storage("file");

let api_call = async (method, data = {}) => {
  let response = await fetch("/api", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method, data }),
  });
  let result = await response.json();

  if (result.success === false) {
    // prettier-ignore
    throw new Error(`Server error on method '${method}': ${result.message}`);
  }

  return result.data;
};

class ApiCall extends React.Component {
  state = {
    loading: true,
    result: null,
    error: null,
  };

  async do_fetch() {
    let { method, data } = this.props;
    this.setState({ loading: true });
    try {
      let result = await api_call(this.props.method, this.props.data);
      if (this.props.method === method && isEqual(data, this.props.data)) {
        this.setState({ loading: false, result: result });
      }
    } catch (err) {
      if (this.props.method === method && isEqual(data, this.props.data)) {
        if (this.props.try === true) {
          this.setState({ loading: false, error: err });
        } else {
          throw err;
        }
      }
    }
  }

  componentDidMount() {
    this.do_fetch();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.method !== prevProps.method ||
      !isEqual(prevProps.data, this.props.data)
    ) {
      this.do_fetch();
    }
  }

  render() {
    let { children, renderLoading, try: doTry } = this.props;
    let { loading, result, error } = this.state;

    if (loading === true && renderLoading) {
      return renderLoading;
    }

    if (error != null && doTry === true) {
      throw error;
    }

    return children({ loading, error, result });
  }
}

let BrutalButton = ({ selected, onClick, children }) => {
  return (
    <div
      style={{
        userSelect: "none",
        cursor: "pointer",
        padding: 5,
        paddingLeft: 16,
        paddingRight: 16,
        borderRadius: 5,
        backgroundColor: selected ? "rgb(0, 43, 54)" : "white",
        color: selected ? "white" : "rgb(0, 43, 54)",
      }}
      onClick={() => {
        onClick();
      }}
    >
      {children}
    </div>
  );
};

class Tree extends React.Component {
  render() {
    let { items, onSelected, selected, renderNoItems } = this.props;

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((item) => (
          <div key={item.value}>
            <BrutalButton
              selected={item.value === selected}
              onClick={() => {
                onSelected(item);
              }}
              children={item.title}
            />
            <div style={{ minHeight: 8 }} />
            {item.children && item.value === selected && (
              <div style={{ marginLeft: 32 }}>{item.children}</div>
            )}
          </div>
        ))}
      </div>
    );
  }
}

let Snapshots = ({ in: file, onSelected, selected }) => {
  return (
    <ApiCall
      method="list_snapshots_in_file"
      data={{ file_path: file }}
      renderLoading={<div />}
    >
      {({ result: { snapshots } }) => (
        <Tree
          items={snapshots.map((snapshot_name) => {
            return {
              title: snapshot_name,
              value: snapshot_name,
            };
          })}
          onSelected={({ value }) => onSelected(value)}
          selected={selected}
          renderNoItems={<div>No Items</div>}
        />
      )}
    </ApiCall>
  );
};

class SnapshotBrowser extends React.Component {
  render() {
    let { selected, onSelected } = this.props;

    return (
      <ApiCall
        method="list_files"
        renderLoading={
          <div
            style={{ display: "flex", flexDirection: "column", fontSize: 24 }}
          >
            Please hold tight..
          </div>
        }
      >
        {({ result: { files } }) => (
          <Tree
            items={files.map((file) => {
              return {
                value: file,
                title: file.replace(/__tests__\/|__snapshots__\//g, ""),
                children: (
                  <Snapshots
                    in={file}
                    selected={selected && selected.snapshot}
                    onSelected={(snapshot_name) => {
                      onSelected({ file: file, snapshot: snapshot_name });
                    }}
                  />
                ),
              };
            })}
            selected={selected && selected.file}
            onSelected={({ value }) => {
              onSelected({ file: value, snapshot: null });
            }}
            renderNoItems={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 24,
                }}
              >
                No snapshot files found in the specified root directory :(
              </div>
            }
          />
        )}
      </ApiCall>
    );
  }
}

let RenderSnapshot = ({ path }) => {
  return (
    <ApiCall
      method="retrieve_snapshot_content"
      data={{ file_path: path.file, snapshot_name: path.snapshot }}
      renderLoading={<div />}
    >
      {({ result: { snapshot } }) => <RenderChanges data={snapshot.content} />}
    </ApiCall>
  );
};

let NothingSelected = () => {
  return (
    <div style={{ padding: 20, fontSize: 24 }}>Select a snapshot to start</div>
  );
};

let Title = ({ supertitle, subtitle, title }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {supertitle && <b>{supertitle}</b>}
      {title && <span style={{ fontSize: 24 }}>{title}</span>}
      {subtitle && <b style={{ alignSelf: "flex-end" }}>{subtitle}</b>}
    </div>
  );
};

class App extends React.Component {
  state = {
    path: selected_file.get(),
    live_result: null,
  };

  componentDidUpdate(_, prevState) {
    if (this.state.path !== prevState.path) {
      selected_file.set(this.state.path);
    }
  }

  render() {
    const { path, live_result } = this.state;

    console.log(`path:`, path);

    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <EventListener
          event="live_test_result"
          handler={(data) => {
            if (
              data.snapshot_path === path.file &&
              data.snapshot_name === path.snapshot
            ) {
              console.log(`data:`, data);
              this.setState({
                live_result: { changes: data.snapshot_data },
              });
            } else {
              // prettier-ignore
              console.log('Live result came in, but was not current file:', data);
            }
          }}
        />

        <div
          style={{
            width: "100%",
            backgroundColor: "rgb(0, 43, 54)",
            paddingTop: 10,
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <h1 style={{ color: "white" }}>Test Viewer</h1>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 400, minWidth: 300, paddingTop: 20 }}>
            <SnapshotBrowser
              selected={path}
              onSelected={(new_path) => {
                this.setState({ path: new_path });
              }}
            />
          </div>

          <div style={{ width: 20 }} />

          <div
            style={{
              flexShrink: 0,
              overflow: "auto",
              display: "flex",
              flexDirection: "row",
              paddingRight: 10,
            }}
          >
            <div
              style={{
                width: 400,
              }}
            >
              <div style={{ minHeight: 20 }} />
              {path && path.snapshot ? (
                <>
                  <Title supertitle="original" title={path.snapshot} />
                  <RenderSnapshot path={path} />
                </>
              ) : (
                <NothingSelected />
              )}
            </div>

            <div style={{ minWidth: 16 }} />

            <div
              style={{
                width: 400,
              }}
            >
              <div style={{ minHeight: 20 }} />
              <Title supertitle="live" title="Live test result" />
              {live_result ? (
                <RenderChanges data={live_result.changes} />
              ) : (
                <div>
                  Test results will flow in here as you run this test in jest
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ height: 50 }} />
      </div>
    );
  }
}

export default App;
