// Not my normal way to do it, but I need to make sure that
// Timestone is important before everything else, so it can mock the dates
let { timestone } = require("./Timestone.js");
let { JournalCollection } = require("./Journal.js");

let moment = require("moment");
let chalk = require("chalk");
let { cloneDeepWith } = require("lodash");

// const ISODate = x => new Date(x);
// const NumberLong = x => Number(x);

const useful_times = {
  // It's actually a monday with is super helpful as well
  ten_am_januari_first_2018: new Date("2018-01-01T10:00:00.000Z").getTime(),
};

global.jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000; // 10 second timeout

let my_journals = new JournalCollection();
let time_journal = my_journals.define_chapter("time");
let marker_journal = my_journals.define_chapter("markers");

let is_time_event = (event) => {
  return event && event.collectionName === "time" && event.type === "forward";
};

let make_dates_less_precise = (object) => {
  return cloneDeepWith(object, (val) => {
    if (
      val instanceof Date &&
      (val.getMilliseconds() !== 0 || val.getSeconds() !== 0)
    ) {
      let clone = new Date(val);
      clone.setSeconds(0);
      clone.setMilliseconds(0);
      return clone;
    }
  });
};

let observatory_log = (...args) => console.log(chalk.blue("[Observatory]"), ...args);

const Observatory = {
  currently_running_test_options: null,

  snapshot: () => {
    let eventlog = my_journals.snapshot();

    // Filter out consecutive time events
    let filtered_eventlog = [];
    for (let event of eventlog) {
      let [last_event, ...other_events] = filtered_eventlog;
      if (is_time_event(event) && is_time_event(last_event)) {
        last_event.change.to = event.change.to;
      } else {
        filtered_eventlog.unshift(event);
      }
    }
    filtered_eventlog.reverse();

    let with_less_precise_date = make_dates_less_precise(filtered_eventlog);

    return with_less_precise_date;
  },
  marker: ({ title }) => marker_journal.push({ title }),
  Journal: (name) => my_journals.define_chapter(name),

  match_observations: async () => {
    let snapshot_data = Observatory.snapshot();

    let errors_before = expect.getState().suppressedErrors.length;
    expect(snapshot_data).toMatchSnapshot();
    let errors_after = expect.getState().suppressedErrors;

    if (errors_before !== errors_after.length) {
      let last_error = errors_after[errors_after.length - 1];

      // Update the stack for a nicer message
      // NOTE Disable when jest gives weird results
      last_error.message = last_error.message.replace(
        /expect\((.*)\)\.toMatchSnapshot\((.*)\)/,
        `Observatory.match_observations()`
      );
      last_error.stack = last_error.stack.replace(/at [^(]+ \([^)]+\)\n/, "");
    }

    // Send new snapshot to observatory server
    try {
      let current_test = expect.getState();
      let { currentTestName, snapshotState } = current_test;
      let { _snapshotPath, _counters } = snapshotState;
      let counter = _counters.get(currentTestName);
      let snapshotName = `${currentTestName} ${counter}`;

      // jest.resetModules();
      jest.unmock("node-fetch");
      let fetch = jest.requireActual("node-fetch");

      let response = await fetch(`http://localhost:4000/api`, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "live_test_result",
          data: {
            snapshot_path: _snapshotPath,
            snapshot_name: snapshotName,
            snapshot_data: snapshot_data,
          },
        }),
      });
      let result = await response.json();
    } catch (err) {
      // console.log(`!!! err:`, err)
    }
  },

  // use `yield Observatory.Forward_Time(x)` to move to a certain point in time
  Forward_Time: async (duration) => {
    let test_options = this.currently_running_test_options;

    const moment_to = moment().add(duration);
    // If this is set, we assume it's a macro move so we can discard the milliseconds
    // which will give prettier results for longer processes
    if (test_options.precise_timing === false) {
      moment_to.milliseconds(0)
    }
    let date_to = moment_to.toDate();

    const perf_now = Date.__original.now();
    // prettier-ignore
    observatory_log(chalk.dim('Forwarding time from'), new Date(), chalk.dim('to'), date_to);
    await timestone.mock_forward_time(date_to, ({ from, to }) => {
      time_journal.push({
        type: "forward",
        from: new Date(from),
        to: new Date(to),
      });
    });
    observatory_log(chalk.dim("Ended on"), new Date());

    // Let me know if the performance has gone haywire
    const perf_then = Date.__original.now();
    const perf_seconds_spent = (perf_then - perf_now) / 1000;
    if (perf_seconds_spent > 10) {
      // prettier-ignore
      observatory_log(chalk.red(`SLOW PERF`), chalk.dim(`for time fowarding, took`), perf_seconds_spent, chalk.dim(`seconds`));
    }
  },

  test: (test_options, generator) => {
    if (generator == null) {
      generator = test_options;
      test_options = {};
    }

    test_options = {
      start_time: useful_times.ten_am_januari_first_2018,
      timezone: "GMT",
      precise_timing: true,
      ...test_options,
    };

    // Return the actual test function
    return async () => {
      this.currently_running_test_options = test_options;
      timestone.activate(test_options.start_time);
      my_journals.initialize({
        timezone: test_options.timezone,
      });

      const simulation = generator();

      //
      let next = simulation.next();
      while (next.done === false) {
        // If the value is a promise, we await it.
        // If it isn't, this doesn't hurt either.
        const result = await next.value;

        // This makes sure that all
        // - Resolved promises
        // - setImmediate(fn)-s
        // - setTimeout(fn, 0)-s
        // Are being handled and executed propertly before moving on.
        await timestone.mock_forward_time(new Date());

        // Go to next part of the test function
        next = simulation.next(result);
      }

      timestone.deactivate();
      this.currently_running_test_options = test_options;
    };
  },
};

module.exports = Observatory;
