import React from "react";
import JSONTree from "react-json-tree";
import { groupBy } from "lodash";
import moment from "moment";

import { State } from "./MetaComponents";

let TimeChange = ({ change }) => {
  console.log(`change.change:`, change.change)
  let diff = moment(change.change.from).to(moment(change.change.to));
  let better_diff = diff.replace(/^in\s*/, "");

  return (
    <div
      style={{
        paddingTop: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ height: 10, width: 1, backgroundColor: "black" }} />
      <div style={{ height: 5 }} />
      <div>{better_diff} later</div>
      <div style={{ height: 5 }} />
      <div style={{ height: 10, width: 1, backgroundColor: "black" }} />
    </div>
  );
};

let CollectionItem = ({ change, collection_filter, base_time }) => {
  if (change.collectionName === "time") {
    return <TimeChange change={change} />;
  }

  if (change.collectionName === "markers") {
    return (
      <div
        style={{
          backgroundColor: "#ffd7d7",
          fontWeight: 'bold',
          borderRadius: 5,
          padding: 10,
          marginTop: 20,
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
        }}
      >
        {change.change.title}
      </div>
    );
  }

  return (
    <State initialValue={false}>
      {(open, set_open) => (
        <div
          className={`box col-${change.collectionName}`}
          style={{
            marginTop: 20,
            backgroundColor: `rgb(0, 43, 54)`,
            padding: 10,
            borderRadius: 5,
            color: `#eee`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: `rgb(195, 199, 216)`,
              marginBottom: -15,
              textAlign: "right",
            }}
          >
            Day {moment(change.at).dayOfYear() - base_time.dayOfYear() + 1}{" "}
            {moment(change.at).format(`HH:mm`)}
          </div>

          <div
            style={{ textAlign: "center" }}
            onClick={() => {
              set_open(!open);
            }}
          >
            <b>{change.type}</b>
            <span style={{ color: `#777` }}> @ </span>
            <b>{change.collectionName}</b>
          </div>

          {(open ||
            collection_filter.length === 0 ||
            if_selected(change.collectionName, collection_filter)) && (
            <div
              style={{
                wordWrap: `break-word`,
                textAlign: `left`,
              }}
            >
              <JSONTree
                hideRoot
                data={change.change}
                shouldExpandNode={(keyName, data, level) => {
                  return level === 1 && keyName[0] === "body";
                }}
              />
            </div>
          )}
        </div>
      )}
    </State>
  );
};

let if_selected = (id, filter, if_selected = true, if_not_selected = false) => {
  if (filter.includes(id)) {
    return if_selected;
  } else {
    return if_not_selected;
  }
};

class RenderChanges extends React.Component {
  constructor() {
    super();
    this.state = {
      collection_filter: [],
    };
  }

  render() {
    let { collection_filter } = this.state;
    let { data } = this.props;

    let base_time = moment(1500884100000);
    if (data[0].type === "start") {
      base_time = moment(data[0].at);
      data = data.slice(1);
    }

    let groups = groupBy(data, (change) => change.collectionName);
    let group_names = Object.keys(groups).filter(
      (x) => x !== "time" && x !== "markers"
    );

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          {group_names.map((key) => (
            <div
              key={key}
              style={{
                margin: 10,
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
        </div>

        {data.map((change, i) => (
          <CollectionItem
            key={i}
            change={change}
            base_time={base_time}
            collection_filter={collection_filter}
          />
        ))}
      </div>
    );
  }
}

export default RenderChanges;
