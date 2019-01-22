import React from 'react';
import { test_data_storage } from './App.js';
import RenderChanges from './RenderChanges.js';

class AppWithTextField extends React.Component {
  state = {
    text: "",
    data: test_data_storage.get(),
  };

  componentDidUpdate(_, prevState) {
    if (this.state.data !== prevState.data) {
      test_data_storage.set(this.state.data);
    }
  }

  render() {
    const { text, data } = this.state;

    return (
      <div>
        <div
          style={{
            width: "100%",
            backgroundColor: "rgb(0, 43, 54)",
            padding: 20,
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <textarea
            style={{
              height: 200,
              width: 400,
              margin: "auto",
              padding: 10,
              fontFamily: `"Operator Mono", monospace`,
              fontSize: 14,
              borderRadius: 5,
              backgroundColor: `transparent`,
              borderColor: "white",
              color: "white",
            }}
            onClick={(event) => {
              event.target.select();
            }}
            value={text}
            onChange={(e) => {
              const new_text = e.target.value;
              this.setState({ text: new_text });

              try {
                const new_data = JSON.parse(new_text);
                this.setState({ data: new_data });
              } catch (e) {
                // try {
                //   const other_data = jest_parser.parse(new_text);
                //   this.setState({ data: other_data });
                // } catch (e) {}
              }
            }}
          />
        </div>

        <div
          style={{
            width: 400,
            margin: "auto",
          }}
        >
          <RenderChanges data={data || []} />
          <div style={{ height: 50 }} />
        </div>
      </div>
    );
  }
}
