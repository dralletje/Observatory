import React from "react";
import JSONTree from "react-json-tree";
import { groupBy, isEqual } from "lodash";
import moment from "moment";

import "moment-timezone";

import { State } from "./MetaComponents";

let TimeChange = ({ change }) => {
  let diff = moment(change.change.from).to(moment(change.change.to));
  let better_diff = diff.replace(/^in\s*/, "");

  return (
    <div
      style={{
        paddingBottom: 20,
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
    if (change.type === 'start') {
      return (
        <div
          style={{
            border: "solid 2px black",
            borderRadius: 5,
            padding: 10,
            marginBottom: 20,
          }}
        >
          <b>{moment(change.at).tz(base_time.tz()).format("dddd, MMMM Do YYYY, h:mm:ss a")}</b><br />
          in timezone <b>{change.change.timezone}</b>
        </div>
      );
    }
    if (change.type === 'forward') {
      return <TimeChange change={change} />;
    }
  }

  if (change.collectionName === "markers") {
    return (
      <div
        style={{
          border: "solid 2px black",
          fontWeight: 'bold',
          borderRadius: 5,
          padding: 10,
          marginBottom: 20,
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
            marginBottom: 20,
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
            Day {moment(change.at).tz(base_time.tz()).dayOfYear() - base_time.dayOfYear() + 1}{" "}
            {moment(change.at).tz(base_time.tz()).format(`HH:mm`)}
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
                  return (
                    (level === 1 && keyName[0] === "body")
                    || (level === 1 && Object.keys(data).length <= 2)
                  );
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
  render() {
    let { data, original, collection_filter } = this.props;

    let timezone = 'GMT';
    let base_time = moment(1500884100000).tz(timezone);
    if (data[0].collectionName === 'time' && data[0].type === "start") {
      timezone = (data[0].change && data[0].change.timezone) || 'GMT';
      base_time = moment(data[0].at).tz(timezone);
    }

    if (original && !isEqual(original[0], data[0])) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: 'rgb(144, 0, 0)', padding: 12, color: 'white', textAlign: 'center', marginBottom: 20 }}>
            <b>!! Timezone or start date changed !!</b><br />
            Showing diff here is going to be hard.
          </div>

          <CollectionItem
            change={data[0]}
            base_time={base_time}
            collection_filter={[]}
          />
        </div>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        {data.map((change, i) => (
          <div
            key={i}
            style={{
              opacity: original && isEqual(change, original[i]) ? 0.1 : 1,
            }}
          >
            <CollectionItem
              change={change}
              base_time={base_time}
              collection_filter={collection_filter}
            />
          </div>
        ))}

        <div style={{ height: 50 }} />
      </div>
    );
  }
}

export default RenderChanges;
