import React from "react";
import { mapValues, isEqual, groupBy } from "lodash";
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
        padding: 8,
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

let NothingSelected = () => {
  return (
    <div style={{ padding: 20, fontSize: 24 }}>Select a snapshot to start</div>
  );
};

let Title = ({ supertitle, subtitle, title }) => {
  return (
    <Flex column justifyContent="flex-start" shrink={0}>
      {supertitle && <b>{supertitle}</b>}
      {title && <span style={{ fontSize: 24 }}>{title}</span>}
      {subtitle && <b style={{ alignSelf: "flex-end" }}>{subtitle}</b>}
    </Flex>
  );
};

let ChangesPanel = ({ path, live_results }) => {
  if (!path.file || !path.snapshot) {
    return <div>Cool</div>;
  }

  let key = `${path.file}:${path.snapshot}`;
  let live_result_new = live_results[key];

  return (
    <ApiCall
      method="retrieve_snapshot_content"
      data={{ file_path: path.file, snapshot_name: path.snapshot }}
      renderLoading={<div />}
    >
      {({ result: { snapshot, live_result: live_result_old } }) => (
        <ChangesPanelFetched
          path={path}
          snapshot={snapshot}
          live_result={live_result_new ? live_result_new.changes : live_result_old}
        />
      )}
    </ApiCall>
  );
};

let Flex = ({
  column,
  row,
  justifyContent,
  alignItems,
  shrink,
  wrap,
  style,
  ...props
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: column ? "column" : "row",
        flexShrink: shrink,
        flexWrap: wrap,
        justifyContent,
        alignItems,
        ...style,
      }}
      {...props}
    />
  );
};
let Whitespace = ({ height, width }) => {
  return <div style={{ minHeight: height, minWidth: width }} />;
};

let if_selected = (id, filter, if_selected = true, if_not_selected = false) => {
  if (filter.includes(id)) {
    return if_selected;
  } else {
    return if_not_selected;
  }
};

class ChangesPanelFetched extends React.Component {
  state = {
    collection_filter: [],
  }

  render() {
    let { collection_filter } = this.state;
    let { path, snapshot, live_result } = this.props;

    console.log(`snapshot:`, snapshot);
    console.log(`live_result:`, live_result)

    let data = [...snapshot.content, ...(live_result || [])];
    let groups = groupBy(data, (change) => change.collectionName);
    let group_names = Object.keys(groups).filter(
      (x) => x !== "time" && x !== "markers"
    );

    return (
      <Flex column>
        <Whitespace height={20} />

        <Title title={path.snapshot} />

        <Whitespace height={16} />

        <Flex row wrap="wrap" shrink={0}
          style={{
            marginLeft: -10,
            marginRight: -10,
          }}
        >
          {group_names.map((key) => (
            <div
              key={key}
              style={{
                marginLeft: 10,
                marginRight: 10,
                borderRadius: 5,
                padding: 7,
                backgroundColor: if_selected(
                  key,
                  collection_filter,
                  `#aaa`,
                  `#eee`
                ),
                cursor: "pointer",
              }}
              onClick={() => {
                this.setState({
                  collection_filter: if_selected(
                    key,
                    collection_filter,
                    collection_filter.filter((x) => x !== key),
                    [...collection_filter, key]
                  ),
                });
              }}
            >
              {key}
            </div>
          ))}
        </Flex>

        <Flex row>
          <Flex
            column
            // justifyContent
            style={{
              minWidth: 400,
              width: 400,
            }}
          >
            <Whitespace height={20} />
            {path && path.snapshot ? (
              <>
                <Title supertitle="original" />
                <Whitespace height={20} />
                <RenderChanges data={snapshot.content} collection_filter={collection_filter} />
              </>
            ) : (
              <NothingSelected />
            )}
          </Flex>

          <Whitespace width={16} />

          <Flex
            column
            style={{
              minWidth: 400,
              width: 400,
            }}
          >
            <Whitespace height={20} />
            <Title supertitle="live" />
            <Whitespace height={20} />
            {live_result ? (
              isEqual(snapshot.content, live_result) ? (
                <div style={{ textAlign: 'center', padding: 16, backgroundColor: 'rgb(0, 115, 1)', color: 'white' }}>Test matches!</div>
              ) : (
                <RenderChanges data={live_result} original={snapshot.content} collection_filter={collection_filter} />
              )
            ) : (
              <div>
                Test results will flow in here as you run this test in jest
              </div>
            )}
          </Flex>
        </Flex>
      </Flex>
    );
  }
};

class App extends React.Component {
  state = {
    path: selected_file.get(),
    live_results: {},
  };

  componentDidUpdate(_, prevState) {
    if (this.state.path !== prevState.path) {
      selected_file.set(this.state.path);
    }
  }

  render() {
    const { path, live_results } = this.state;

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
              let key = `${data.snapshot_path}:${data.snapshot_name}`;
              this.setState({
                live_results: {
                  ...live_results,
                  [key]: {
                    changes: data.snapshot_data,
                  },
                },
              });
            } else {
              // TODO Save this in the background still
              // .... (Or put it in the background on the server)
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
          <div style={{ width: 300, minWidth: 200, paddingTop: 20 }}>
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
              width: 800 + 16,
              flexShrink: 0,
              overflow: "auto",
              display: "flex",
              flexDirection: "row",
              paddingRight: 10,
            }}
          >
            <ChangesPanel path={path} live_results={live_results} />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
